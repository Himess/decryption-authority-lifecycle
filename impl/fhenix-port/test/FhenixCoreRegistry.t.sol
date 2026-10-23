// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: the Core registry requirements on the Fhenix port. TC1 (R1, R5), TC2 (R3) with R2, TC4 (R6, R10),
// TC5 (R6, R14), TC7 (R7), TC8 (R8), TC12 (R12). TC6 is in FhenixCorePermit.t.sol, TC9 and R10 in
// FhenixCoreEngine.t.sol, TC10 and TC11 in FhenixCoreBatchUpgrade.t.sol, TC3 in FhenixCoreDifferential.t.sol.

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IAccessControlDefaultAdminRules} from
    "@openzeppelin/contracts/access/extensions/IAccessControlDefaultAdminRules.sol";
import {FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {ACL} from "../src/ACL.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {PortSetup} from "./utils/PortSetup.sol";
import {PortAccount, PortApp} from "./utils/PortFixtures.sol";

contract FhenixCoreRegistryTest is PortSetup {
    address internal user = makeAddr("user");
    address internal other = makeAddr("other");
    address internal accomplice = makeAddr("accomplice");

    // ------------------------------------------------------------------------------------------------------------
    // The ERC's constants
    // ------------------------------------------------------------------------------------------------------------

    function test_ConstantsMatchTheERC() public view {
        assertEq(ACL.retireAccount.selector, bytes4(0xe7142996));
        assertEq(ACL.isAccountRetired.selector, bytes4(0xb279091e));
        assertEq(ACL.retirementStorageLocation.selector, bytes4(0xc89c7ccd));
        assertEq(ACL.retireAccount.selector ^ ACL.isAccountRetired.selector, CORE_ID);
        assertEq(keccak256("AccountRetired(address,address)"), ACCOUNT_RETIRED_TOPIC);
        assertEq(ACL.AccountAlreadyRetired.selector, bytes4(0x9c0fa00d));
        assertEq(ACL.SenderRetired.selector, bytes4(0xb9e76275));
        assertEq(ACL.UpgradeDropsRetirement.selector, bytes4(0x61b57965));
        assertEq(
            keccak256(abi.encode(uint256(keccak256("cofhe.storage.ACLRetirement")) - 1)) & ~bytes32(uint256(0xff)),
            RETIREMENT_LOCATION
        );
        assertEq(acl.retirementStorageLocation(), RETIREMENT_LOCATION);
        assertEq(acl.getVersion(), "ACL v0.2.0");
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC1 (R1, R5)
    // ------------------------------------------------------------------------------------------------------------

    function testFuzz_TC1_RetireOnce_SecondReverts_NoSecondEvent(address account) public {
        vm.expectEmit(true, true, false, false, address(acl));
        emit AccountRetired(account, address(0));
        _retire(account);
        assertTrue(acl.isAccountRetired(account));
        // The bit is the namespace's mapping at slot 0 of its struct.
        assertEq(uint256(vm.load(address(acl), keccak256(abi.encode(account, RETIREMENT_LOCATION)))), 1);

        vm.recordLogs();
        vm.expectRevert(abi.encodeWithSelector(ACL.AccountAlreadyRetired.selector, account));
        _retire(account);
        assertEq(vm.getRecordedLogs().length, 0);
        assertTrue(acl.isAccountRetired(account));
    }

    /// @dev In one transaction: a transient right, then retirement, then the same right read and used again.
    function test_TC1_R5_TheNextCallInTheSameTransactionAlreadySeesIt() public {
        (PortAccount r, ) = _newAccount("r");
        uint256 h = _handle(101);
        _add(_verifyInputData(tm, address(r), user, 101));
        uint256 tBefore = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (h, address(r))));
        uint256 uBefore = _add(address(acl), abi.encodeCall(ACL.isAllowed, (h, address(r))));
        uint256 retire = _add(address(acl), abi.encodeCall(ACL.retireAccount, ()));
        uint256 tAfter = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (h, address(r))));
        uint256 uAfter = _add(address(acl), abi.encodeCall(ACL.isAllowed, (h, address(r))));
        uint256 grant = _add(address(tm), abi.encodeCall(TaskManager.allow, (h, accomplice)));
        PortAccount.Result[] memory res = _run(r);

        _ok(res[0], "verify input");
        assertTrue(_bool(res[tBefore], "allowedTransient before"));
        assertTrue(_bool(res[uBefore], "isAllowed before"));
        _ok(res[retire], "retire");
        assertFalse(_bool(res[tAfter], "allowedTransient after"));
        assertFalse(_bool(res[uAfter], "isAllowed after"));
        _reverted(res[grant], abi.encodeWithSelector(ACL.SenderRetired.selector, address(r)), "grant after");
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC2 (R3) and R2
    // ------------------------------------------------------------------------------------------------------------

    function test_TC2_RetireWhileTheEngineIsDisabled_DenyListed_OffTheAccessList() public {
        address[] memory list = new address[](1);
        list[0] = user;
        vm.startPrank(admin);
        tm.disable();
        tm.setDenyList(list, true);
        tm.enableAccessList();
        vm.stopPrank();
        _retire(user);
        assertTrue(acl.isAccountRetired(user));
    }

    function test_TC2_AContractRetiresItself() public {
        (PortAccount c, ) = _newAccount("c");
        _exec(c, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        assertTrue(acl.isAccountRetired(address(c)));
    }

    function test_TC2_AnAccountWithNoHandleRetires() public {
        address fresh = makeAddr("fresh");
        _retire(fresh);
        assertTrue(acl.isAccountRetired(fresh));
    }

    function test_R2_AdminSettersAndACoreUpgradeLeaveRetirementInPlace() public {
        _retire(user);
        vm.startPrank(admin);
        acl.setDefaultRevokerContract(address(0));
        acl.setShareRegistry(address(0));
        acl.setTaskManager(address(tm));
        acl.upgradeToAndCall(address(new ACL()), "");
        vm.stopPrank();
        assertTrue(acl.isAccountRetired(user));
        vm.expectRevert(abi.encodeWithSelector(ACL.AccountAlreadyRetired.selector, user));
        _retire(user);
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC4 (R6 use role, R9, R10)
    // ------------------------------------------------------------------------------------------------------------

    function test_TC4_RetiredUser_EveryPersistentUseViewFalse_PublicUnchanged_OthersUnaffected() public {
        uint256 h = _deposit(user, 201); // persistent for the user and the app
        uint256 g = _deposit(other, 202);
        vm.prank(other);
        app.discloseBalance(); // g is now public (allowGlobal)

        assertTrue(acl.isAllowed(h, user) && acl.persistAllowed(h, user) && tm.isAllowed(h, user));
        assertTrue(acl.isAllowed(g, user));

        _retire(user);

        assertFalse(acl.isAllowed(h, user), "isAllowed");
        assertFalse(acl.persistAllowed(h, user), "persistAllowed");
        assertFalse(tm.isAllowed(h, user), "TaskManager.isAllowed (FHE.isAllowed)");
        assertFalse(acl.isAllowed(g, user), "isAllowed, public handle");
        // R9: the public view does not change.
        assertTrue(acl.globalAllowed(g) && tm.isPubliclyAllowed(g));
        // Others keep their rights on the same handles.
        assertTrue(acl.isAllowed(h, address(app)) && acl.persistAllowed(h, address(app)));
        assertTrue(acl.isAllowed(g, other));
        // A deputy asking the use view (as an ERC-7984 token would) refuses the retired user.
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(PortApp.CallerNotAllowed.selector, user));
        app.transferBalance(accomplice);
    }

    /// @dev The transient form, in one transaction: the account's transient right is false in both views once the
    ///      account is retired; the right another account holds on the same handle is untouched.
    function test_TC4_RetiredAccount_TransientUseViewsFalse_OthersUnaffected() public {
        (PortAccount c, ) = _newAccount("c");
        PortAccount u = new PortAccount(address(c)); // an account c runs, so that both act in one transaction
        uint256 t = _handle(203);
        _add(_verifyInputData(tm, address(c), user, 203));
        _add(address(tm), abi.encodeCall(TaskManager.allowTransient, (t, address(u))));
        _add(address(tm), abi.encodeCall(TaskManager.allowTransient, (t, other)));
        _add(address(u), abi.encodeCall(PortAccount.execute, (address(acl), abi.encodeCall(ACL.retireAccount, ()))));
        uint256 uT = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (t, address(u))));
        uint256 uU = _add(address(acl), abi.encodeCall(ACL.isAllowed, (t, address(u))));
        uint256 oT = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (t, other)));
        uint256 cU = _add(address(acl), abi.encodeCall(ACL.isAllowed, (t, address(c))));
        PortAccount.Result[] memory res = _run(c);

        for (uint256 i = 0; i < 4; i++) {
            _ok(res[i], "setup");
        }
        assertFalse(_bool(res[uT], "allowedTransient, retired"));
        assertFalse(_bool(res[uU], "isAllowed, retired"));
        assertTrue(_bool(res[oT], "allowedTransient, other"));
        assertTrue(_bool(res[cU], "isAllowed, the grantor"));
    }

    /// @dev No caller-identity exemption: the answer is the same for every caller, the TaskManager included.
    function testFuzz_TC4_TheAnswerDoesNotDependOnTheCaller(address caller) public {
        uint256 h = _deposit(user, 211);
        _retire(user);
        vm.prank(caller);
        assertFalse(acl.isAllowed(h, user));
        vm.prank(address(tm));
        assertFalse(acl.isAllowed(h, user));
        vm.prank(address(tm));
        assertFalse(acl.persistAllowed(h, user));
    }

    /// @dev R10: a retired account still computes on what it holds; the output is granted to it for the transaction
    ///      by the engine, and is inert in every view.
    function test_TC4_R10_ARetiredAccountStillComputes_OutputInertInViews() public {
        // An EOA computes on its own persistent handle after retiring.
        uint256 h = _deposit(user, 221);
        _retire(user);
        uint256[] memory operands = new uint256[](2);
        operands[0] = h;
        operands[1] = h;
        vm.prank(user);
        assertEq(tm.createTask(T64, FunctionId.add, operands, new uint256[](0)), _output(FunctionId.add, h, h));

        // A contract, in one transaction: compute, read the output in the views, compute again on the output.
        (PortAccount r, ) = _newAccount("r");
        uint256 b = _depositAs(r, 222);
        _exec(r, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        uint256 out = _output(FunctionId.add, b, b);
        uint256 first = _add(address(tm), _createTaskData(FunctionId.add, b, b));
        uint256 t = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (out, address(r))));
        uint256 u = _add(address(acl), abi.encodeCall(ACL.isAllowed, (out, address(r))));
        uint256 again = _add(address(tm), _createTaskData(FunctionId.mul, out, b));
        PortAccount.Result[] memory res = _run(r);
        assertEq(abi.decode(res[first].ret, (uint256)), out);
        assertFalse(_bool(res[t], "allowedTransient of the output"));
        assertFalse(_bool(res[u], "isAllowed of the output"));
        _ok(res[again], "the output as an operand (R10)");
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC5 (R6 on-behalf role, R14)
    // ------------------------------------------------------------------------------------------------------------

    /// @dev Writes a delegation record (account => delegatee => contract) into the ACL's ERC-7201 storage, so that
    ///      the on-behalf view is tested on its own. `delegates` is field 3 of `cofhe.storage.ACL`.
    function _setDelegation(address account, address delegatee, address contractAddress) internal {
        bytes32 slot = bytes32(uint256(ACL_STORAGE) + 3);
        slot = keccak256(abi.encode(account, slot));
        slot = keccak256(abi.encode(delegatee, slot));
        slot = keccak256(abi.encode(contractAddress, slot));
        vm.store(address(acl), slot, bytes32(uint256(1)));
    }

    function test_TC5_StorageLayoutAsRead() public view {
        // Field 6 of `cofhe.storage.ACL` is the TaskManager: the layout used by _setDelegation is the deployed one.
        assertEq(address(uint160(uint256(vm.load(address(acl), bytes32(uint256(ACL_STORAGE) + 6))))), address(tm));
    }

    function test_TC5_OnBehalfFalseWhenTheAccountTheDelegateeOrTheContractIsRetired() public {
        uint256 h = _deposit(user, 301); // persistent for the user and the app
        address delegatee = makeAddr("delegatee");
        _setDelegation(user, delegatee, address(app));
        assertTrue(acl.allowedOnBehalf(delegatee, h, address(app), user));

        uint256 snap = vm.snapshotState();
        _retire(user);
        assertFalse(acl.allowedOnBehalf(delegatee, h, address(app), user), "account retired");
        vm.revertToState(snap);

        _retire(delegatee);
        assertFalse(acl.allowedOnBehalf(delegatee, h, address(app), user), "delegatee retired");
        vm.revertToState(snap);

        _retire(address(app));
        assertFalse(acl.allowedOnBehalf(delegatee, h, address(app), user), "contract retired");
        vm.revertToState(snap);

        // A third party's retirement changes nothing.
        _retire(other);
        assertTrue(acl.allowedOnBehalf(delegatee, h, address(app), user));
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC7 (R7)
    // ------------------------------------------------------------------------------------------------------------

    function test_TC7_ARetiredGrantorRevertsOnEveryPathTheTaskManagerRelays() public {
        (PortAccount r, ) = _newAccount("r");
        uint256 h = _depositAs(r, 401); // a persistent right of r's
        _exec(r, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        bytes memory retired = abi.encodeWithSelector(ACL.SenderRetired.selector, address(r));

        vm.expectRevert(retired);
        _exec(r, address(tm), abi.encodeCall(TaskManager.allow, (h, accomplice)));
        vm.expectRevert(retired);
        _exec(r, address(tm), abi.encodeCall(TaskManager.allowGlobal, (h)));
        vm.expectRevert(retired);
        _exec(r, address(tm), abi.encodeCall(TaskManager.allowForDecryption, (h)));
        vm.expectRevert(retired);
        _exec(r, address(tm), abi.encodeCall(TaskManager.allowTransient, (h, accomplice)));
        vm.expectRevert(retired);
        _exec(r, address(tm), abi.encodeCall(TaskManager.shareCtHash, (h, address(app))));

        // An EOA, through the same relay.
        uint256 hu = _deposit(user, 402);
        _retire(user);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, user));
        tm.allow(hu, accomplice);
    }

    function test_TC7_TheBatchFormAndTheDelegationPathAreGatedAtTheACL() public {
        address requester = makeAddr("requester");
        _retire(requester);
        uint256[] memory hs = new uint256[](2);
        hs[0] = _handle(411);
        hs[1] = _handle(412);
        vm.prank(address(tm));
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, requester));
        acl.batchAllowTransient(hs, accomplice, requester);
        // The engine's own batch grant (requester = the TaskManager) is the R10 class and is not gated.
        vm.prank(address(tm));
        acl.batchAllowTransient(hs, requester, address(tm));

        // delegateAccount: a retired delegator reverts.
        address delegatee = makeAddr("delegatee");
        vm.prank(address(tm));
        acl.retireAccount();
        vm.prank(address(tm));
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, address(tm)));
        acl.delegateAccount(delegatee, address(app));
    }

    function test_TC7_TypedErrorPrecedence() public {
        uint256 h = _deposit(user, 421);
        _retire(user);
        // A direct call is refused before retirement is looked at.
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ACL.DirectAllowForbidden.selector, user));
        acl.allow(h, accomplice, user);
        // Retirement comes before the allowance check.
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, user));
        tm.allow(_handle(999), accomplice);
        // An active account without the right gets the error it always got.
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderNotAllowed.selector, other));
        tm.allow(h, accomplice);
    }

    function test_TC7_RemovalOnlyPathsStayOpen_TheRevoker() public {
        _retire(user);
        vm.startPrank(user);
        revoker.revokeSingle(block.timestamp);
        revoker.revokeAllExisting();
        vm.stopPrank();
        assertTrue(revoker.revokedSingle(user, block.timestamp));
        assertEq(revoker.revokeAllAt(user), block.timestamp);
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC8 (R8)
    // ------------------------------------------------------------------------------------------------------------

    function test_TC8_GrantsToARetiredAccountSucceed_AndAreInert() public {
        _retire(user);
        (PortAccount rr, ) = _newAccount("retired receiver");
        _exec(rr, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        (PortAccount c, ) = _newAccount("c");
        uint256 h = _handle(501);
        // In one transaction: grants and a share to retired accounts, then the views on them.
        _add(_verifyInputData(tm, address(c), other, 501));
        uint256 p = _add(address(tm), abi.encodeCall(TaskManager.allow, (h, user)));
        uint256 tr = _add(address(tm), abi.encodeCall(TaskManager.allowTransient, (h, user)));
        uint256 sh = _add(address(tm), abi.encodeCall(TaskManager.shareCtHash, (h, address(rr))));
        uint256 vT = _add(address(acl), abi.encodeCall(ACL.allowedTransient, (h, user)));
        uint256 vU = _add(address(acl), abi.encodeCall(ACL.isAllowed, (h, user)));
        uint256 vR = _add(address(acl), abi.encodeCall(ACL.isAllowed, (h, address(rr))));
        PortAccount.Result[] memory res = _run(c);
        _ok(res[0], "verify input");
        _ok(res[p], "allow to a retired account");
        _ok(res[tr], "allowTransient to a retired account");
        _ok(res[sh], "share to a retired receiver");
        assertFalse(_bool(res[vT], "allowedTransient, retired"));
        assertFalse(_bool(res[vU], "isAllowed, retired"));
        assertFalse(_bool(res[vR], "isAllowed, retired receiver"));
        assertFalse(acl.persistAllowed(h, user));
        assertFalse(acl.isAllowed(h, user));

        // A deputy's grant to a retired account (the app moving a balance to it) is accepted and inert.
        uint256 b = _deposit(other, 502);
        vm.prank(other);
        app.transferBalance(user);
        assertFalse(acl.isAllowed(b, user));
        assertTrue(acl.isAllowed(b, address(app)));
    }

    // ------------------------------------------------------------------------------------------------------------
    // TC12 (R12)
    // ------------------------------------------------------------------------------------------------------------

    function test_TC12_ERC165() public view {
        assertTrue(acl.supportsInterface(ERC165_ID));
        assertTrue(acl.supportsInterface(CORE_ID));
        assertTrue(acl.supportsInterface(type(IAccessControl).interfaceId));
        assertTrue(acl.supportsInterface(type(IAccessControlDefaultAdminRules).interfaceId));
        assertFalse(acl.supportsInterface(0xffffffff));
        // This port implements no extension.
        assertFalse(acl.supportsInterface(0x7dc5e209)); // E1
        assertFalse(acl.supportsInterface(0xc61ca396)); // E1 delay
        assertFalse(acl.supportsInterface(0x4b9ec076)); // E2
    }

    function testFuzz_TC12_UnknownIdsAnswerFalse(bytes4 id) public view {
        vm.assume(
            id != ERC165_ID && id != CORE_ID && id != type(IAccessControl).interfaceId
                && id != type(IAccessControlDefaultAdminRules).interfaceId
        );
        assertFalse(acl.supportsInterface(id));
    }
}
