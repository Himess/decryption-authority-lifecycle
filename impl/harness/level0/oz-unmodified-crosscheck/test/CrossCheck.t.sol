// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

// Out-of-tree cross-check for c.11 item 2 (ERC-7984 paths): the UNMODIFIED OpenZeppelin confidential-contracts
// 0.5.3 token, built against its peer @fhevm/solidity 0.11.1, talking to the Level 0 ACL v0.8.0, FHEVMExecutor and
// HCULimit sources of impl/fhevm-main (branch lifecycle/level0) deployed at the canonical addresses. The in-tree
// suites use a mechanical solc 0.8.24 port of the same OZ files; this harness checks that the unmodified code
// behaves the same way.

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ACL} from "@fhevm-host-contracts/contracts/ACL.sol";
import {FHEVMExecutor} from "@fhevm-host-contracts/contracts/FHEVMExecutor.sol";
import {HCULimit} from "@fhevm-host-contracts/contracts/HCULimit.sol";
import {EmptyUUPSProxyACL} from "@fhevm-host-contracts/contracts/emptyProxyACL/EmptyUUPSProxyACL.sol";
import {EmptyUUPSProxy} from "@fhevm-host-contracts/contracts/emptyProxy/EmptyUUPSProxy.sol";
import {FheType} from "@fhevm-host-contracts/contracts/shared/FheType.sol";
import {aclAdd, fhevmExecutorAdd, hcuLimitAdd, kmsVerifierAdd} from "@fhevm-host-contracts/addresses/FHEVMHostAddresses.sol";
import {FHE, euint64, ebool, CoprocessorConfig} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";

contract ProxyForTest is ERC1967Proxy {
    constructor(address implementation, bytes memory data) ERC1967Proxy(implementation, data) {}
}

function coprocessorConfig() pure returns (CoprocessorConfig memory) {
    return CoprocessorConfig({ACLAddress: aclAdd, CoprocessorAddress: fhevmExecutorAdd, KMSVerifierAddress: kmsVerifierAdd});
}

contract OZ7984Token is ERC7984 {
    constructor() ERC7984("Unmodified OZ ERC-7984 0.5.3", "OZ", "") {
        FHE.setCoprocessor(coprocessorConfig());
    }

    function mint(address to, uint64 amount) external returns (euint64) {
        return _mint(to, FHE.asEuint64(amount));
    }
}

contract OZAcceptingReceiver is IERC7984Receiver {
    constructor() {
        FHE.setCoprocessor(coprocessorConfig());
    }

    function onConfidentialTransferReceived(address, address, euint64, bytes calldata) external returns (ebool) {
        ebool accepted = FHE.asEbool(true);
        FHE.allowTransient(accepted, msg.sender);
        return accepted;
    }

    function retire() external {
        ACL(aclAdd).retireAccount();
    }
}

/// @notice Test-only account (contract, or EIP-7702 delegate of an EOA).
contract XAccount {
    bytes32 internal constant P = keccak256("RetirementTestAccount.RESULT_PLACEHOLDER");

    function execute(address target, bytes calldata data) external returns (bytes memory ret) {
        bool ok;
        (ok, ret) = target.call(data);
        if (!ok) _bubble(ret);
    }

    function computeAndCall(
        bytes32 operand,
        address[] calldata targets,
        bytes[] calldata templates
    ) external returns (bytes32 result) {
        result = FHEVMExecutor(fhevmExecutorAdd).fheAdd(operand, operand, 0x00);
        for (uint256 i = 0; i < targets.length; i++) {
            (bool ok, bytes memory ret) = targets[i].call(_fill(templates[i], result));
            if (!ok) _bubble(ret);
        }
    }

    function _fill(bytes memory data, bytes32 value) internal pure returns (bytes memory) {
        for (uint256 i = 0; i + 32 <= data.length; ) {
            bytes32 word;
            assembly {
                word := mload(add(add(data, 32), i))
            }
            if (word == P) {
                assembly {
                    mstore(add(add(data, 32), i), value)
                }
                i += 32;
            } else {
                i++;
            }
        }
        return data;
    }

    function _bubble(bytes memory ret) private pure {
        assembly {
            revert(add(ret, 32), mload(ret))
        }
    }
}

