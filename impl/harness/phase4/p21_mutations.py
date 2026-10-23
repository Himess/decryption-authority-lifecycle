"""P2.1 mutation check: every Core gate of the Fhenix port, removed one at a time, must make the suite fail.

Usage: python -I p21_mutations.py <impl/fhenix-port> <forge executable> <output dir>

Each mutation replaces one exact text (which must occur exactly once) in one source file, runs `forge test` in the
project, and records the outcome. The original bytes are kept in memory and written back in a `finally` block; after
every mutation the file's SHA-256 is checked against the original. A mutation is "caught" when at least one test
fails; one that does not compile is reported as such (and counts as not caught, so the list must be fixed).
Writes <output dir>/MUTATIONS.md and one log per mutation.
"""
import hashlib
import os
import re
import subprocess
import sys

MUTATIONS = [
    ("M01", "use view: isAllowed ignores retirement", "src/ACL.sol",
     "if (_isRetired(account)) {\n            return false;\n        }\n        return allowedTransient(handle, account)",
     "return allowedTransient(handle, account)"),
    ("M02", "use view, persistent form: persistAllowed ignores retirement", "src/ACL.sol",
     "if (_isRetired(account)) {\n            return false;\n        }\n        ACLStorage storage $ = _getACLStorage();\n"
     "        return $.persistedAllowedPairs[handle][account];",
     "ACLStorage storage $ = _getACLStorage();\n        return $.persistedAllowedPairs[handle][account];"),
    ("M03", "use view, transient form: allowedTransient ignores retirement", "src/ACL.sol",
     "return !_isRetired(account) && _allowedTransientRaw(handle, account);",
     "return _allowedTransientRaw(handle, account);"),
    ("M04", "R7: allow without the requester gate", "src/ACL.sol",
     "    function allow(uint256 handle, address account, address requester) public virtual {\n"
     "        if (msg.sender != _taskManager()) {\n            revert DirectAllowForbidden(msg.sender);\n        }\n"
     "        _requireNotRetired(requester);\n",
     "    function allow(uint256 handle, address account, address requester) public virtual {\n"
     "        if (msg.sender != _taskManager()) {\n            revert DirectAllowForbidden(msg.sender);\n        }\n"),
    ("M05", "R7: shareCtHash without the sharer gate", "src/ACL.sol",
     "        _requireNotRetired(sharer); // [lifecycle] R7: the sharer is the grantor\n", ""),
    ("M06", "on-behalf view ignores retirement", "src/ACL.sol",
     "        if (_isRetired(account) || _isRetired(delegatee) || _isRetired(contractAddress)) {\n"
     "            return false;\n        }\n", ""),
    ("M07", "permit view ignores retirement", "src/ACL.sol",
     "        if (_permitPartyRetired(acp)) {\n            return false;\n        }\n", ""),
    ("M08", "permit validity probe ignores retirement", "src/ACL.sol",
     "return super.checkPermissionValidity(acp) && !_permitPartyRetired(acp);",
     "return super.checkPermissionValidity(acp);"),
    ("M09", "upgrade guard without the location check", "src/ACL.sol",
     "        if (!ok || ret.length != 32 || abi.decode(ret, (bytes32)) != ACL_RETIREMENT_STORAGE_LOCATION) {\n"
     "            revert UpgradeDropsRetirement(_newImplementation);\n        }\n", ""),
    ("M10", "upgrade guard without the ERC-165 check", "src/ACL.sol",
     "        if (!ok || ret.length != 32 || abi.decode(ret, (uint256)) != 1) {\n"
     "            revert UpgradeDropsRetirement(_newImplementation);\n        }\n", ""),
    ("M11", "retireAccount twice does not revert", "src/ACL.sol",
     "        if ($.retired[msg.sender]) {\n            revert AccountAlreadyRetired(msg.sender);\n        }\n", ""),
    ("M12", "the operand check open to every caller", "src/ACL.sol",
     "    function isAllowedForOperand(uint256 handle, address account) external view virtual returns (bool) {\n"
     "        if (msg.sender != _taskManager()) {\n            revert DirectAllowForbidden(msg.sender);\n        }\n",
     "    function isAllowedForOperand(uint256 handle, address account) external view virtual returns (bool) {\n"),
    ("M13", "ERC-165 does not declare Core", "src/ACL.sol",
     "return interfaceId == DAL_CORE_INTERFACE_ID || super.supportsInterface(interfaceId);",
     "return super.supportsInterface(interfaceId);"),
    ("M14", "TaskManager: non-computation ids also take the dedicated check", "src/TaskManager.sol",
     "bool allowed = (NOT_ENGINE_COMPUTATION >> uint8(funcId)) & 1 == 0", "bool allowed = true"),
    ("M15", "TaskManager: operands take the gated use view (no exemption)", "src/TaskManager.sol",
     "            ? acl.isAllowedForOperand(ctHash, msg.sender)\n", "            ? acl.isAllowed(ctHash, msg.sender)\n"),
    ("M16", "share registry: validity ignores retirement", "src/ACPShareRegistry.sol",
     "        (bool known, bool retired) = _retirementOf(header.issuer);\n        if (!known || retired) return false;\n"
     "        (known, retired) = _retirementOf(header.recipient);\n        if (!known || retired) return false;\n", ""),
    ("M17", "share registry: a retired issuer may post", "src/ACPShareRegistry.sol",
     "        if (retired) revert SenderRetired(acp.issuer);\n", ""),
]

