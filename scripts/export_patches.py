"""Export every lifecycle branch of the two Zama clones as `git format-patch` series, and check each one.

Usage: python -I scripts/export_patches.py <fhe-authority-lifecycle dir> <out dir>

For each series below, the commits base..tip go to <out dir>/<series>/. The check: on a temporary index holding the
base tree, `git apply --cached` of the series, in order, must give exactly the tree of tip. The base of a series is a
commit of Zama's (a tag or the pinned commit) or the tip of another series, as the table in the README says.
Nothing is pushed or fetched.
"""
import os
import subprocess
import sys
import tempfile

SERIES = [
    # (clone, series dir, base, tip, applies after)
    ("fhevm-main", "level0/main", "lifecycle/base", "lifecycle/level0", "main `ed851716c`"),
    ("fhevm-main", "level1/main", "lifecycle/level0", "lifecycle/level1", "`level0/main`"),
    ("fhevm-main", "level2/main", "lifecycle/level0", "lifecycle/level2", "`level0/main`"),
    ("fhevm-main", "level3/main", "lifecycle/level2", "lifecycle/level3", "`level2/main`"),
    ("fhevm-main", "level3/verifier", "cce53bbb0", "lifecycle/level3-verifier",
     "the first 4 patches of `level1/main` (commit `cce53bb`)"),
    ("fhevm-main", "level3/connector", "a15aaa67a", "lifecycle/level3-connector",
     "the first 7 patches of `level1/main` (commit `a15aaa6`)"),
    ("fhevm-main", "phase4/sdk-status", "lifecycle/level2", "lifecycle/phase4-sdk-status", "`level2/main`"),
    ("fhevm-main", "phase5/connector", "lifecycle/level3-connector", "lifecycle/phase5-connector",
     "`level3/connector`"),
    ("fhevm-main", "level0/v0.14.4", "v0.14.4", "lifecycle/level0-v0.14", "tag `v0.14.4` (`ccdd1ce0`)"),
    ("fhevm-v0.13.8", "level0/v0.13.8", "lifecycle/base", "lifecycle/level0", "tag `v0.13.8` (`fe3ca89b5`)"),
    ("fhevm-v0.13.8", "level0/v0.13.8-mock", "lifecycle/level0", "lifecycle/level0-mock", "`level0/v0.13.8`"),
    ("fhevm-v0.13.8", "level2/v0.13.8", "lifecycle/level0-mock", "lifecycle/level2", "`level0/v0.13.8-mock`"),
    ("fhevm-v0.13.8", "level2/v0.13.8-mock", "lifecycle/level2", "lifecycle/level2-mock", "`level2/v0.13.8`"),
    ("fhevm-v0.13.8", "level3/v0.13.8", "lifecycle/level2", "lifecycle/level3", "`level2/v0.13.8`"),
]


def git(clone, *args, env=None, input=None):
    return subprocess.run(["git", "-C", clone, *args], capture_output=True, text=True, check=True, env=env,
                          input=input, encoding="utf-8").stdout.strip()


def main():
    root, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    rows = []
    bad = 0
    for clone_name, series, base, tip, after in SERIES:
        clone = os.path.join(root, "impl", clone_name)
        target = os.path.join(out, *series.split("/"))
        os.makedirs(target, exist_ok=True)
        if os.listdir(target):
            raise SystemExit(f"{target} is not empty")
        base_sha = git(clone, "rev-parse", base)
        tip_sha = git(clone, "rev-parse", tip)
        files = git(clone, "format-patch", "--no-signature", "--output-directory", os.path.abspath(target),
                    f"{base_sha}..{tip_sha}").splitlines()
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, GIT_INDEX_FILE=os.path.join(tmp, "index"))
            git(clone, "read-tree", base_sha, env=env)
            for f in files:
                git(clone, "apply", "--cached", os.path.abspath(f), env=env)
            tree = git(clone, "write-tree", env=env)
        ok = tree == git(clone, "rev-parse", f"{tip_sha}^{{tree}}")
        bad += 0 if ok else 1
        subjects = [git(clone, "log", "-1", "--format=%s", c) for c in
                    git(clone, "rev-list", "--reverse", f"{base_sha}..{tip_sha}").splitlines()]
        rows.append((series, clone_name, after, base_sha[:9], tip_sha[:9], len(files), ok, subjects))
        print(f"{'ok  ' if ok else 'DIFF'} {series}: {len(files)} patches, {base_sha[:9]}..{tip_sha[:9]}")
    md = ["# Patches, by level", "",
          "Our local commits on Zama's `fhevm` repository, exported with `git format-patch` by "
          "`scripts/export_patches.py`. Apply each series with `git am`, in the order below, on a clone of "
          "`zama-ai/fhevm`. Nothing here has been pushed or proposed anywhere. The code is Zama's (BSD 3-Clause "
          "Clear) with our changes; see `NOTICE`.", "",
          "Bases: `main` = `ed851716c9a6b799996a23399ece2858336f96db`; tag `v0.13.8` = "
          "`fe3ca89b5111ca2b4abb220bf3c78417b821ceb5`; tag `v0.14.4` = `ccdd1ce0`.", "",
          "| Series | Apply after | Commits | Base → tip | Rebuilds the branch tree |", "|---|---|---|---|---|"]
    for series, clone_name, after, b, t, n, ok, _ in rows:
        md.append(f"| `{series}/` | {after} | {n} | `{b}` → `{t}` | {'yes' if ok else '**no**'} |")
    md += ["", "**The commits of each series:**", ""]
    for series, _, _, _, _, _, _, subjects in rows:
        md.append(f"- `{series}/`: " + "; ".join(f"`{s}`" for s in subjects))
    md += ["", "**Checked.** On a temporary index holding each series' base tree, `git apply --cached` of the series, "
           "in order, gives exactly the tree of the branch it was exported from.", "",
           "How to reproduce each level: `results/level{0,1,2,3}/README.md` and the Phase 4 reports in "
           "`results/phase4/`."]
    with open(os.path.join(out, "README.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md) + "\n")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
