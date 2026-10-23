// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ACL} from "@fhevm-host-contracts/contracts/ACL.sol";
import {FheType} from "@fhevm-host-contracts/contracts/shared/FheType.sol";
import {HostContractsDeployerTestUtils} from "@fhevm-host-contracts/fhevm-foundry/HostContractsDeployerTestUtils.sol";
import {aclAdd, inputVerifierAdd} from "@fhevm-host-contracts/addresses/FHEVMHostAddresses.sol";
import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ObserverAccess} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ObserverAccess.sol";
import {ERC7984ProfileA} from "../src/ERC7984ProfileA.sol";
import {StockObserverToken, ProfileAStockToken, StockMockInputVerifier} from "./Tokens.sol";

/**
 * @title ProfileAStockTest
 * @notice Phase 4, P1.4: TC8 and TC23 (A1-A3) against OpenZeppelin's unmodified ERC-7984 0.5.3 and its observer
 *         extension, compiled from the npm package with solc 0.8.27, once without Profile A and once with the
 *         `ERC7984ProfileA` extension. The registry is our branch's ACL with the lifecycle Core. The key of `holder`
 *         is compromised in the observer and operator tests: the owner and the thief both sign as `holder`.
 */
contract ProfileAStockTest is HostContractsDeployerTestUtils {
    ACL internal acl;
    address internal aclImplementation;

    address internal constant owner = address(456);

    address internal holder = makeAddr("holder");
    address internal sender = makeAddr("sender");
    address internal thiefObserver = makeAddr("thiefObserver");
    address internal thiefObserver2 = makeAddr("thiefObserver2");
    address internal friendObserver = makeAddr("friendObserver");
    address internal operator = makeAddr("operator");
    address internal recipient = makeAddr("recipient");

    StockObserverToken internal stock;
    ProfileAStockToken internal profileA;

    /// @dev Inbound transfers in the residual measurement.
    uint256 internal constant TRANSFERS = 5;

    function setUp() public {
        (, aclImplementation) = _deployACL(owner);
        _deployPauserSet();
        _deployFHEVMExecutor(owner);
        _deployHCULimit(owner);
        acl = ACL(aclAdd);
        stock = new StockObserverToken();
        profileA = new ProfileAStockToken();
    }

    ////////////////////////////////////////////////////////////////////////////
    // helpers
    ////////////////////////////////////////////////////////////////////////////

    function _retire(address who) internal {
        vm.prank(who);
        acl.retireAccount();
        assertTrue(acl.isAccountRetired(who));
    }

    function _balance(address token, address account) internal view returns (bytes32) {
        return euint64.unwrap(ERC7984(token).confidentialBalanceOf(account));
    }

    function _mint(address token, address to, uint64 amount) internal {
        StockObserverToken(token).mint(to, amount);
        acl.cleanTransientStorage();
    }

    /// @dev `sender` (never retired) is funded and sends its whole balance handle to `to`. Returns the amount handle.
    function _transferTo(address token, address to) internal returns (bytes32 transferred) {
        _mint(token, sender, 100);
        bytes32 amount = _balance(token, sender);
        vm.prank(sender);
        transferred = euint64.unwrap(ERC7984(token).confidentialTransfer(to, euint64.wrap(amount)));
        acl.cleanTransientStorage();
    }

    /// @dev A fresh input handle of type Uint64 (the mock input verifier accepts any proof).
    function _freshInput(string memory seed) internal pure returns (bytes32) {
        return
            (keccak256(bytes(seed)) & 0xffffffffffffffffffffffffffffffffffffffffff0000000000000000000000) |
            bytes32(uint256(uint8(FheType.Uint64)) << 8);
    }

    /// @dev After `TRANSFERS` inbound transfers to `holder`, the number of handles `who` can read: each new balance
    ///      and each amount (persistent grants only).
    function _readsAfterTransfers(address token, address who) internal returns (uint256 reads) {
        for (uint256 i = 0; i < TRANSFERS; i++) {
            bytes32 amount = _transferTo(token, holder);
            if (acl.persistAllowed(amount, who)) reads++;
            if (acl.persistAllowed(_balance(token, holder), who)) reads++;
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // TC8 (R8, A2): transfers to and from a retired account, on both tokens
    ////////////////////////////////////////////////////////////////////////////

    function _tc8Inbound(address token) internal {
        _retire(holder);
        bytes32 transferred = _transferTo(token, holder);
        bytes32 received = _balance(token, holder);
        assertTrue(received != bytes32(0), "the transfer to the retired account succeeds");
        assertTrue(acl.persistAllowed(received, token), "the token keeps access");
        assertFalse(acl.persistAllowed(received, holder), "inert for the retired recipient");
        assertFalse(acl.persistAllowed(transferred, holder));
        assertTrue(acl.persistAllowed(transferred, sender), "the sender keeps access to the amount");
    }

    function test_TC8_TransferToRetiredAccount_Stock() public {
        _tc8Inbound(address(stock));
    }

    function test_TC8_TransferToRetiredAccount_ProfileA() public {
        _tc8Inbound(address(profileA));
    }

    function _tc8Outbound(address token) internal {
        vm.etch(inputVerifierAdd, address(new StockMockInputVerifier()).code);
        _mint(token, holder, 1_000);
        vm.prank(holder);
        ERC7984(token).setOperator(operator, type(uint48).max);
        _retire(holder);
        bytes32 before = _balance(token, holder);

        vm.prank(holder);
        ERC7984(token).confidentialTransfer(recipient, externalEuint64.wrap(_freshInput("direct")), hex"01");
        assertTrue(_balance(token, recipient) != bytes32(0), "the retired account moves funds (limit 2)");
        assertTrue(_balance(token, holder) != before);

        vm.prank(operator);
        ERC7984(token).confidentialTransferFrom(holder, recipient, externalEuint64.wrap(_freshInput("operator")), hex"01");
        acl.cleanTransientStorage();
        assertTrue(acl.persistAllowed(_balance(token, recipient), recipient), "so does an operator set while active");
    }

    function test_TC8_TransferFromRetiredAccount_Stock() public {
        _tc8Outbound(address(stock));
    }

    function test_TC8_TransferFromRetiredAccount_ProfileA() public {
        _tc8Outbound(address(profileA));
    }

    ////////////////////////////////////////////////////////////////////////////
    // TC23, A1: observers
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Residual without Profile A, measured: after retirement the thief adds an observer, which reads the current
    ///      balance and every later balance and amount. Clearing does not help: the thief adds it again.
    function test_A1_Stock_Residual_ObserverAddedAfterRetirement() public {
        _mint(address(stock), holder, 1_000);
        _retire(holder);
        vm.prank(holder);
        stock.setObserver(holder, thiefObserver);
        assertTrue(acl.persistAllowed(_balance(address(stock), holder), thiefObserver), "leak: the current balance");
        uint256 reads = _readsAfterTransfers(address(stock), thiefObserver);
        emit log_named_uint("stock: handles the thief's observer reads after 5 inbound transfers", reads);
        assertEq(reads, 2 * TRANSFERS, "every later balance and amount");

        vm.prank(holder);
        stock.setObserver(holder, address(0));
        vm.prank(holder);
        stock.setObserver(holder, thiefObserver);
        assertEq(stock.observer(holder), thiefObserver, "the thief wins the clear-and-re-add race");
    }

    /// @dev Profile A: the same attack fails at the first step, and nothing later reaches the thief.
    function test_A1_ProfileA_ObserverAddedAfterRetirementRefused() public {
        _mint(address(profileA), holder, 1_000);
        _retire(holder);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(ERC7984ProfileA.ERC7984GrantByRetiredAccount.selector, holder));
        profileA.setObserver(holder, thiefObserver);
        assertFalse(acl.persistAllowed(_balance(address(profileA), holder), thiefObserver));
        uint256 reads = _readsAfterTransfers(address(profileA), thiefObserver);
        emit log_named_uint("profile A: handles the thief's observer reads after 5 inbound transfers", reads);
        assertEq(reads, 0);
    }

    /// @dev An observer the thief added before retirement. The retired owner clears it on both tokens. Without
    ///      Profile A the thief adds it back and reads every later balance and amount; with it, nothing.
    function _addedBeforeThenCleared(address token, bool profile) internal returns (uint256 reads, bytes32 atAdd) {
        _mint(token, holder, 1_000);
        vm.prank(holder);
        ERC7984ObserverAccess(token).setObserver(holder, thiefObserver);
        atAdd = _balance(token, holder);
        assertTrue(acl.persistAllowed(atAdd, thiefObserver), "the observer reads the balance from the start");
        _retire(holder);
        vm.prank(holder);
        ERC7984ObserverAccess(token).setObserver(holder, address(0));
        assertEq(ERC7984ObserverAccess(token).observer(holder), address(0), "the retired owner clears it");
        vm.prank(holder);
        if (profile) {
            vm.expectRevert(abi.encodeWithSelector(ERC7984ProfileA.ERC7984GrantByRetiredAccount.selector, holder));
        }
        ERC7984ObserverAccess(token).setObserver(holder, thiefObserver);
        reads = _readsAfterTransfers(token, thiefObserver);
    }

    function test_A1_Stock_Residual_ThiefReAddsAfterTheClear() public {
        (uint256 reads, ) = _addedBeforeThenCleared(address(stock), false);
        emit log_named_uint("stock, re-added after the clear: handles read after 5 transfers", reads);
        assertEq(reads, 2 * TRANSFERS);
    }

    function test_A1_ProfileA_ThiefObserverClearedAndCannotBeReAdded() public {
        (uint256 reads, bytes32 atAdd) = _addedBeforeThenCleared(address(profileA), true);
        emit log_named_uint("profile A, after the clear: handles read after 5 transfers", reads);
        assertEq(reads, 0);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(ERC7984ProfileA.ERC7984GrantByRetiredAccount.selector, holder));
        profileA.setObserver(holder, thiefObserver2);
        assertTrue(acl.persistAllowed(atAdd, thiefObserver), "not a clawback: the earlier grant stays");
    }

    /// @dev With Profile A an observer set before retirement keeps receiving grants until the owner clears it: the
    ///      extension gates grant paths only, as A1 says. Clearing is the owner's step.
    function test_A1_ProfileA_UnclearedObserverKeepsReading() public {
        _mint(address(profileA), holder, 1_000);
        vm.prank(holder);
        profileA.setObserver(holder, thiefObserver);
        _retire(holder);
        uint256 reads = _readsAfterTransfers(address(profileA), thiefObserver);
        emit log_named_uint("profile A, not cleared: handles read after 5 transfers", reads);
        assertEq(reads, 2 * TRANSFERS);
    }

    function test_A1_ProfileA_ObserverMayAbdicate_ActiveAccountUnaffected() public {
        _mint(address(profileA), holder, 1_000);
        vm.prank(holder);
        profileA.setObserver(holder, thiefObserver);
        _retire(holder);
        vm.prank(thiefObserver);
        profileA.setObserver(holder, address(0));
        assertEq(profileA.observer(holder), address(0));

        _mint(address(profileA), sender, 10);
        vm.prank(sender);
        profileA.setObserver(sender, friendObserver);
        assertEq(profileA.observer(sender), friendObserver);
        vm.prank(sender);
        profileA.setObserver(sender, thiefObserver2);
        assertEq(profileA.observer(sender), thiefObserver2);
    }

    ////////////////////////////////////////////////////////////////////////////
    // TC23, A1: operators
    ////////////////////////////////////////////////////////////////////////////

    function test_A1_Stock_Residual_OperatorAfterRetirement() public {
        vm.warp(1_000_000);
        _retire(holder);
        vm.prank(holder);
        stock.setOperator(operator, uint48(block.timestamp));
        assertTrue(stock.isOperator(holder, operator), "until == now is a grant");
        vm.prank(holder);
        stock.setOperator(recipient, type(uint48).max);
        assertTrue(stock.isOperator(holder, recipient), "a retired holder grants an operator for ever");
    }

    function test_A1_ProfileA_OperatorGate() public {
        vm.warp(1_000_000);
        vm.prank(holder);
        profileA.setOperator(operator, uint48(block.timestamp + 1 days));
        _retire(holder);
        assertTrue(profileA.isOperator(holder, operator), "an operator set before retirement stays until revoked");

        bytes memory refused = abi.encodeWithSelector(ERC7984ProfileA.ERC7984GrantByRetiredAccount.selector, holder);
        vm.prank(holder);
        vm.expectRevert(refused);
        profileA.setOperator(recipient, uint48(block.timestamp + 1 days));
        vm.prank(holder);
        vm.expectRevert(refused);
        profileA.setOperator(recipient, uint48(block.timestamp));
        vm.prank(holder);
        vm.expectRevert(refused);
        profileA.setOperator(operator, type(uint48).max);

        vm.prank(holder);
        profileA.setOperator(operator, 0);
        assertFalse(profileA.isOperator(holder, operator), "revoking stays allowed");
        vm.prank(holder);
        profileA.setOperator(recipient, uint48(block.timestamp - 1));
        assertFalse(profileA.isOperator(holder, recipient));

        vm.prank(sender);
        profileA.setOperator(operator, uint48(block.timestamp + 1 days));
        assertTrue(profileA.isOperator(sender, operator), "an active holder is not affected");
    }

    ////////////////////////////////////////////////////////////////////////////
    // Fails closed, and the cost of the gates
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Against a registry without the lifecycle Core, the gates revert instead of granting.
    function test_ProfileA_FailsClosedWithoutCore() public {
        vm.etch(aclAdd, address(new StockMockInputVerifier()).code);
        vm.prank(holder);
        vm.expectRevert();
        profileA.setObserver(holder, friendObserver);
        vm.prank(holder);
        vm.expectRevert();
        profileA.setOperator(operator, type(uint48).max);
    }

    function _gasOf(address who, address target, bytes memory data) internal returns (uint256 used) {
        vm.cool(target);
        vm.cool(aclAdd);
        vm.cool(aclImplementation);
        vm.prank(who);
        uint256 before = gasleft();
        (bool ok, ) = target.call(data);
        used = before - gasleft();
        assertTrue(ok);
    }

    function test_Gas_A1GateOverhead() public {
        vm.warp(1_000_000);
        _mint(address(stock), holder, 1_000);
        _mint(address(profileA), holder, 1_001);
        assertTrue(_balance(address(stock), holder) != _balance(address(profileA), holder));

        bytes memory setOperator = abi.encodeCall(ERC7984.setOperator, (operator, uint48(block.timestamp + 1 days)));
        uint256 operatorStock = _gasOf(holder, address(stock), setOperator);
        uint256 operatorProfileA = _gasOf(holder, address(profileA), setOperator);
        uint256 observerStock = _gasOf(
            holder,
            address(stock),
            abi.encodeCall(ERC7984ObserverAccess.setObserver, (holder, friendObserver))
        );
        uint256 observerProfileA = _gasOf(
            holder,
            address(profileA),
            abi.encodeCall(ERC7984ObserverAccess.setObserver, (holder, thiefObserver2))
        );
        emit log_named_uint("setOperator, stock", operatorStock);
        emit log_named_uint("setOperator, Profile A", operatorProfileA);
        emit log_named_uint("setObserver with a balance, stock", observerStock);
        emit log_named_uint("setObserver with a balance, Profile A", observerProfileA);
        emit log_named_uint("gate overhead, setOperator", operatorProfileA - operatorStock);
        emit log_named_uint("gate overhead, setObserver", observerProfileA - observerStock);
        assertGt(operatorProfileA, operatorStock);
        assertGt(observerProfileA, observerStock);
    }
}
