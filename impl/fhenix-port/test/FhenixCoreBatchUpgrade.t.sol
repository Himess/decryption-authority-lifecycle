// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: TC10 (R13) and TC11 (R11) on the Fhenix port.
// TC10: Fhenix's registry offers no caller-preserving batching (R13 is a SHOULD); the carry batch is done by the
// account itself (a contract account here, or an EIP-7702 delegate's batching).
// TC11: the upgrade guard, and an upgrade from Fhenix's unmodified ACL (b5c20ed, "ACL v0.1.0") to the port.

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {ACL} from "../src/ACL.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {ERC1967Proxy} from "../src/ERC1967Proxy.sol";
import {ACP, SCOPE_GLOBAL} from "../src/Permissioned.sol";
import {ACL as VendorACL} from "../vendor/cofhe-contracts-b5c20ed/internal/host-chain/contracts/ACL.sol";
import {ACP as VendorACP} from "../vendor/cofhe-contracts-b5c20ed/internal/host-chain/contracts/Permissioned.sol";
import {PortSetup} from "./utils/PortSetup.sol";
import {
    PortAccount,
    CoreOtherLocation,
    LocationWithoutCore,
    CoreAnswersTwo,
    LyingImplementation,
    MalformedImplementation
} from "./utils/PortFixtures.sol";

