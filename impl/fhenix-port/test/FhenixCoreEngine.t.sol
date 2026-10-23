// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: TC9 and R10 on the Fhenix port. The engine (TaskManager) relays every grant and the decryption
// service's permit check to the ACL, always as itself, so the engine exemption cannot be defined by its identity
// (R10.4). The port gives it a dedicated operand-check entry point, used only for operands of computations whose
// output stays in the engine. Here: a retired account computes, then tries every export (TC9); the entry point's
// conditions; and the negative test, a caller-identity exemption on the same contracts.

import {euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {ACL} from "../src/ACL.sol";
import {TaskManager, DecryptFunctionNotSupported} from "../src/TaskManager.sol";
import {ACP, SCOPE_GLOBAL} from "../src/Permissioned.sol";
import {PortSetup} from "./utils/PortSetup.sol";
import {PortAccount, PortApp, ACLCallerExemption} from "./utils/PortFixtures.sol";

contract FhenixCoreEngineTest is PortSetup {
    address internal accomplice = makeAddr("accomplice");
    address internal user = makeAddr("user");

    // ------------------------------------------------------------------------------------------------------------
    // TC9
    // ------------------------------------------------------------------------------------------------------------

    /// @dev One transaction: `who` computes out = b + b (b is its balance in the app), then tries every export of
    ///      `out` and of b. The deputy exports of `out` need the app to hold a right on it, which `who` gives first
    ///      (index 4 and 5); for a retired account those grants revert, and the deputy refuses anyway.
    function _sequence(PortAccount who, uint256 b, uint256 out) internal returns (PortAccount.Result[] memory) {
        _add(address(tm), _createTaskData(FunctionId.add, b, b)); // 0 compute
        _add(address(tm), abi.encodeCall(TaskManager.allow, (out, accomplice))); // 1 grant
        _add(address(tm), abi.encodeCall(TaskManager.allowGlobal, (out))); // 2 publication (public use)
        _add(address(tm), abi.encodeCall(TaskManager.allowForDecryption, (out))); // 3 publication (decryption flag)
        _add(address(tm), abi.encodeCall(TaskManager.allowTransient, (out, address(app)))); // 4 transient grant
        _add(address(tm), abi.encodeCall(TaskManager.shareCtHash, (out, address(app)))); // 5 share hand-off
        _add(address(app), abi.encodeCall(PortApp.transferHandle, (accomplice, _e(out)))); // 6 deputy transfer
        _add(address(app), abi.encodeCall(PortApp.discloseHandle, (_e(out)))); // 7 deputy disclosure
        _add(address(app), abi.encodeCall(PortApp.discloseBalance, ())); // 8 deputy disclosure of b
        _add(address(app), abi.encodeCall(PortApp.transferBalance, (accomplice))); // 9 deputy transfer of b
        _add(address(acl), abi.encodeCall(ACL.isAllowed, (out, address(who)))); // 10 use view of the output
        _add(address(tm), _createTaskData(FunctionId.mul, out, out)); // 11 the output as an operand again
        return _run(who);
    }

    function test_TC9_ARetiredAccountComputes_ThenEveryExportReverts() public {
        (PortAccount r, uint256 rKey) = _newAccount("retired");
        uint256 b = _depositAs(r, 701); // r and the app hold b
        _exec(r, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        uint256 out = _output(FunctionId.add, b, b);

        PortAccount.Result[] memory res = _sequence(r, b, out);
        bytes memory retired = abi.encodeWithSelector(ACL.SenderRetired.selector, address(r));
        bytes memory deputy = abi.encodeWithSelector(PortApp.CallerNotAllowed.selector, address(r));
        _ok(res[0], "compute");
        assertEq(abi.decode(res[0].ret, (uint256)), out, "the computation runs (R10)");
        _reverted(res[1], retired, "allow");
        _reverted(res[2], retired, "allowGlobal");
        _reverted(res[3], retired, "allowForDecryption");
        _reverted(res[4], retired, "allowTransient");
        _reverted(res[5], retired, "shareCtHash");
        _reverted(res[6], deputy, "deputy transfer of the output");
        _reverted(res[7], deputy, "deputy disclosure of the output");
        _reverted(res[8], deputy, "deputy disclosure of the balance");
        _reverted(res[9], deputy, "deputy transfer of the balance");
        assertFalse(_bool(res[10], "isAllowed of the output"));
        _ok(res[11], "the output as an operand again (R10)");

        // Nothing left the engine.
        assertFalse(acl.persistAllowed(out, accomplice) || acl.globalAllowed(out) || acl.isAllowedForDecryption(out));
        assertFalse(acl.persistAllowed(b, accomplice) || acl.globalAllowed(b));
        // The permit view: r's own permit (ERC-1271, its owner's key) authorizes nothing.
        assertFalse(tm.isAllowedWithPermission(_selfPermit(acl, address(r), rKey, SCOPE_GLOBAL), b));
    }

    function test_TC9_Control_TheSameSequenceSucceedsForAnActiveAccount() public {
        (PortAccount c, uint256 cKey) = _newAccount("control");
        uint256 b = _depositAs(c, 711);
        uint256 out = _output(FunctionId.add, b, b);

        PortAccount.Result[] memory res = _sequence(c, b, out);
        assertEq(abi.decode(res[0].ret, (uint256)), out);
        for (uint256 i = 1; i <= 9; i++) {
            _ok(res[i], string.concat("export ", vm.toString(i)));
        }
        assertTrue(_bool(res[10], "isAllowed of the output"));
        _ok(res[11], "the output as an operand again");
        assertTrue(acl.persistAllowed(out, accomplice) && acl.globalAllowed(out) && acl.isAllowedForDecryption(out));
        assertTrue(acl.persistAllowed(b, accomplice) && acl.globalAllowed(b));
        assertTrue(tm.isAllowedWithPermission(_selfPermit(acl, address(c), cKey, SCOPE_GLOBAL), b));
    }

    /// @dev The residual, as on Zama's lines: a retired account can still bring a fresh input (data it encrypted
    ///      itself) and compute on it; the input cannot leave either.
    function test_TC9_Residual_AFreshInputStillVerifies_AndCannotLeave() public {
        (PortAccount r, ) = _newAccount("retired");
        _exec(r, address(acl), abi.encodeCall(ACL.retireAccount, ()));
        uint256 x = _handle(721);
        _add(_verifyInputData(tm, address(r), address(r), 721));
        _add(address(tm), _createTaskData(FunctionId.add, x, x));
        uint256 g = _add(address(tm), abi.encodeCall(TaskManager.allow, (x, accomplice)));
        PortAccount.Result[] memory res = _run(r);
        _ok(res[0], "fresh input");
        _ok(res[1], "compute on it");
        _reverted(res[g], abi.encodeWithSelector(ACL.SenderRetired.selector, address(r)), "grant it");
    }

    // ------------------------------------------------------------------------------------------------------------
    // R10: the dedicated entry point's conditions
    // ------------------------------------------------------------------------------------------------------------

    function testFuzz_R10_OnlyTheTaskManagerMayCallTheOperandCheck(address caller) public {
        vm.assume(caller != address(tm));
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(ACL.DirectAllowForbidden.selector, caller));
        acl.isAllowedForOperand(_handle(1), caller);
    }

    /// @dev For an account that never retired, the operand check and the use view give the same answer.
    function testFuzz_R10_TheOperandCheckAgreesWithTheUseViewForActiveAccounts(uint256 raw, bool hold, bool pub)
        public
    {
        raw = bound(raw, 1, type(uint200).max);
        (PortAccount c, ) = _newAccount("c");
        uint256 b;
        if (hold) {
            b = _depositAs(c, raw);
            if (pub) _exec(c, address(app), abi.encodeCall(PortApp.discloseBalance, ()));
        } else {
            b = _deposit(user, raw);
            if (pub) {
                vm.prank(user);
                app.discloseBalance();
            }
        }
        vm.prank(address(tm));
        bool operand = acl.isAllowedForOperand(b, address(c));
        assertEq(operand, acl.isAllowed(b, address(c)));
        assertEq(operand, hold || pub);
    }

    /// @dev Function ids that are not computations whose output stays in the engine take the gated use view: a
    ///      retired account is refused on them, an active one is not. Computations stay open to the retired account.
    function test_R10_NonComputationIdsTakeTheGatedView() public {
        (PortAccount r, ) = _newAccount("retired");
        (PortAccount c, ) = _newAccount("control");
        uint256 br = _depositAs(r, 731);
        uint256 bc = _depositAs(c, 732);
        _exec(r, address(acl), abi.encodeCall(ACL.retireAccount, ()));

        FunctionId[5] memory notComputation =
            [FunctionId._0, FunctionId._1, FunctionId.sealoutput, FunctionId._5, FunctionId._31];
        for (uint256 i = 0; i < notComputation.length; i++) {
            vm.expectRevert(abi.encodeWithSelector(TaskManager.ACLNotAllowed.selector, br, address(r)));
            _exec(r, address(tm), _createTaskData(notComputation[i], br, br));
            _exec(c, address(tm), _createTaskData(notComputation[i], bc, bc));
        }
        // decrypt is refused for everyone before any operand check.
        vm.expectRevert(DecryptFunctionNotSupported.selector);
        _exec(c, address(tm), _createTaskData(FunctionId.decrypt, bc, bc));

        FunctionId[20] memory computation = [
            FunctionId.sub,
            FunctionId.add,
            FunctionId.xor,
            FunctionId.and,
            FunctionId.or,
            FunctionId.div,
            FunctionId.rem,
            FunctionId.mul,
            FunctionId.shl,
            FunctionId.shr,
            FunctionId.gte,
            FunctionId.lte,
            FunctionId.lt,
            FunctionId.gt,
            FunctionId.min,
            FunctionId.max,
            FunctionId.eq,
            FunctionId.ne,
            FunctionId.rol,
            FunctionId.ror
        ];
        for (uint256 i = 0; i < computation.length; i++) {
            _exec(r, address(tm), _createTaskData(computation[i], br, br));
        }
    }

    // ------------------------------------------------------------------------------------------------------------
    // R10 negative test: a caller-identity exemption on the same contracts
    // ------------------------------------------------------------------------------------------------------------

    function test_R10_Negative_ACallerIdentityExemptionExemptsGrantsAndThePermitCheck() public {
        (address holder, uint256 holderKey) = makeAddrAndKey("holder");
        (TaskManager tmX, ACL aclX, ) = _deployStack(address(new ACLCallerExemption()));

        // Both stacks: `holder` gets a persistent right on h through a contract that verified the input.
        uint256 h = _handle(741);
        _giveHolder(tmX, holder, 741);
        _giveHolder(tm, holder, 741);
        vm.prank(holder);
        aclX.retireAccount();
        _retire(holder);

        ACP memory pX = _selfPermit(aclX, holder, holderKey, SCOPE_GLOBAL);
        ACP memory p = _selfPermit(acl, holder, holderKey, SCOPE_GLOBAL);

        // The exemption by identity: through the TaskManager, retirement is never consulted.
        assertTrue(tmX.isAllowed(h, holder), "use view through the engine");
        assertTrue(tmX.isAllowedWithPermission(pX, h), "the decryption service's permit check");
        vm.startPrank(holder);
        tmX.allow(h, accomplice);
        tmX.allowGlobal(h);
        tmX.allowForDecryption(h);
        tmX.allowTransient(h, accomplice);
        tmX.shareCtHash(h, accomplice);
        vm.stopPrank();
        assertTrue(aclX.persistAllowed(h, accomplice) && aclX.globalAllowed(h) && aclX.isAllowedForDecryption(h));
        // Called directly, the same ACL answers as Core requires: the gap is the relay.
        assertFalse(aclX.isAllowed(h, holder));
        assertFalse(aclX.isAllowedWithPermission(pX, h));

        // The port, on the same steps: every answer false, every grant refused.
        assertFalse(tm.isAllowed(h, holder));
        assertFalse(tm.isAllowedWithPermission(p, h));
        bytes memory retired = abi.encodeWithSelector(ACL.SenderRetired.selector, holder);
        vm.startPrank(holder);
        vm.expectRevert(retired);
        tm.allow(h, accomplice);
        vm.expectRevert(retired);
        tm.allowGlobal(h);
        vm.expectRevert(retired);
        tm.allowForDecryption(h);
        vm.expectRevert(retired);
        tm.allowTransient(h, accomplice);
        vm.expectRevert(retired);
        tm.shareCtHash(h, accomplice);
        vm.stopPrank();
        assertFalse(acl.persistAllowed(h, accomplice) || acl.globalAllowed(h) || acl.isAllowedForDecryption(h));
    }

    function _giveHolder(TaskManager t, address holder, uint256 raw) internal {
        (PortAccount c, ) = _newAccount("giver");
        _add(_verifyInputData(t, address(c), holder, raw));
        _add(address(t), abi.encodeCall(TaskManager.allow, (_handle(raw), holder)));
        PortAccount.Result[] memory res = _run(c);
        _ok(res[0], "verify");
        _ok(res[1], "allow to holder");
    }

    function _e(uint256 x) internal pure returns (euint64) {
        return euint64.wrap(bytes32(x));
    }
}
