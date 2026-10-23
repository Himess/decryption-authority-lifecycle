"""Release-train check for the ACL's reinitializer numbers (Decryption Authority Lifecycle, Phase 3 decision #17).

A UUPS upgrade runs the new release's `reinitializeV*()` through OpenZeppelin's `reinitializer(N)`, which reverts unless
N is greater than the proxy's current version. A release that can be upgraded *to* from another release must therefore
carry a larger number than every release it can come *from*. Zama's CI checks that a version changes, not that it
grows; this script checks the growth along every plausible upgrade path.

Usage (from fhe-authority-lifecycle/):
  python -I scripts/check_reinitializer_order.py                  # the releases as they are on our branches
  python -I scripts/check_reinitializer_order.py --proposal       # with the proposed numbers for lifecycle releases
  python -I scripts/check_reinitializer_order.py --json out.json  # also write the table and the edges

Each release is read from git (`git show <rev>:host-contracts/contracts/ACL.sol`); its version, reinitializer, lifecycle
Core (`retireAccount()`), E1 (`designateSuccessor`) and E2 (`retireAccountWithSig`) come from the source.

Plausible upgrade paths (from -> to), all of them:
  1. lines only move forward: v0.13 (ACL 0.4.x) -> v0.14 (0.5.x) -> main (0.7.0 and our 0.8+);
  2. within a line, the version grows;
  3. a release with the lifecycle Core only goes to a release with the Core (its upgrade guard refuses any other), and
     never to a lower lifecycle level (an upgrade must not drop E1 or E2: OpenZeppelin's validator reports the
     dropped fields, and the guard does not catch it);
  4. a Core-less release (Zama's) may go to any later release;
  5. for each line, a *projected* next Zama release (Core-less, the line's highest Zama number plus one, as Zama
     numbers them) may go to every lifecycle release on that line or a later one: a deployment that took Zama's next
     release, or a lifecycle release rebased on it, must still upgrade.
Every edge must satisfy reinit(to) > reinit(from). Exit code 1 if one does not.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACL = "host-contracts/contracts/ACL.sol"

# (name, clone under impl/, git revision, line index, origin)
RELEASES = [
    ("zama v0.13.8", "fhevm-v0.13.8", "fe3ca89b5", 0, "zama"),
    ("lifecycle/level0 (v0.13)", "fhevm-v0.13.8", "lifecycle/level0", 0, "lifecycle"),
    ("lifecycle/level2 (v0.13)", "fhevm-v0.13.8", "lifecycle/level2", 0, "lifecycle"),
    ("lifecycle/level3 (v0.13)", "fhevm-v0.13.8", "lifecycle/level3", 0, "lifecycle"),
    ("zama v0.14.4", "fhevm-main", "v0.14.4", 1, "zama"),
    ("lifecycle/level0-v0.14", "fhevm-main", "lifecycle/level0-v0.14", 1, "lifecycle"),
    ("zama main ed851716c", "fhevm-main", "ed851716c", 2, "zama"),
    ("lifecycle/level0 (main)", "fhevm-main", "lifecycle/level0", 2, "lifecycle"),
    ("lifecycle/level1 (main)", "fhevm-main", "lifecycle/level1", 2, "lifecycle"),
    ("lifecycle/level2 (main)", "fhevm-main", "lifecycle/level2", 2, "lifecycle"),
    ("lifecycle/level3 (main)", "fhevm-main", "lifecycle/level3", 2, "lifecycle"),
    ("lifecycle/level3-verifier (main)", "fhevm-main", "lifecycle/level3-verifier", 2, "lifecycle"),
    ("lifecycle/level3-connector (main)", "fhevm-main", "lifecycle/level3-connector", 2, "lifecycle"),
]
LINES = ["v0.13", "v0.14", "main"]


def proposed(line, level):
    """The proposal: lifecycle releases take numbers from 1000 up, ordered by line, then by level. Zama's releases keep
    their own numbers (5, 6, 8 today) and have about 990 numbers of room below."""
    return 1000 + 100 * line + 10 * (level + 1)


def read(clone, rev):
    src = subprocess.run(["git", "-C", str(ROOT / "impl" / clone), "show", f"{rev}:{ACL}"],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout
    nums = {k: int(v) for k, v in re.findall(r"(MAJOR|MINOR|PATCH)_VERSION = (\d+);", src)}
    reinit = int(re.search(r"REINITIALIZER_VERSION = (\d+);", src).group(1))
    core = "function retireAccount()" in src
    e1 = "function designateSuccessor" in src
    e2 = "function retireAccountWithSig" in src
    level = (2 if e2 else 1 if e1 else 0) if core else -1
    commit = subprocess.run(["git", "-C", str(ROOT / "impl" / clone), "rev-parse", "--short=9", rev],
                            capture_output=True, text=True, check=True).stdout.strip()
    return {"version": f"{nums['MAJOR']}.{nums['MINOR']}.{nums['PATCH']}", "reinit": reinit, "core": core,
            "level": level, "commit": commit}


def vkey(v):
    return tuple(int(x) for x in v.split("."))


def main():
    use_proposal = "--proposal" in sys.argv
    out_json = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    rel = []
    seen = set()
    for name, clone, rev, line, origin in RELEASES:
        r = read(clone, rev)
        r.update(name=name, line=line, origin=origin)
        if use_proposal and r["core"]:
            r["reinit_actual"] = r["reinit"]
            r["reinit"] = proposed(line, r["level"])
        key = (r["line"], r["version"], r["level"], r["reinit"])
        r["duplicate_of"] = next((x["name"] for x in rel if (x["line"], x["version"], x["level"], x["reinit"]) == key), None)
        rel.append(r)
    print(f"{'release':36s} {'commit':10s} {'line':6s} {'ACL':8s} {'Core':5s} {'level':6s} reinit")
    for r in rel:
        lvl = {-1: "-", 0: "L0", 1: "E1", 2: "E2"}[r["level"]]
        extra = f" (was {r['reinit_actual']})" if "reinit_actual" in r else ""
        dup = f"  same ACL as {r['duplicate_of']}" if r["duplicate_of"] else ""
        print(f"{r['name']:36s} {r['commit']:10s} {LINES[r['line']]:6s} {r['version']:8s} {str(r['core']):5s} {lvl:6s} "
              f"{r['reinit']}{extra}{dup}")

    for line in range(len(LINES)):
        top = max(r["reinit"] if "reinit_actual" not in r else -1 for r in rel if r["line"] == line and r["origin"] == "zama")
        rel.append({"name": f"zama next {LINES[line]} (projected)", "commit": "-", "version": "-", "reinit": top + 1,
                    "core": False, "level": -1, "line": line, "origin": "projected", "duplicate_of": None})
        print(f"{rel[-1]['name']:36s} {'-':10s} {LINES[line]:6s} {'-':8s} {'False':5s} {'-':6s} {top + 1}")
    distinct = [r for r in rel if not r["duplicate_of"]]
    edges, bad = [], []
    for a in distinct:
        for b in distinct:
            if a is b or b["line"] < a["line"] or b["origin"] == "projected":
                continue
            if a["origin"] == "projected":
                if not b["core"]:
                    continue
            elif b["line"] == a["line"] and vkey(b["version"]) <= vkey(a["version"]):
                continue
            if a["core"] and (not b["core"] or b["level"] < a["level"]):
                continue
            ok = b["reinit"] > a["reinit"]
            edges.append({"from": a["name"], "to": b["name"], "from_reinit": a["reinit"], "to_reinit": b["reinit"], "ok": ok})
            if not ok:
                bad.append(edges[-1])
    print(f"\nplausible upgrade edges: {len(edges)}; violations: {len(bad)}")
    for e in bad:
        print(f"  VIOLATION {e['from']} ({e['from_reinit']}) -> {e['to']} ({e['to_reinit']}): "
              f"reinitializer({e['to_reinit']}) reverts on a proxy at version {e['from_reinit']}")
    if out_json:
        Path(out_json).write_text(json.dumps({"proposal": use_proposal, "releases": rel, "edges": edges}, indent=1),
                                  encoding="utf-8")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
