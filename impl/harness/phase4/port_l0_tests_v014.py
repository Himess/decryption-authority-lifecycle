"""Port main's Level 0 retirement tests (cherry-picked from 8e2cd34b) to the 0.14 line (ACL v0.5.0 -> v0.5.1).

Usage: python -I port_l0_tests_v014.py <worktree host-contracts dir>

Every edit is an exact string replacement that must match once (or the stated number of times). The upgrade matrix is
replaced as a whole by test/acl/ACLRetirementUpgradeMatrix.t.sol written for this line (see that file's header), so it
is not edited here. What changes, and why:
  - the baseline fixture is ACL v0.5.0 (tag v0.14.4) instead of v0.7.0 (main), and the attribution fixture is
    ACL v0.5.1 without the exemption compare;
  - ACL v0.5.x has no `isDelegatedForUserDecryption` (main added it after v0.14). The tests rebuild its answer from the
    retirement-gated `getUserDecryptionDelegationExpirationDate` rows (`_isDelegated`), and the gas test drops its
    measurement of that view;
  - version strings and comments name v0.5.0 / v0.5.1;
  - ACL v0.5.0 pause-gates `revokeDelegationForUserDecryption` (main does not), so the revocation test expects
    `EnforcedPause` while paused and revokes after the unpause.
"""
import pathlib
import sys

HELPER = '''
    /// @dev [0.14 line] ACL v0.5.x has no `isDelegatedForUserDecryption` (main added it after v0.14). Its answer is
    ///      rebuilt as main computes it: false for a retired contract, else the wildcard row or the per-contract row is
    ///      active (the expiration getter already refuses a retired delegator or delegate).
    function _isDelegated(ACL a, address from, address to, address contractAddress) internal view returns (bool) {
        // main's view refuses a retired contract before it reads the wildcard row; the expiration getter of the wildcard
        // row cannot see the contract, so the check is made here (a low-level call: v0.5.0 has no retirement view).
        (bool ok, bytes memory ret) = address(a).staticcall(abi.encodeWithSignature("isAccountRetired(address)", contractAddress));
        if (ok && ret.length == 32 && abi.decode(ret, (bool))) {
            return false;
        }
        return
            a.getUserDecryptionDelegationExpirationDate(from, to, a.WILDCARD_DELEGATION_ADDRESS()) >
            block.timestamp ||
            a.getUserDecryptionDelegationExpirationDate(from, to, contractAddress) > block.timestamp;
    }
'''

PAUSE_OLD = '    /// @dev Unchanged surfaces stay callable by a retired account (c.6): revocation (also while paused on main) and\n    ///      signature invalidation.\n    function test_RetiredAccountCanStillRevokeAndInvalidate() public {\n        uint64 expiry = uint64(block.timestamp + 1 days);\n        vm.prank(delegator);\n        acl.delegateForUserDecryption(delegate, app, expiry);\n        _retire(delegator);\n        vm.roll(block.number + 1);\n        vm.prank(pauser);\n        acl.pause();\n        vm.prank(delegator);\n        acl.revokeDelegationForUserDecryption(delegate, app);\n        vm.prank(owner);\n        acl.unpause();'
PAUSE_NEW = '    /// @dev Unchanged surfaces stay callable by a retired account (c.6): revocation and signature invalidation.\n    ///      [0.14 line] Revocation is pause-gated in ACL v0.5.0 (main lifted that later), for every account alike, so\n    ///      a retired account revokes once the ACL is unpaused.\n    function test_RetiredAccountCanStillRevokeAndInvalidate() public {\n        uint64 expiry = uint64(block.timestamp + 1 days);\n        vm.prank(delegator);\n        acl.delegateForUserDecryption(delegate, app, expiry);\n        _retire(delegator);\n        vm.roll(block.number + 1);\n        vm.prank(pauser);\n        acl.pause();\n        vm.prank(delegator);\n        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);\n        acl.revokeDelegationForUserDecryption(delegate, app);\n        vm.prank(owner);\n        acl.unpause();\n        vm.prank(delegator);\n        acl.revokeDelegationForUserDecryption(delegate, app);'