contract UnmodifiedOZCrossCheckTest is Test {
    address internal constant owner = address(456);
    bytes32 internal constant P = keccak256("RetirementTestAccount.RESULT_PLACEHOLDER");

    ACL internal acl = ACL(aclAdd);
    OZ7984Token internal token;
    address internal eoa7702;
    address internal contractAccount;
    address internal control;
    address internal holder = makeAddr("holder");
    address internal recipient = makeAddr("recipient");

    function _proxyAt(address at, address emptyImplementation, bytes memory init) internal {
        deployCodeTo("CrossCheck.t.sol:ProxyForTest", abi.encode(emptyImplementation, init), at);
    }

    function setUp() public {
        // Implementations are created before vm.prank: a CREATE would consume the prank.
        address aclImpl = address(new ACL());
        address executorImpl = address(new FHEVMExecutor());
        address hcuImpl = address(new HCULimit());
        _proxyAt(aclAdd, address(new EmptyUUPSProxyACL()), abi.encodeCall(EmptyUUPSProxyACL.initialize, (owner)));
        vm.prank(owner);
        EmptyUUPSProxyACL(aclAdd).upgradeToAndCall(aclImpl, abi.encodeCall(ACL.initializeFromEmptyProxy, ()));
        _proxyAt(fhevmExecutorAdd, address(new EmptyUUPSProxy()), abi.encodeCall(EmptyUUPSProxy.initialize, ()));
        vm.prank(owner);
        EmptyUUPSProxy(fhevmExecutorAdd).upgradeToAndCall(executorImpl, abi.encodeCall(FHEVMExecutor.initializeFromEmptyProxy, ()));
        _proxyAt(hcuLimitAdd, address(new EmptyUUPSProxy()), abi.encodeCall(EmptyUUPSProxy.initialize, ()));
        vm.prank(owner);
        EmptyUUPSProxy(hcuLimitAdd).upgradeToAndCall(
            hcuImpl,
            abi.encodeCall(HCULimit.initializeFromEmptyProxy, (type(uint48).max, 5_000_000, 20_000_000))
        );
        assertEq(acl.getVersion(), "ACL v0.8.0");

        token = new OZ7984Token();
        XAccount code = new XAccount();
        uint256 key;
        (eoa7702, key) = makeAddrAndKey("eoa7702");
        vm.signAndAttachDelegation(address(code), key);
        contractAccount = address(new XAccount());
        control = address(new XAccount());
    }

    function _fund(address account) internal returns (bytes32 balance) {
        token.mint(account, 1_000);
        acl.cleanTransientStorage();
        balance = euint64.unwrap(token.confidentialBalanceOf(account));
    }

    function _retire(address account) internal {
        if (account == eoa7702) {
            vm.prank(account);
            acl.retireAccount();
        } else {
            XAccount(account).execute(aclAdd, abi.encodeCall(ACL.retireAccount, ()));
        }
    }

    function _one(address a) internal pure returns (address[] memory r) {
        r = new address[](1);
        r[0] = a;
    }

    function _oneB(bytes memory b) internal pure returns (bytes[] memory r) {
        r = new bytes[](1);
        r[0] = b;
    }

    /// @dev Control: compute, grant the token transient access, call the token. Retired: compute, call the token,
    ///      refused by OZ's unmodified caller-side check.
    function _path(bytes memory tokenCall, bool asOperator) internal {
        bytes32 bc = _fund(control);
        if (asOperator) {
            vm.prank(holder);
            token.setOperator(control, type(uint48).max);
        }
        address[] memory targets = new address[](2);
        targets[0] = aclAdd;
        targets[1] = address(token);
        bytes[] memory templates = new bytes[](2);
        templates[0] = abi.encodeCall(ACL.allowTransient, (P, address(token)));
        templates[1] = tokenCall;
        XAccount(control).computeAndCall(bc, targets, templates);

        address[2] memory accounts = [eoa7702, contractAccount];
        for (uint256 i = 0; i < 2; i++) {
            address account = accounts[i];
            bytes32 b = _fund(account);
            if (asOperator) {
                vm.prank(holder);
                token.setOperator(account, type(uint48).max);
            }
            _retire(account);
            (bool ok, bytes memory err) = account.call(
                abi.encodeCall(XAccount.computeAndCall, (b, _one(address(token)), _oneB(tokenCall)))
            );
            assertFalse(ok, "unmodified OZ refuses the retired caller");
            bytes4 sel;
            address user;
            assembly {
                sel := mload(add(err, 32))
                user := mload(add(err, 68))
            }
            assertEq(sel, ERC7984.ERC7984UnauthorizedUseOfEncryptedAmount.selector);
            assertEq(user, account);
        }
    }

    function test_Unmodified_ConfidentialTransferHandle() public {
        _path(abi.encodeWithSignature("confidentialTransfer(address,bytes32)", recipient, P), false);
    }

    function test_Unmodified_ConfidentialTransferFromHandle() public {
        token.mint(holder, 500);
        _path(abi.encodeWithSignature("confidentialTransferFrom(address,address,bytes32)", holder, recipient, P), true);
    }

    function test_Unmodified_ConfidentialTransferAndCallHandle() public {
        _path(abi.encodeWithSignature("confidentialTransferAndCall(address,bytes32,bytes)", recipient, P, bytes("")), false);
    }

    function test_Unmodified_ConfidentialTransferFromAndCallHandle() public {
        token.mint(holder, 500);
        _path(
            abi.encodeWithSignature(
                "confidentialTransferFromAndCall(address,address,bytes32,bytes)",
                holder,
                recipient,
                P,
                bytes("")
            ),
            true
        );
    }

    function test_Unmodified_RequestDiscloseEncryptedAmount() public {
        _path(abi.encodeWithSignature("requestDiscloseEncryptedAmount(bytes32)", P), false);
    }

    function test_Unmodified_InboundTransferToRetiredAccepted_AndInert() public {
        token.mint(holder, 500);
        acl.cleanTransientStorage();
        _retire(eoa7702);
        euint64 bal = token.confidentialBalanceOf(holder);
        vm.prank(holder);
        token.confidentialTransfer(eoa7702, bal);
        bytes32 received = euint64.unwrap(token.confidentialBalanceOf(eoa7702));
        assertTrue(received != bytes32(0));
        assertTrue(acl.persistAllowed(received, address(token)));
        assertFalse(acl.persistAllowed(received, eoa7702));
    }

    function test_Unmodified_AndCallToRetiredContractRecipientReverts() public {
        OZAcceptingReceiver receiver = new OZAcceptingReceiver();
        token.mint(holder, 500);
        acl.cleanTransientStorage();
        receiver.retire();
        euint64 bal = token.confidentialBalanceOf(holder);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, address(receiver)));
        token.confidentialTransferAndCall(address(receiver), bal, "");
        assertEq(euint64.unwrap(token.confidentialBalanceOf(holder)), euint64.unwrap(bal));
    }
}
