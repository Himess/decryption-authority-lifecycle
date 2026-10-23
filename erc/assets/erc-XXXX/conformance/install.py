"""Installs the registry conformance kit into each registry project and checks that every copy is identical.

Usage: python -I conformance/install.py <fhe-authority-lifecycle dir> [--check]

Copies conformance/DecryptionAuthorityLifecycle.t.sol into each project's test directory listed below, and the whole
kit directory into the ERC's assets. With --check nothing is written: every copy must equal the canonical file byte
for byte (exit 1 otherwise). The adapters live next to the copies, in each project.

Zama's trees are not part of this repository. A Zama project is installed into or checked where it is checked out:
the local worktree, or the clone that scripts/repro.py makes (impl/fhevm-<line>). Where neither is present, it is
skipped. The copy that the level3 patch series add to Zama's trees is always checked, from the patch files themselves.
"""
import glob
import hashlib
import os
import shutil
import sys

KIT = os.path.join("conformance", "DecryptionAuthorityLifecycle.t.sol")
ASSETS = os.path.join("erc", "assets", "erc-XXXX", "conformance")
TEST_DIR = os.path.join("host-contracts", "test", "conformance")
PROJECTS = {  # name: (candidate directories, required). Installing uses the first whose project exists; checking
    # compares the first that holds a copy. A required project must hold one.
    "Zama main (lifecycle/level3)": ([os.path.join("impl", "wt-l2-main", TEST_DIR),
                                      os.path.join("impl", "fhevm-main", TEST_DIR)], False),
    "Zama v0.13 line (lifecycle/level3)": ([os.path.join("impl", "wt-l3-v0138", TEST_DIR),
                                            os.path.join("impl", "fhevm-v0.13.8", TEST_DIR)], False),
    "Fhenix CoFHE port": ([os.path.join("impl", "fhenix-port", "test", "conformance")], True),
}
SERIES = {  # name: the patch series that adds the kit to a Zama tree
    "Zama main series": os.path.join("patches", "level3", "main"),
    "Zama v0.13 series": os.path.join("patches", "level3", "v0.13.8"),
}
KIT_IN_TREE = "host-contracts/test/conformance/DecryptionAuthorityLifecycle.t.sol"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def kit_from_series(series_dir):
    """The kit's bytes as a patch in the series adds it (a new file: one hunk of '+' lines), or None."""
    for path in sorted(glob.glob(os.path.join(series_dir, "*.patch"))):
        lines = open(path, "rb").read().split(b"\n")
        start = None
        for i, line in enumerate(lines):
            if line == f"diff --git a/{KIT_IN_TREE} b/{KIT_IN_TREE}".encode():
                start = i
                break
        if start is None:
            continue
        out, in_hunk = [], False
        for line in lines[start + 1:]:
            if line.startswith(b"diff --git ") or line == b"-- ":
                break
            if line.startswith(b"@@ "):
                in_hunk = True
            elif in_hunk and line.startswith(b"+"):
                out.append(line[1:] + b"\n")
            elif in_hunk and line.startswith(b"\\ No newline at end of file") and out:
                out[-1] = out[-1][:-1]
        return b"".join(out)
    return None


def main():
    root = sys.argv[1]
    check = "--check" in sys.argv[2:]
    canonical = open(os.path.join(root, KIT), "rb").read()
    want = sha(canonical)
    bad = 0
    for name, (candidates, required) in PROJECTS.items():
        if check:
            rel = next((c for c in candidates if os.path.exists(os.path.join(root, c, os.path.basename(KIT)))), None)
        else:
            rel = next((c for c in candidates if os.path.isdir(os.path.join(root, os.path.dirname(c)))), None)
        if rel is None and required:
            rel = candidates[0]
        if rel is None:
            print(f"skip {name}: no copy here ({' or '.join(candidates)})")
            continue
        dst = os.path.join(root, rel, os.path.basename(KIT))
        if not check:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(os.path.join(root, KIT), dst)
        got = sha(open(dst, "rb").read()) if os.path.exists(dst) else "missing"
        ok = got == want
        bad += 0 if ok else 1
        print(f"{'ok  ' if ok else 'DIFF'} {name}: {rel} {got[:16]}")
    for name, series in SERIES.items():
        data = kit_from_series(os.path.join(root, series))
        got = sha(data) if data is not None else "missing"
        ok = got == want
        bad += 0 if ok else 1
        print(f"{'ok  ' if ok else 'DIFF'} {name}: {series} {got[:16]}")
    # The ERC's assets hold a copy of the whole kit directory (Test Cases); every file must match.
    kit_dir = os.path.join(root, os.path.dirname(KIT))
    for dirpath, dirnames, files in os.walk(kit_dir):
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(dirpath, f), kit_dir)
            src = os.path.join(kit_dir, rel)
            dst = os.path.join(root, ASSETS, rel)
            if not check:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copyfile(src, dst)
            ok = os.path.exists(dst) and sha(open(dst, "rb").read()) == sha(open(src, "rb").read())
            bad += 0 if ok else 1
            if not ok:
                print(f"DIFF ERC assets: {os.path.join(ASSETS, rel)}")
    print(f"ERC assets ({ASSETS}): {'ok' if not bad else 'see above'}")
    print(f"kit sha256 {want}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
