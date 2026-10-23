// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: TC6 (R6, permit role) on the Fhenix port. The ACL's permit view, as the decryption service calls it
// (through TaskManager.isAllowedWithPermission) and directly; the permit's validity probe (R14); the ACP share
// registry, where a shared permit travels between its issuer and its recipient; and the revoker.

import {ACL} from "../src/ACL.sol";
import {ACPShareRegistry} from "../src/ACPShareRegistry.sol";
import {PermissionedUpgradeable, ACP, SCOPE_GLOBAL, SCOPE_CONTRACT, SCOPE_HANDLES} from "../src/Permissioned.sol";
import {PortSetup} from "./utils/PortSetup.sol";
import {PortAccount} from "./utils/PortFixtures.sol";

contract FhenixCorePermitTest is PortSetup {
    address internal issuer;
    uint256 internal issuerKey;
    address internal recipient;
    uint256 internal recipientKey;
    uint256 internal h;

    function setUp() public override {
        super.setUp();
        (issuer, issuerKey) = makeAddrAndKey("issuer");
        (recipient, recipientKey) = makeAddrAndKey("recipient");
        h = _deposit(issuer, 601); // the issuer and the app hold h
    }

    // ------------------------------------------------------------------------------------------------------------
    // The ACL's permit view
    // ------------------------------------------------------------------------------------------------------------

    function test_TC6_SelfPermit_TrueThenFalseOnceTheIssuerRetires() public {
        ACP memory p = _selfPermit(acl, issuer, issuerKey, SCOPE_GLOBAL);
        assertTrue(acl.isAllowedWithPermission(p, h));
        assertTrue(tm.isAllowedWithPermission(p, h), "the decryption service's call");
        assertTrue(acl.checkPermissionValidity(p));

        _retire(issuer);

        assertFalse(acl.isAllowedWithPermission(p, h));
        assertFalse(tm.isAllowedWithPermission(p, h), "the decryption service's call");
        assertFalse(acl.checkPermissionValidity(p), "validity probe (R14)");
    }

    function test_TC6_SharedPermit_FalseOnceTheIssuerRetires() public {
        ACP memory p = _sharedPermit(acl, issuer, issuerKey, recipient, recipientKey);
        assertTrue(tm.isAllowedWithPermission(p, h));
        _retire(issuer);
        assertFalse(tm.isAllowedWithPermission(p, h));
        assertFalse(acl.isAllowedWithPermission(p, h));
        assertFalse(acl.checkPermissionValidity(p));
    }

    function test_TC6_SharedPermit_FalseOnceTheRecipientRetires() public {
        ACP memory p = _sharedPermit(acl, issuer, issuerKey, recipient, recipientKey);
        assertTrue(tm.isAllowedWithPermission(p, h));
        _retire(recipient);
        assertFalse(tm.isAllowedWithPermission(p, h));
        assertFalse(acl.isAllowedWithPermission(p, h));
        assertFalse(acl.checkPermissionValidity(p));
        // The issuer's own self permit is unaffected by the recipient's retirement.
        assertTrue(tm.isAllowedWithPermission(_selfPermit(acl, issuer, issuerKey, SCOPE_GLOBAL), h));
    }

    function test_TC6_HandleAndContractScopes() public {
        ACP memory ph = _scoped(SCOPE_HANDLES, new address[](0), _one(bytes32(h)));
        address[] memory scope = new address[](1);
        scope[0] = address(app);
        ACP memory pc = _scoped(SCOPE_CONTRACT, scope, new bytes32[](0));
        assertTrue(tm.isAllowedWithPermission(ph, h));
        assertTrue(tm.isAllowedWithPermission(pc, h));

        uint256 snap = vm.snapshotState();
        // A retired contract in the scope no longer counts (it is a party the view consults).
        _retire(address(app));
        assertFalse(tm.isAllowedWithPermission(pc, h), "retired contract in scope");
        assertTrue(tm.isAllowedWithPermission(ph, h), "handle scope unaffected");
        vm.revertToState(snap);

        _retire(issuer);
        assertFalse(tm.isAllowedWithPermission(ph, h));
        assertFalse(tm.isAllowedWithPermission(pc, h));
    }

    function test_TC6_ERC1271Issuer_FalseOnceRetired() public {
        (PortAccount w, uint256 wKey) = _newAccount("wallet");
        uint256 hw = _depositAs(w, 611);
        ACP memory p = _selfPermit(acl, address(w), wKey, SCOPE_GLOBAL);
        assertTrue(tm.isAllowedWithPermission(p, hw));
        _exec(w, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        assertFalse(tm.isAllowedWithPermission(p, hw));
    }

    function test_TC6_AnInvalidStructureStillRevertsFirst() public {
        ACP memory p = _selfPermit(acl, issuer, issuerKey, SCOPE_GLOBAL);
        _retire(issuer);
        vm.warp(uint256(p.expiration) + 1);
        vm.expectRevert(PermissionedUpgradeable.PermissionInvalid_Expired.selector);
        tm.isAllowedWithPermission(p, h);
        vm.expectRevert(PermissionedUpgradeable.PermissionInvalid_Expired.selector);
        acl.checkPermissionValidity(p);
    }

    function test_TC6_ThirdPartyRetirementChangesNothing() public {
        ACP memory p = _sharedPermit(acl, issuer, issuerKey, recipient, recipientKey);
        _retire(makeAddr("someone else"));
        _retire(address(tm)); // even the relaying engine's own retirement is not consulted by a permit view
        assertTrue(tm.isAllowedWithPermission(p, h));
        assertTrue(acl.checkPermissionValidity(p));
    }

    // ------------------------------------------------------------------------------------------------------------
    // The ACP share registry
    // ------------------------------------------------------------------------------------------------------------

    /// @dev The share as the issuer posts it: no sealing key and no recipient signature yet.
    function _postable() internal view returns (ACP memory p) {
        p = _sharedPermit(acl, issuer, issuerKey, recipient, recipientKey);
        p.sealingKey = bytes32(0);
        p.recipientSignature = "";
    }

    function _post(ACP memory p) internal returns (bytes32 id) {
        vm.prank(p.issuer);
        id = shareRegistry.share(p, "");
    }

    function test_TC6_Registry_ARetiredIssuerCannotPost() public {
        ACP memory p = _postable();
        _retire(issuer);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ACPShareRegistry.SenderRetired.selector, issuer));
        shareRegistry.share(p, "");
    }

    function test_TC6_Registry_AShareIsInvalidOnceItsIssuerRetires() public {
        bytes32 id = _post(_postable());
        assertTrue(shareRegistry.isShareValid(id));
        (bytes32[] memory ids, ) = shareRegistry.sharesFor(recipient);
        assertEq(ids.length, 1);
        _retire(issuer);
        assertFalse(shareRegistry.isShareValid(id));
        (ids, ) = shareRegistry.sharesFor(recipient);
        assertEq(ids.length, 0);
    }

    function test_TC6_Registry_AShareIsInvalidOnceItsRecipientRetires() public {
        bytes32 id = _post(_postable());
        _retire(recipient);
        assertFalse(shareRegistry.isShareValid(id));
        (bytes32[] memory ids, ) = shareRegistry.sharesFor(recipient);
        assertEq(ids.length, 0);
    }

    /// @dev R8: posting to a retired recipient is not refused; the share is inert.
    function test_TC6_Registry_PostingToARetiredRecipientIsAccepted_AndInert() public {
        _retire(recipient);
        bytes32 id = _post(_postable());
        assertFalse(shareRegistry.isShareValid(id));
        assertEq(shareRegistry.getShare(id).issuer, issuer);
    }

    function test_TC6_Registry_RemovalStaysOpenToRetiredParties() public {
        ACP memory p1 = _postable();
        bytes32 id1 = _post(p1);
        ACP memory p2 = _postable();
        p2.expiration += 1;
        p2.issuerSignature = _sign(acl, issuerKey, _issuerSharedHash(p2));
        bytes32 id2 = _post(p2);
        _retire(issuer);
        _retire(recipient);
        vm.prank(issuer);
        shareRegistry.removeShare(id1);
        vm.prank(recipient);
        shareRegistry.removeShare(id2);
        assertEq(shareRegistry.getShare(id1).issuer, address(0));
        assertEq(shareRegistry.getShare(id2).issuer, address(0));
    }

    function test_TC6_Registry_FailsClosedWithoutAnAnswer() public {
        bytes32 id = _post(_postable());
        ACP memory p = _postable();
        p.expiration += 7;
        p.issuerSignature = _sign(acl, issuerKey, _issuerSharedHash(p));

        // Unset.
        vm.prank(admin);
        shareRegistry.setRetirementRegistry(address(0));
        assertFalse(shareRegistry.isShareValid(id));
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ACPShareRegistry.RetirementUnknown.selector, issuer));
        shareRegistry.share(p, "");

        // An address with no code answers nothing.
        address noCode = makeAddr("no code");
        vm.prank(admin);
        shareRegistry.setRetirementRegistry(noCode);
        assertFalse(shareRegistry.isShareValid(id));

        // A malformed answer (a word that is not a bool) is not an answer.
        address two = address(new TwoAnswer());
        vm.prank(admin);
        shareRegistry.setRetirementRegistry(two);
        assertFalse(shareRegistry.isShareValid(id));

        // Back to the ACL: valid again.
        vm.prank(admin);
        shareRegistry.setRetirementRegistry(address(acl));
        assertTrue(shareRegistry.isShareValid(id));
    }

    function test_TC6_Registry_OnlyTheAdminSetsTheLink() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert();
        shareRegistry.setRetirementRegistry(stranger);
        assertEq(shareRegistry.retirementRegistry(), address(acl));
    }

    // ------------------------------------------------------------------------------------------------------------

    function _scoped(uint8 scope, address[] memory contracts, bytes32[] memory handles)
        internal
        view
        returns (ACP memory p)
    {
        p.issuer = issuer;
        p.expiration = uint64(block.timestamp + 1 days);
        p.scope = scope;
        p.contracts = contracts;
        p.handles = handles;
        p.sealingKey = keccak256("sealing key");
        p.issuerSignature = _sign(acl, issuerKey, _issuerSelfHash(p));
    }

    function _one(bytes32 x) internal pure returns (bytes32[] memory a) {
        a = new bytes32[](1);
        a[0] = x;
    }
}

/// @dev Answers isAccountRetired with the word 2: not a valid bool encoding.
contract TwoAnswer {
    function isAccountRetired(address) external pure returns (uint256) {
        return 2;
    }
}