contract FhenixCoreBatchUpgradeTest is PortSetup {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    address internal user = makeAddr("user");
    address internal newAccount = makeAddr("new account");

    // ------------------------------------------------------------------------------------------------------------
    // TC10 (R13)
    // ------------------------------------------------------------------------------------------------------------

    function test_TC10_GrantsThenRetire_OneAtomicBatch() public {
        (PortAccount a, ) = _newAccount("old account");
        uint256 b1 = _depositAs(a, 801);
        uint256 b2 = _depositAs(a, 802);
        uint256 b3 = _depositAs(a, 803);
        PortAccount.Call[] memory calls = new PortAccount.Call[](4);
        calls[0] = PortAccount.Call(address(tm), abi.encodeCall(TaskManager.allow, (b1, newAccount)));
        calls[1] = PortAccount.Call(address(tm), abi.encodeCall(TaskManager.allow, (b2, newAccount)));
        calls[2] = PortAccount.Call(address(tm), abi.encodeCall(TaskManager.allow, (b3, newAccount)));
        calls[3] = PortAccount.Call(address(acl), abi.encodeCall(ACL.retireAccount, ()));
        _batch(a, calls);
        assertTrue(acl.isAccountRetired(address(a)));
        assertTrue(acl.persistAllowed(b1, newAccount) && acl.persistAllowed(b2, newAccount));
        assertTrue(acl.persistAllowed(b3, newAccount));
        assertFalse(acl.isAllowed(b1, address(a)));
    }

    function test_TC10_RetireThenGrant_TheWholeBatchReverts() public {
        (PortAccount a, ) = _newAccount("old account");
        uint256 b1 = _depositAs(a, 811);
        PortAccount.Call[] memory calls = new PortAccount.Call[](2);
        calls[0] = PortAccount.Call(address(acl), abi.encodeCall(ACL.retireAccount, ()));
        calls[1] = PortAccount.Call(address(tm), abi.encodeCall(TaskManager.allow, (b1, newAccount)));
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, address(a)));
        _batch(a, calls);
        assertFalse(acl.isAccountRetired(address(a)), "atomic: the retirement rolled back too");
        assertFalse(acl.persistAllowed(b1, newAccount));
    }

    function test_TC10_TheRegistryOffersNoCallerPreservingBatch() public {
        bytes[] memory inner = new bytes[](1);
        inner[0] = abi.encodeCall(ACL.retireAccount, ());
        (bool ok, ) = address(acl).call(abi.encodeWithSignature("multicall(bytes[])", inner));
        assertFalse(ok, "ACL");
        (ok, ) = address(tm).call(abi.encodeWithSignature("multicall(bytes[])", inner));
        assertFalse(ok, "TaskManager");
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC11 (R11)
    // ------------------------------------------------------------------------------------------------------------

    function _implementation(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
    }

    function test_TC11_ACoreImplementationAtTheSameLocation_Accepted_StateAndEnforcementKept() public {
        uint256 h = _deposit(user, 821);
        _retire(user);
        address next = address(new ACL());
        vm.prank(admin);
        acl.upgradeToAndCall(next, "");
        assertEq(_implementation(address(acl)), next);
        assertTrue(acl.isAccountRetired(user));
        assertFalse(acl.isAllowed(h, user));
        assertTrue(acl.isAllowed(h, address(app)));
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, user));
        tm.allow(h, newAccount);
    }

    function test_TC11_AnImplementationWithoutCore_Fhenixs_Reverts() public {
        address vendor = address(new VendorACL());
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ACL.UpgradeDropsRetirement.selector, vendor));
        acl.upgradeToAndCall(vendor, "");
        assertEq(_implementation(address(acl)), aclImplementation);
    }

    function test_TC11_ACoreImplementationAtAnotherLocation_Reverts() public {
        address other = address(new CoreOtherLocation());
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ACL.UpgradeDropsRetirement.selector, other));
        acl.upgradeToAndCall(other, "");
    }

    /// @dev Each check catches what the other misses: the right location without Core is refused too.
    function test_TC11_TheRightLocationWithoutCore_Reverts() public {
        address noCore = address(new LocationWithoutCore());
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ACL.UpgradeDropsRetirement.selector, noCore));
        acl.upgradeToAndCall(noCore, "");
        address two = address(new CoreAnswersTwo());
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ACL.UpgradeDropsRetirement.selector, two));
        acl.upgradeToAndCall(two, "");
        assertEq(_implementation(address(acl)), aclImplementation);
    }

    function test_TC11_MalformedRevertingOrMissingAnswers_Revert() public {
        address twoWords = address(new MalformedImplementation(false));
        address reverting = address(new MalformedImplementation(true));
        address noCode = makeAddr("no code");
        address[3] memory candidates = [twoWords, reverting, noCode];
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(admin);
            vm.expectRevert(abi.encodeWithSelector(ACL.UpgradeDropsRetirement.selector, candidates[i]));
            acl.upgradeToAndCall(candidates[i], "");
        }
    }

    /// @dev The asserted residual: an implementation that answers both checks and enforces nothing passes the guard.
    ///      The governance profile's canary (a known retired account and handle) is what catches it.
    function test_TC11_ALyingImplementation_Accepted_TheAssertedResidual_TheCanaryCatchesIt() public {
        uint256 h = _deposit(user, 831);
        _retire(user);
        assertTrue(acl.isAccountRetired(user) && !acl.isAllowed(h, user), "canary before");
        address liar = address(new LyingImplementation());
        vm.prank(admin);
        acl.upgradeToAndCall(liar, "");
        assertEq(_implementation(address(acl)), liar);
        assertFalse(acl.isAccountRetired(user), "canary after: retirement no longer reported");
        assertTrue(acl.isAllowed(h, user), "canary after: the use view answers true");
    }

    function testFuzz_TC11_TheRoleCheckComesFirst(address notUpgrader) public {
        vm.assume(notUpgrader != admin);
        address other = address(new CoreOtherLocation());
        bytes32 role = acl.UPGRADER_ROLE();
        vm.prank(notUpgrader);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, notUpgrader, role)
        );
        acl.upgradeToAndCall(other, "");
    }

    /// @dev From Fhenix's own ACL (b5c20ed) to the port: the existing state is kept, the retirement namespace starts
    ///      empty, Core is active at once, permits signed before the upgrade still verify, and the TaskManager's
    ///      operand check finds the dedicated entry point.
    function test_TC11_FromFhenixsUnmodifiedACL_StateKept_CoreActive() public {
        (address holder, uint256 holderKey) = makeAddrAndKey("holder");
        vm.startPrank(admin);
        TaskManager tmV = TaskManager(
            address(new ERC1967Proxy(address(new TaskManager()), abi.encodeCall(TaskManager.initialize, (admin, 0))))
        );
        VendorACL v = VendorACL(
            address(
                new ERC1967Proxy(address(new VendorACL()), abi.encodeCall(VendorACL.initialize, (admin, 0, address(tmV))))
            )
        );
        tmV.grantRole(tmV.CONFIG_MANAGER_ROLE(), admin);
        tmV.grantRole(tmV.VERIFIER_SIGNER_MANAGER_ROLE(), admin);
        tmV.setACLContract(address(v));
        tmV.setVerifierSigner(verifier);
        v.grantRole(v.UPGRADER_ROLE(), admin);
        vm.stopPrank();
        assertEq(v.getVersion(), "ACL v0.1.0");

        // State written through Fhenix's own ACL.
        (PortAccount c, ) = _newAccount("c");
        uint256 h = _handle(841);
        uint256 hPublic = _handle(842);
        _add(_verifyInputData(tmV, address(c), user, 841));
        _add(_verifyInputData(tmV, address(c), user, 842));
        _add(address(tmV), abi.encodeCall(TaskManager.allow, (h, user)));
        _add(address(tmV), abi.encodeCall(TaskManager.allow, (h, holder)));
        _add(address(tmV), abi.encodeCall(TaskManager.allow, (h, address(c))));
        _add(address(tmV), abi.encodeCall(TaskManager.allowGlobal, (hPublic)));
        _add(address(tmV), abi.encodeCall(TaskManager.allowForDecryption, (h)));
        PortAccount.Result[] memory res = _run(c);
        for (uint256 i = 0; i < res.length; i++) {
            _ok(res[i], "vendor setup");
        }
        // A permit signed against Fhenix's ACL before the upgrade.
        ACP memory p = _selfPermit(ACL(address(v)), holder, holderKey, SCOPE_GLOBAL);
        assertTrue(v.isAllowedWithPermission(_toVendor(p), h));

        address portImpl = address(new ACL());
        vm.prank(admin);
        v.upgradeToAndCall(portImpl, "");
        ACL upgraded = ACL(address(v));

        assertEq(upgraded.getVersion(), "ACL v0.2.0");
        assertTrue(upgraded.supportsInterface(CORE_ID));
        assertTrue(upgraded.persistAllowed(h, user) && upgraded.persistAllowed(h, holder));
        assertTrue(upgraded.globalAllowed(hPublic) && upgraded.isAllowedForDecryption(h));
        assertFalse(upgraded.isAccountRetired(user));
        assertTrue(upgraded.isAllowedWithPermission(p, h), "a permit signed before the upgrade");

        // Core is active.
        vm.prank(user);
        upgraded.retireAccount();
        assertFalse(upgraded.persistAllowed(h, user));
        assertTrue(upgraded.globalAllowed(hPublic));
        vm.prank(holder);
        upgraded.retireAccount();
        assertFalse(upgraded.isAllowedWithPermission(p, h));
        // The TaskManager's operand check reaches the dedicated entry point on the upgraded ACL.
        _exec(c, address(tmV), _createTaskData(FunctionId.add, h, h));
    }

    function _toVendor(ACP memory p) internal pure returns (VendorACP memory q) {
        q = VendorACP(
            p.issuer,
            p.expiration,
            p.recipient,
            p.revokerData,
            p.revokerContract,
            p.scope,
            p.contracts,
            p.handles,
            p.sealingKey,
            p.issuerSignature,
            p.recipientSignature
        );
    }
}