SUMMARY = re.compile(r"(\d+) tests passed, (\d+) failed, (\d+) skipped")


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    root, forge, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    rows = []
    for mid, what, rel, old, new in MUTATIONS:
        path = os.path.join(root, rel)
        with open(path, "rb") as f:
            original = f.read()
        text = original.decode("utf-8")
        count = text.count(old)
        if count != 1:
            rows.append((mid, what, rel, f"NOT APPLIED (text found {count} times)", "-", "-"))
            continue
        try:
            with open(path, "wb") as f:
                f.write(text.replace(old, new).encode("utf-8"))
            proc = subprocess.run([forge, "test"], cwd=root, capture_output=True, text=True, encoding="utf-8",
                                  errors="replace")
            log = proc.stdout + proc.stderr
        finally:
            with open(path, "wb") as f:
                f.write(original)
        with open(path, "rb") as f:
            assert sha(f.read()) == sha(original), f"{rel} was not restored"
        with open(os.path.join(out, f"{mid}.log"), "w", encoding="utf-8", newline="\n") as f:
            f.write(log)
        m = SUMMARY.search(log)
        if "Compiler run failed" in log or not m:
            rows.append((mid, what, rel, "DID NOT COMPILE", "-", "-"))
            continue
        passed, failed = int(m.group(1)), int(m.group(2))
        # A fuzz failure's bracket holds a counterexample with its own brackets: take the test name after it.
        failing = sorted(set(re.findall(r"^\[FAIL.*\] (test\w+)\(", log, flags=re.MULTILINE)))
        rows.append((mid, what, rel, "caught" if failed else "NOT CAUGHT", f"{passed}/{failed}",
                     ", ".join(failing[:6]) + (" ..." if len(failing) > 6 else "")))
        print(mid, rows[-1][3], rows[-1][4], flush=True)
    md = ["# P2.1 mutation check (generated by impl/harness/phase4/p21_mutations.py)", "",
          "Each row removes one Core gate from the port, runs the whole suite, and restores the file (SHA-256 checked).",
          "", "| Id | Mutation | File | Outcome | Passed/failed | Failing tests (first six) |", "|---|---|---|---|---|---|"]
    md += [f"| {r[0]} | {r[1]} | `{r[2]}` | {r[3]} | {r[4]} | {r[5]} |" for r in rows]
    caught = sum(1 for r in rows if r[3] == "caught")
    md += ["", f"Caught: {caught} of {len(rows)}."]
    with open(os.path.join(out, "MUTATIONS.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md) + "\n")
    print(f"caught {caught} of {len(rows)}")


if __name__ == "__main__":
    main()
