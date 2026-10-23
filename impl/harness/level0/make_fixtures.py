"""Generate ACL version fixtures for the Level 0 upgrade matrix.

Each fixture is a verbatim copy of an ACL.sol release source. Only these edits
are made, all mechanical and all listed in the fixture header:
  1. relative imports are re-pointed to the same files, relative to the
     fixture directory, so the file compiles from test/;
  2. for the "noguard" fixture only, the body of _authorizeUpgrade is replaced
     by the empty body of the pre-Level-0 releases (hazard demo, U3);
  3. for the "drift" fixture only, the retirement namespace and its location
     constant are replaced (U4b, storage-level namespace drift);
  4. for the "attribution" fixture only, the exemption compare in isAllowed is
     removed (gas attribution only; never deployed by a behavioural test);
  5. a fixture listed in EVENTS_OVERRIDE imports its own copy of ACLEvents.sol
     (a release whose events differ from the tree's), itself a verbatim fixture.
Usage: python -I make_fixtures.py <out_dir> <name>=<source_file>|<label> ...
"""
import hashlib, re, sys

# Fixtures live in host-contracts/test/acl/retirement/fixtures/, four levels below host-contracts/.
# Plain relative paths keep one compilation unit per shared file (the @fhevm-host-contracts/=./ remapping
# would compile them again under a leading-slash unit name).
UP = "../../../../"
IMPORT_MAP = [
    ('"./shared/', '"' + UP + 'contracts/shared/'),
    ('"./interfaces/', '"' + UP + 'contracts/interfaces/'),
    ('"./bridge/', '"' + UP + 'contracts/bridge/'),
    ('"./ACLEvents.sol"', '"' + UP + 'contracts/ACLEvents.sol"'),
    ('"../addresses/', '"' + UP + 'addresses/'),
]

# Fixtures whose release has its own ACLEvents.sol (lifecycle Phase 4: the v0.13 line's E1 release, ACL v0.4.2).
EVENTS_OVERRIDE = {"ACL_v0_4_2": "ACLEvents_v0_4_2"}

LOCATION = "0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200"
# cast index-erc7201 "fhevm.storage.ACLRetirementDrift"
DRIFT_LOCATION = "0x5df21c0a24c69ebf2f807724d197e5ef7dbf96250398a7678bd6e664197d7100"
NAMESPACE = "fhevm.storage.ACLRetirement"
DRIFT_NAMESPACE = "fhevm.storage.ACLRetirementDrift"

GUARD_RE = re.compile(
    r"(function _authorizeUpgrade\(address )newImplementation(\) internal virtual override onlyOwner )\{.*?\n    \}\n",
    re.S,
)
NAMESPACE_RE = re.compile(re.escape(NAMESPACE) + r"(?![A-Za-z])")


def git_blob_hash(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def main():
    out_dir = sys.argv[1]
    for spec in sys.argv[2:]:
        name, rest = spec.split("=", 1)
        src, label = rest.split("|", 1)
        raw = open(src, "rb").read()
        text = raw.decode("utf-8")
        edits = []
        if name in EVENTS_OVERRIDE:
            own = f'"./{EVENTS_OVERRIDE[name]}.sol"'
            n = text.count('"./ACLEvents.sol"')
            assert n == 1, n
            text = text.replace('"./ACLEvents.sol"', own)
            edits.append(f'1 import path(s) "./ACLEvents.sol" -> {own} (the events of that release, a fixture too)')
        for old, new in IMPORT_MAP:
            n = text.count(old)
            if n:
                text = text.replace(old, new)
                edits.append(f"{n} import path(s) {old} -> {new}")
        if name.endswith("_drift"):
            n1 = text.count(LOCATION)
            assert n1 == 1, n1
            text = text.replace(LOCATION, DRIFT_LOCATION)
            text, n2 = NAMESPACE_RE.subn(DRIFT_NAMESPACE, text)
            edits.append(
                f"retirement namespace {NAMESPACE} -> {DRIFT_NAMESPACE} "
                f"({n1} location constant, {n2} namespace mention(s))"
            )
        if name.endswith("_attribution"):
            # Gas attribution only: v0.8.0 with the executor-exemption compare removed from isAllowed, so that
            # (attribution - v0.7.0) is the dispatcher/layout cost and (v0.8.0 - attribution) is the compare.
            old_body = (
                "        if (msg.sender != FHEVM_EXECUTOR_ADDRESS && _retired().retired[account]) {\n"
                "            return false;\n"
                "        }\n"
                "        return allowedTransient(handle, account) || _getACLStorage().persistedAllowedPairs[handle][account];\n"
            )
            new_body = "        return allowedTransient(handle, account) || _getACLStorage().persistedAllowedPairs[handle][account];\n"
            assert text.count(old_body) == 1
            text = text.replace(old_body, new_body)
            edits.append("isAllowed: executor-exemption compare and retirement read removed (gas attribution only)")
        if name.endswith("_noguard"):
            text, n = GUARD_RE.subn(r"\1_newImplementation\2{}\n", text)
            assert n == 1, "guard not found"
            edits.append("_authorizeUpgrade body emptied (pre-Level-0 shape), guard removed")
        lines = text.split("\n")
        assert lines[0].startswith("// SPDX"), lines[0]
        header = [
            "// TEST FIXTURE, generated by impl/harness/level0/make_fixtures.py. Do not edit by hand.",
            f"// Source: {label}",
            f"// Source git blob: {git_blob_hash(raw)}",
            "// Edits (mechanical, nothing else changed):",
        ] + [f"//   - {e}" for e in edits]
        out = "\n".join([lines[0]] + header + lines[1:])
        path = f"{out_dir}/{name}.sol"
        open(path, "w", encoding="utf-8", newline="\n").write(out)
        print(f"{name}.sol: blob {git_blob_hash(raw)}; {len(edits)} edit(s)")


if __name__ == "__main__":
    main()
