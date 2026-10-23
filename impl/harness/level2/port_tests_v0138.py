"""Level 2 test changes for the v0.13 line (ACL v0.4.2), applied to the wt-l2-v0138 worktree.

1. ACLSuccession.t.sol is ported from main (lifecycle/level2 a9748a6): the main-only view
   `isDelegatedForUserDecryption` does not exist on this line, so its assertions are dropped; version strings follow.
2. The Level 0 upgrade matrix runs its Level 0 steps against the ACL v0.4.1 fixture, and gains the U8 steps.
3. Version pins follow the bump (acl.t.sol, TestHostContractsDeployerTestUtils.t.sol, upgrades.ts).
Usage: python -I port_tests_v0138.py <main host-contracts dir> <v0.13.8 host-contracts dir>
"""
import sys

main_hc, bp_hc = sys.argv[1], sys.argv[2]


def edit(rel, pairs):
    p = bp_hc + "/" + rel
    s = open(p, encoding="utf-8").read()
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, (rel, old[:70], n)
        s = s.replace(old, new)
    open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("edited", rel)


# 1. ACLSuccession.t.sol
src = open(main_hc + "/test/acl/ACLSuccession.t.sol", encoding="utf-8").read()
lines = src.split("\n")
kept = [l for l in lines if "isDelegatedForUserDecryption(" not in l]
dropped = len(lines) - len(kept)
assert dropped == 9, dropped
out = "\n".join(kept)
for old, new in [
    (
        " * @notice Level 2, extension E1 (Successor) of the Decryption Authority Lifecycle draft, on ACL v0.9.0:",
        " * @notice Level 2, extension E1 (Successor) of the Decryption Authority Lifecycle draft, on the ACL v0.4.2 backport\n"
        " *         (v0.13 line; ported from main, where the main-only view `isDelegatedForUserDecryption` is also checked):",
    ),
    ('        assertEq(acl.getVersion(), "ACL v0.9.0");', '        assertEq(acl.getVersion(), "ACL v0.4.2");'),
]:
    assert out.count(old) == 1, old
    out = out.replace(old, new)
open(bp_hc + "/test/acl/ACLSuccession.t.sol", "w", encoding="utf-8", newline="\n").write(out)
print("ported test/acl/ACLSuccession.t.sol (%d main-only view lines dropped)" % dropped)

# 2. Upgrade matrix
U8 = '''    ////////////////////////////////////////////////////////////////////////////
    // U8 (Level 2): v0.4.1 -> v0.4.2 (E1 appended to the retirement namespace), and v0.4.0 -> v0.4.2 directly
    ////////////////////////////////////////////////////////////////////////////

    function test_U8_v041_to_v042_BitsPreserved_SuccessionStartsEmpty() public {
        _toV041();
        _retireThree();
        _assertEnforced();

        // The v0.4.1 guard accepts v0.4.2 (declares Core, same location); reinitializer 6 -> 7.
        _upgrade(address(new ACL()), "reinitializeV6()");

        assertEq(acl.getVersion(), "ACL v0.4.2");
        assertEq(_initializedVersion(), 7);
        _assertBaseStatePreserved();
        _assertEnforced();
        assertTrue(acl.supportsInterface(0x7dc5e209), "E1 declared");
        assertEq(acl.successorOf(retiredDelegator), address(0));
        (address pending, uint64 at, bool accepted) = acl.pendingSuccessorOf(alice);
        assertEq(pending, address(0));
        assertEq(at, 0);
        assertFalse(accepted);
        vm.prank(retiredDelegator);
        vm.expectRevert(abi.encodeWithSelector(ACL.SenderRetired.selector, retiredDelegator));
        acl.designateSuccessor(carol);
        assertFalse(acl.isHandleDelegatedForUserDecryption(retiredDelegator, bob, app, h1));
        vm.prank(alice);
        acl.designateSuccessor(carol);
        vm.prank(carol);
        acl.acceptSuccession(alice);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        acl.confirmSuccessor();
        vm.prank(alice);
        acl.retireAccount();
        assertTrue(acl.isHandleDelegatedForUserDecryption(alice, carol, app, h1));
        assertFalse(acl.isHandleDelegatedForUserDecryption(alice, bob, app, h1), "alice's own delegation to bob ends");
    }

    function test_U8_v040_to_v042_Direct() public {
        _deployProxyWith(address(new ACL_v0_4_0()));
        _seedState();
        _upgrade(address(new ACL()), "reinitializeV6()");
        assertEq(acl.getVersion(), "ACL v0.4.2");
        assertEq(_initializedVersion(), 7);
        _assertBaseStatePreserved();
        _retireThree();
        _assertEnforced();
    }

    /// @dev Zama's pattern: reinitializeV6 lands on exactly 7 from v0.4.1's version 6, and a second call reverts.
    function test_reinitializeV6SucceedsOnUpgradePath() public {
        _deployProxyWith(address(new ACL_v0_4_1()));
        assertEq(_initializedVersion(), 6);
        _upgrade(address(new ACL()), "");
        ACL(aclAdd).reinitializeV6();
        assertEq(_initializedVersion(), 7);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        ACL(aclAdd).reinitializeV6();
    }

    /// @dev Observation, not a requirement: the guard checks Core only, so it accepts a rollback from v0.4.2 to the
    ///      Core-only v0.4.1. Retirement stays enforced, and the successor's read right disappears (fail-closed, a
    ///      lockout rather than a leak). The succession record stays in the namespace and returns with v0.4.2.
    function test_U8_RollbackToCoreOnly_FailClosed_RecordKept() public {
        _deployProxyWith(address(new ACL()));
        _seedState();
        vm.prank(alice);
        acl.designateSuccessor(carol);
        vm.prank(carol);
        acl.acceptSuccession(alice);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        acl.confirmSuccessor();
        vm.prank(alice);
        acl.retireAccount();
        assertTrue(acl.isHandleDelegatedForUserDecryption(alice, carol, app, h1));

        _upgrade(address(new ACL_v0_4_1()), "");
        assertEq(acl.getVersion(), "ACL v0.4.1");
        assertTrue(acl.isAccountRetired(alice), "retirement survives the rollback");
        assertFalse(acl.isAllowed(h1, alice));
        assertFalse(acl.isHandleDelegatedForUserDecryption(alice, carol, app, h1), "no successor path in v0.4.1");

        _upgrade(address(new ACL()), "");
        assertEq(acl.successorOf(alice), carol, "the record was kept");
        assertTrue(acl.isHandleDelegatedForUserDecryption(alice, carol, app, h1));
    }

    ////////////////////////////////////////////////////////////////////////////
    // The guard does not block legitimate Core successors
    ////////////////////////////////////////////////////////////////////////////'''