EDITS = {
    "test/acl/ACLRetirement.t.sol": [
        ('import {ACL as ACL_v0_7_0} from "./retirement/fixtures/ACL_v0_7_0.sol";',
         'import {ACL as ACL_v0_5_0} from "./retirement/fixtures/ACL_v0_5_0.sol";', 1),
        ("acl.isDelegatedForUserDecryption(", "_isDelegated(acl, ", 9),
        ('assertEq(a.isDelegatedForUserDecryption(x, y, z), b.isDelegatedForUserDecryption(x, y, z), "isDelegated");',
         'assertEq(_isDelegated(a, x, y, z), _isDelegated(b, x, y, z), "isDelegated");', 1),
        ("    function _retiredSlot(address account) internal pure returns (bytes32) {",
         HELPER.lstrip("\n") + "\n    function _retiredSlot(address account) internal pure returns (bytes32) {", 1),
        ("/// @dev Since v0.8.0 the guard refuses EmptyUUPSProxyACL", "/// @dev Since v0.5.1 the guard refuses EmptyUUPSProxyACL", 1),
        ("// c.11 item 5 (differential, never-retired): v0.8.0 answers exactly as v0.7.0",
         "// c.11 item 5 (differential, never-retired): v0.5.1 answers exactly as v0.5.0", 1),
        ("/// @dev Same random operation sequence on a v0.7.0 proxy (fixture) and a v0.8.0 proxy",
         "/// @dev Same random operation sequence on a v0.5.0 proxy (fixture) and a v0.5.1 proxy", 1),
        ("function test_Differential_NeverRetiredMatchesV070(", "function test_Differential_NeverRetiredMatchesV050(", 1),
        ("ACL base = _deployStandaloneProxy(address(new ACL_v0_7_0()));",
         "ACL base = _deployStandaloneProxy(address(new ACL_v0_5_0()));", 1),
        (PAUSE_OLD, PAUSE_NEW, 1),
    ],
    "test/acl/ACLRetirementExemption.t.sol": [
        ('assertTrue(acl.isDelegatedForUserDecryption(control, recipient, app), "control can delegate");',
         'assertTrue(_isDelegated(acl, control, recipient, app), "control can delegate");', 1),
        ("                        sel != ACL.isDelegatedForUserDecryption.selector &&\n", "", 1),
        ("    function _acc(address a) internal pure returns (RetirementTestAccount) {",
         HELPER.lstrip("\n") + "\n    function _acc(address a) internal pure returns (RetirementTestAccount) {", 1),
    ],
    "test/acl/ACLRetirementGas.t.sol": [
        ('import {ACL as ACL_v0_7_0} from "./retirement/fixtures/ACL_v0_7_0.sol";',
         'import {ACL as ACL_v0_5_0} from "./retirement/fixtures/ACL_v0_5_0.sol";', 1),
        ('import {ACL as ACL_v0_8_0_attribution} from "./retirement/fixtures/ACL_v0_8_0_attribution.sol";',
         'import {ACL as ACL_v0_5_1_attribution} from "./retirement/fixtures/ACL_v0_5_1_attribution.sol";', 1),
        ("ACL_v0_7_0()", "ACL_v0_5_0()", None),
        ("ACL_v0_8_0_attribution()", "ACL_v0_5_1_attribution()", None),
        ('''    function _mIsDelegated(bool level0) internal returns (uint256) {
        _deployStack(level0);
        _setUpDelegation();
        _cool();
        assertTrue(ACL(aclAdd).isDelegatedForUserDecryption(delegator, delegate, app));
        return _gas();
    }

''', "", 1),
        ('        _compare("isDelegatedForUserDecryption (true)", _mIsDelegated);\n', "", 1),
        ("v0.7.0", "v0.5.0", None),
        ("v0.8.0", "v0.5.1", None),
        ("main ed851716c, fixture", "tag v0.14.4, fixture", None),
    ],
}


def main():
    root = pathlib.Path(sys.argv[1])
    for rel, edits in EDITS.items():
        p = root / rel
        s = p.read_text(encoding="utf-8")
        for old, new, count in edits:
            n = s.count(old)
            if count is None:
                assert n >= 1, (rel, old[:60])
            else:
                assert n == count, (rel, old[:60], n, count)
            s = s.replace(old, new)
        p.write_text(s, encoding="utf-8", newline="\n")
        print(f"{rel}: {len(edits)} edit rule(s)")


if __name__ == "__main__":
    main()
