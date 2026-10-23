// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: the end-to-end run on Fhenix's published mock stack, with the port's ACL and share registry.
// Users encrypt through the plugin's client (the mock ZK verifier signs the inputs), a vault built on FHE.sol holds
// and adds balances in the mock TaskManager, and decryption goes through the mock threshold network, which asks the
// ACL's permit view (decrypt-for-view, decrypt-for-transaction) or its public view, as Fhenix's decryption service
// does. Each test function call runs as its own transaction (Foundry's isolation).

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {CofheClient, SharedACPExport} from "@cofhe/foundry-plugin/contracts/CofheClient.sol";
import {MockTaskManager} from "@cofhe/mock-contracts/contracts/MockTaskManager.sol";
import {ACP} from "@cofhe/mock-contracts/contracts/Permissioned.sol";
import {ACP as PortACP} from "../../src/Permissioned.sol";
import {ACPShareRegistry as PortACPShareRegistry} from "../../src/ACPShareRegistry.sol";
import {CofheTestPort} from "../src/CofheTestPort.sol";
import {E2EVault} from "../src/E2EVault.sol";

contract FhenixE2ETest is CofheTestPort {
    E2EVault internal vault;
    CofheClient internal alice;
    CofheClient internal bob;
    CofheClient internal carol;
    address internal a;
    address internal b;
    address internal c;

    function setUp() public {
        deployMocksWithPortACL();
        assertEq(address(mockTaskManager.acl()), address(portAcl));
        assertEq(address(mockThresholdNetwork.mockAcl()), address(portAcl));
        vault = new E2EVault();
        alice = createCofheClient();
        alice.connect(uint256(keccak256("e2e alice")));
        bob = createCofheClient();
        bob.connect(uint256(keccak256("e2e bob")));
        carol = createCofheClient();
        carol.connect(uint256(keccak256("e2e carol")));
        a = alice.account();
        b = bob.account();
        c = carol.account();
        assertEq(address(alice.mockAcl()), address(portAcl), "the client signs permits for the port's ACL");
    }

    function _deposit(CofheClient who, address account, uint64 value) internal returns (bytes32 h) {
        (externalEuint64 x, bytes memory proof) = who.createExternalEuint64(value, address(vault));
        vm.prank(account);
        h = euint64.unwrap(vault.deposit(x, proof));
    }

    function _retire(address account) internal {
        vm.prank(account);
        portAcl.retireAccount();
    }

    function _deniedForView(bytes32 h, ACP memory acp) internal view {
        (bool allowed, string memory err, ) = mockThresholdNetwork.querySealOutput(uint256(h), block.chainid, acp);
        assertFalse(allowed, "querySealOutput");
        assertEq(err, "NotAllowed");
        (allowed, err, ) = mockThresholdNetwork.decryptForTxWithACP(uint256(h), acp);
        assertFalse(allowed, "decryptForTxWithACP");
        assertEq(err, "NotAllowed");
    }

    function test_E2E_PermitDecryption_EndsWhenTheIssuerRetires() public {
        bytes32 h = _deposit(alice, a, 42);
        ACP memory acp = alice.ACP_createSelf();
        assertEq(alice.decryptForView(h, acp), 42);
        (, uint256 v, ) = alice.decryptForTx_withACP(h, acp);
        assertEq(v, 42);

        _retire(a);

        _deniedForView(h, acp);
        vm.expectRevert(bytes("CofheClient: decryptForView failed: NotAllowed"));
        alice.decryptForView(h, acp);
        assertFalse(mockTaskManager.isAllowed(uint256(h), a));
        assertTrue(mockTaskManager.isAllowed(uint256(h), address(vault)), "the vault keeps its own right");
    }

    function test_E2E_SharedPermit_EndsWhenEitherPartyRetires() public {
        bytes32 h = _deposit(alice, a, 7);
        SharedACPExport memory exported = alice.ACP_exportShared(alice.ACP_createShared(b));
        ACP memory bobAcp = bob.ACP_importShared(exported);
        assertEq(bob.decryptForView(h, bobAcp), 7);

        uint256 snap = vm.snapshotState();
        _retire(b);
        _deniedForView(h, bobAcp);
        assertEq(alice.decryptForView(h, alice.ACP_createSelf()), 7, "the issuer's own permit still works");
        vm.revertToState(snap);

        _retire(a);
        _deniedForView(h, bobAcp);
    }

    function test_E2E_PublicDecryptionIsUnchanged() public {
        bytes32 h = _deposit(alice, a, 99);
        vm.prank(a);
        vault.disclose();
        _retire(a);
        (, uint256 v, bytes memory signature) = bob.decryptForTx_withoutACP(h);
        assertEq(v, 99);
        mockTaskManager.publishDecryptResult(uint256(h), v, signature);
        assertEq(mockTaskManager.getDecryptResult(uint256(h)), 99);
    }

    function test_E2E_TheVaultRefusesARetiredOwner_AndAnInboundTransferIsComputedButInert() public {
        _deposit(alice, a, 5);
        _deposit(carol, c, 11);
        _retire(a);

        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(E2EVault.CallerNotAllowed.selector, a));
        vault.transferAll(b);
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(E2EVault.CallerNotAllowed.selector, a));
        vault.disclose();

        // Carol pays Alice: accepted (R8), added by the engine, and inert for Alice.
        vm.prank(c);
        bytes32 hNew = euint64.unwrap(vault.transferAll(a));
        assertEq(getPlaintext(hNew), 16);
        _deniedForView(hNew, alice.ACP_createSelf());
        assertFalse(mockTaskManager.isAllowed(uint256(hNew), a));
        assertTrue(mockTaskManager.isAllowed(uint256(hNew), address(vault)));
    }

    function test_E2E_ShareRegistry_ARetiredIssuersShareIsNoLongerListed() public {
        _deposit(alice, a, 1);
        PortACP memory post = abi.decode(abi.encode(alice.ACP_createShared(b)), (PortACP));
        vm.prank(a);
        bytes32 id = portShareRegistry.share(post, "");
        (bytes32[] memory ids, ) = portShareRegistry.sharesFor(b);
        assertEq(ids.length, 1);
        assertTrue(portShareRegistry.isShareValid(id));

        _retire(a);

        assertFalse(portShareRegistry.isShareValid(id));
        (ids, ) = portShareRegistry.sharesFor(b);
        assertEq(ids.length, 0);
        post.expiration += 1;
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(PortACPShareRegistry.SenderRetired.selector, a));
        portShareRegistry.share(post, "");
    }

    /// @dev The mock TaskManager checks operands with the gated use view, so a retired account cannot compute in
    ///      the mock stack: stricter than R10 requires (the exemption is optional). The real TaskManager of the port
    ///      takes the exemption through the dedicated entry point (test/FhenixCoreEngine.t.sol).
    function test_E2E_TheMockEngineTakesNoExemption() public {
        bytes32 h = _deposit(alice, a, 3);
        uint256[] memory operands = new uint256[](2);
        operands[0] = uint256(h);
        operands[1] = uint256(h);
        vm.prank(a);
        mockTaskManager.createTask(Utils.EUINT64_TFHE, FunctionId.add, operands, new uint256[](0));
        _retire(a);
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(MockTaskManager.ACLNotAllowed.selector, uint256(h), a));
        mockTaskManager.createTask(Utils.EUINT64_TFHE, FunctionId.add, operands, new uint256[](0));
    }
}