edit("test/acl/ACLRetirementUpgradeMatrix.t.sol", [
    (
        'import {ACL as ACL_v0_4_1_noguard} from "./retirement/fixtures/ACL_v0_4_1_noguard.sol";\n',
        'import {ACL as ACL_v0_4_1} from "./retirement/fixtures/ACL_v0_4_1.sol";\n'
        'import {ACL as ACL_v0_4_1_noguard} from "./retirement/fixtures/ACL_v0_4_1_noguard.sol";\n',
        1,
    ),
    (
        "    function _toV041() internal {\n"
        "        _deployProxyWith(address(new ACL_v0_4_0()));\n"
        "        _seedState();\n"
        '        _upgrade(address(new ACL()), "reinitializeV5()");\n',
        "    function _toV041() internal {\n"
        "        _deployProxyWith(address(new ACL_v0_4_0()));\n"
        "        _seedState();\n"
        '        _upgrade(address(new ACL_v0_4_1()), "reinitializeV5()");\n',
        1,
    ),
    (
        "        _seedState();\n"
        '        _upgrade(address(new ACL()), "reinitializeV5()");\n'
        '        assertEq(acl.getVersion(), "ACL v0.4.1");\n',
        "        _seedState();\n"
        '        _upgrade(address(new ACL_v0_4_1()), "reinitializeV5()");\n'
        '        assertEq(acl.getVersion(), "ACL v0.4.1");\n',
        1,
    ),
    (
        '        _upgrade(address(new ACL()), "");\n'
        "        ACL(aclAdd).reinitializeV5();\n"
        "        assertEq(_initializedVersion(), 6);\n"
        "        vm.expectRevert(Initializable.InvalidInitialization.selector);\n"
        "        ACL(aclAdd).reinitializeV5();\n",
        '        _upgrade(address(new ACL_v0_4_1()), "");\n'
        "        ACL_v0_4_1(aclAdd).reinitializeV5();\n"
        "        assertEq(_initializedVersion(), 6);\n"
        "        vm.expectRevert(Initializable.InvalidInitialization.selector);\n"
        "        ACL_v0_4_1(aclAdd).reinitializeV5();\n",
        1,
    ),
    (
        "    ////////////////////////////////////////////////////////////////////////////\n"
        "    // The guard does not block legitimate Core successors\n"
        "    ////////////////////////////////////////////////////////////////////////////",
        U8,
        1,
    ),
])

# 3. Version pins
edit("test/acl/acl.t.sol", [('string(abi.encodePacked("ACL v0.4.1"))', 'string(abi.encodePacked("ACL v0.4.2"))', 1)])
edit("test/fhevm-foundry/TestHostContractsDeployerTestUtils.t.sol", [('"ACL v0.4.1", "Version mismatch"', '"ACL v0.4.2", "Version mismatch"', 1)])
edit("test/upgrades/upgrades.ts", [("to.equal('ACL v0.4.1');", "to.equal('ACL v0.4.2');", 2)])
