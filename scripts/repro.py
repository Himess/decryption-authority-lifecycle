"""Reproduce the public results from a clean clone of this repository (the Makefile's targets call it).

Usage: python3 scripts/repro.py <level0|level0-mock|conformance|profile-a|pq-drill|amsterdam|connector-proof> [--work DIR]

Requirements: git, Foundry 1.8.5 (forge, anvil, cast), Node 22 with npm, Python 3.11, bash (on Windows, Git Bash:
run this from a Git Bash shell). Zama's code is not in this repository: the targets clone zama-ai/fhevm into
impl/fhevm-main and impl/fhevm-v0.13.8 at the pinned commits, apply the series in patches/ with `git am`, and run the
suites there. Each clone records the series applied to it (.git/lifecycle-series); a later target extends that stack
when it can, and otherwise resets the clone to the pinned commit and applies its own, so the targets run in any order. Every step is checked: a failed set-up step, a failing test or a test count other
than the documented one stops the target with a message. Logs go to the work directory (default repro-out/), never
over the committed results.
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FHEVM = "https://github.com/zama-ai/fhevm.git"
LINES = {
    "main": ("ed851716c9a6b799996a23399ece2858336f96db", ["level0/main"]),
    "v0.13.8": ("fe3ca89b5111ca2b4abb220bf3c78417b821ceb5", ["level0/v0.13.8"]),
}
EXTRA = {  # series stacked for a target, per line
    "level0-mock": {"v0.13.8": ["level0/v0.13.8-mock"]},
    "conformance": {"main": ["level2/main", "level3/main"]},
    "profile-a": {"main": ["level2/main", "level3/main"]},
    # The SDK series touches only sdk/js-sdk/src, so it stacks after level3/main and the other main targets still run.
    "pq-drill": {"main": ["level2/main", "level3/main", "phase4/sdk-status"]},
}
# The on-chain ML-DSA-44 verifier's repository (MIT, unaudited). Its Solidity sources are vendored in
# impl/p3-operator-ratification/vendor/; the drill's signer uses its Python reference and key preparation from a checkout.
MLDSA_VERIFIER = ("https://github.com/fireblocks-labs/evm-ml-dsa-verifier.git", "cca262b537a5ac2ee55efb427e5c61de0308e566")
# The signer's Python dependencies, at the versions of the venv that produced the results. polyntt is the NTT the
# verifier's Python reference imports, pinned as its pythonref/requirements.txt pins it (z3-solver, the other entry
# there, serves only its formal checks).
SIGNER_PIP = ["eth-abi==5.2.0", "eth-hash[pycryptodome]==0.8.0", "pycryptodome==3.23.0", "eth-utils==6.0.0",
              "eth-typing==6.0.0", "parsimonious==0.10.0",
              "polyntt @ git+https://github.com/ZKNoxHQ/NTT.git@3ac5f5dc0b204e91df4f68e347ade2bd4a82bb37"
              "#subdirectory=assets/pythonref/"]


def tool(name):
    path = shutil.which(name)
    if path is None:
        sys.exit(f"{name} not found on PATH")
    if os.name == "nt" and name == "bash" and os.path.normcase(path).startswith(
            os.path.normcase(os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32"))):
        sys.exit("bash resolves to the WSL launcher in System32; run this from a Git Bash shell")
    return path


def run(cmd, cwd=None, env=None, log=None):
    if not os.path.isabs(cmd[0]):
        cmd = [tool(cmd[0]), *cmd[1:]]
    print("$", " ".join(cmd), flush=True)
    with open(log, "w", encoding="utf-8") if log else open(os.devnull, "w") as fh:
        p = subprocess.run(cmd, cwd=cwd, env=env, stdout=fh if log else None, stderr=subprocess.STDOUT if log else None)
    if p.returncode != 0:
        sys.exit(f"failed ({p.returncode}): {' '.join(cmd)}" + (f"; see {log}" if log else ""))


def clone(line, extra_series):
    commit, series = LINES[line]
    stack = series + extra_series
    path = os.path.join(ROOT, "impl", f"fhevm-{line}")
    marker = os.path.join(path, ".git", "lifecycle-series")
    if not os.path.isdir(os.path.join(path, ".git")):
        run(["git", "clone", "-c", "core.autocrlf=false", "-c", "core.longpaths=true", "--filter=blob:none",
             "--no-checkout", FHEVM, path])
        run(["git", "-C", path, "checkout", "-b", "lifecycle/base", commit])
        run(["git", "-C", path, "checkout", "-b", "lifecycle/repro"])
        applied = []
    else:
        applied = open(marker).read().split() if os.path.exists(marker) else None
        if applied is None:
            sys.exit(f"{path} was not made by this script (no {marker}). Move it aside and rerun.")
        if applied == stack:
            return path
        if applied != stack[:len(applied)]:
            # Another target's series are applied. The documented counts hold for this target's stack only, so the
            # clone goes back to the pinned commit and gets exactly this stack (it is this script's clone).
            print(f"note: {path} holds {applied}; resetting it to the pinned commit for {stack}", flush=True)
            run(["git", "-C", path, "checkout", "-q", "lifecycle/repro"])
            run(["git", "-C", path, "reset", "-q", "--hard", "lifecycle/base"])
            applied = []
            with open(marker, "w", encoding="utf-8") as f:
                f.write("")
    env = dict(os.environ, GIT_COMMITTER_NAME="repro", GIT_COMMITTER_EMAIL="repro@localhost")
    for s in stack[len(applied):]:
        patches = sorted(glob.glob(os.path.join(ROOT, "patches", *s.split("/"), "*.patch")))
        if not patches:
            sys.exit(f"no patches in patches/{s}")
        run(["git", "-C", path, "am", "--quiet", *patches], env=env)
        applied.append(s)
        with open(marker, "w", encoding="utf-8") as f:
            f.write("\n".join(applied) + "\n")
    return path


def forge_counts(log):
    """(passed, failed, skipped) from the last summary line of a forge test log, or None."""
    text = open(log, encoding="utf-8", errors="replace").read()
    found = re.findall(r"(\d+) tests passed, (\d+) failed, (\d+) skipped", text)
    return tuple(int(x) for x in found[-1]) if found else None


def expect(log, passed=None, skipped=0):
    """Stops unless the log reports no failure and, when given, exactly `passed` and `skipped` tests."""
    got = forge_counts(log)
    if got is None or got[1] != 0 or (passed is not None and got != (passed, 0, skipped)):
        want = f"({passed}, 0, {skipped})" if passed is not None else "no failure"
        sys.exit(f"unexpected result in {log}: {got} (passed, failed, skipped); expected {want}")
    print(f"ok: {got[0]} passed, {got[1]} failed, {got[2]} skipped ({os.path.basename(log)})", flush=True)


def baseline(line, log_dir, passed=None):
    """Zama's host-contracts set-up and ACL suites on a clone (impl/harness/baselineA_host_contracts.sh), checked."""
    os.makedirs(log_dir, exist_ok=True)
    run(["bash", os.path.join(ROOT, "impl", "harness", "baselineA_host_contracts.sh"), line, "acl"],
        env=dict(os.environ, LOG_DIR=log_dir))
    check_baseline(line, log_dir, passed)


def check_baseline(line, log_dir, passed=None):
    summary = os.path.join(log_dir, f"A_fhevm-{line}_summary.txt")
    text = open(summary, encoding="utf-8", errors="replace").read()
    steps = dict(re.findall(r"^(\S+) rc=(\d+) ", text, re.M))
    # With isolation on (Foundry 1.8's default), Zama's transient-storage tests fail by design; that run is a record.
    failed = [s for s, rc in steps.items() if rc != "0" and not s.endswith("_isolate-default")]
    if not steps or failed:
        sys.exit(f"{line}: failed steps {failed or '(none recorded)'}; see {summary}. A registry or network error can be "
                 "transient: rerun the target.")
    dirty = text.split("git status (must be empty):", 1)[-1].strip()
    if dirty:
        print(f"note: {line}'s clone is not clean after the run:\n{dirty}", flush=True)
    expect(os.path.join(log_dir, f"A_fhevm-{line}_forge_test_acl_isolate-false.log"), passed)


def level0(work):
    for line, passed in (("main", 143), ("v0.13.8", 128)):  # test/acl/*, FOUNDRY_ISOLATE=false
        clone(line, [])
        baseline(line, os.path.join(work, "level0"), passed)
    print("Level 0 reproduced; summaries in", os.path.join(work, "level0"))


def level0_mock(work):
    """The vendor's cleartext mock end to end through its SDK, with the Core (results/level0/MOCK_E2E.md)."""
    tool("jq")
    clone("v0.13.8", EXTRA["level0-mock"]["v0.13.8"])
    setup, raw = os.path.join(work, "level0-mock-setup"), os.path.join(work, "level0-mock")
    os.makedirs(setup, exist_ok=True)
    env = dict(os.environ, LOG_DIR=setup)
    # Installs the SDK's and the contracts' dependencies and runs the cleartext round trip (a local anvil on
    # HARNESS_PORT, default 18557); a fresh local test mnemonic goes to impl/harness/.env, which git ignores.
    run(["bash", os.path.join(ROOT, "impl", "harness", "baselineB_cleartext.sh"), "v0.13.8"], env=env)
    run(["bash", os.path.join(ROOT, "impl", "harness", "level0-mock", "run_mock_e2e.sh")],
        env=dict(env, MOCK_RAW_DIR=raw, MOCK_EXPECTED_BRANCH="lifecycle/repro"))
    text = open(os.path.join(raw, "M_vitest.log"), encoding="utf-8", errors="replace").read()
    if not re.search(r"Tests\s+15 passed \(15\)", text):
        sys.exit(f"expected 15 of 15 scenarios; see {os.path.join(raw, 'M_vitest.log')}")
    print("Level 0 mock reproduced: 15 of 15 scenarios. Logs in", raw)


def conformance(work):
    os.makedirs(work, exist_ok=True)
    port = os.path.join(ROOT, "impl", "fhenix-port")
    run(["forge", "test", "--match-path", "test/conformance/*"], cwd=port, log=os.path.join(work, "kit_fhenix.log"))
    expect(os.path.join(work, "kit_fhenix.log"), 14, 4)
    run(["forge", "test"], cwd=port, log=os.path.join(work, "fhenix_port_suite.log"))
    expect(os.path.join(work, "fhenix_port_suite.log"), 69, 4)
    path = clone("main", EXTRA["conformance"]["main"])
    baseline("main", os.path.join(work, "zama-main-setup"))
    run(["forge", "test", "--match-path", "test/conformance/*"], cwd=os.path.join(path, "host-contracts"),
        env=dict(os.environ, FOUNDRY_ISOLATE="false"), log=os.path.join(work, "kit_zama_main.log"))
    expect(os.path.join(work, "kit_zama_main.log"), 17, 1)
    run([sys.executable, os.path.join(ROOT, "conformance", "install.py"), ROOT, "--check"])
    print("Conformance reproduced: the Fhenix port and Zama main pass the kit; every copy of the kit is identical. Logs in",
          work)


def profile_a(work):
    """Profile A on stock OpenZeppelin confidential-contracts 0.5.3 (results/phase4/P1_4_PROFILE_A_STOCK.md)."""
    path = clone("main", EXTRA["profile-a"]["main"])
    hc = os.path.join(path, "host-contracts")
    if not (os.path.isdir(os.path.join(hc, "dependencies", "forge-std-1.11.0"))
            and os.path.isdir(os.path.join(hc, "node_modules", "@openzeppelin", "contracts"))):
        baseline("main", os.path.join(work, "zama-main-setup"))  # installs the tree's dependencies
    os.makedirs(work, exist_ok=True)
    log = os.path.join(work, "profile_a_stock.log")
    run(["forge", "test", "-vv"], cwd=os.path.join(ROOT, "impl", "p14-oz-stock"),
        env=dict(os.environ, FOUNDRY_ISOLATE="false"), log=log)
    expect(log, 14)
    print("Profile A on stock OpenZeppelin reproduced. Log:", log)


def pq_drill(work):
    """Part B's local drill under Osaka (results/phase5/B1_B6_PATHS.md, PQ_DRILL_LOCAL.md): the three paths with the real
    carry tool, watchtower and canary, the old key's transactions, the SDK, B5 and the B8 receipts; 81 rows.

    Steps: the main clone with the SDK series; Zama's dependencies (host-contracts for the tools' ethers, the SDK's
    for vitest); the verifier repository at cca262b5 for the signer; a venv with the signer's pinned packages; the
    wallet, the owner contract and E4's gas meter built; one run, analysed. The connector part needs a Linux host with
    Rust and Postgres; its steps are printed at the end."""
    path = clone("main", EXTRA["pq-drill"]["main"])
    hc = os.path.join(path, "host-contracts")
    if not os.path.isdir(os.path.join(hc, "node_modules", "ethers")):
        baseline("main", os.path.join(work, "zama-main-setup"))  # installs host-contracts' dependencies
    sdk = os.path.join(path, "sdk", "js-sdk")
    os.makedirs(work, exist_ok=True)
    if not os.path.isdir(os.path.join(sdk, "node_modules", "vitest")):
        run(["npm", "ci", "--no-audit", "--no-fund"], cwd=sdk, log=os.path.join(work, "pq-drill-sdk-npm-ci.log"))
    verifier = os.path.join(ROOT, "impl", ".tools", "evm-ml-dsa-verifier")
    url, commit = MLDSA_VERIFIER
    if not os.path.isdir(os.path.join(verifier, ".git")):
        run(["git", "clone", "-c", "core.autocrlf=false", "--no-checkout", url, verifier])
        run(["git", "-C", verifier, "checkout", "--detach", commit])
    head = subprocess.run(["git", "-C", verifier, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    if head != commit:
        sys.exit(f"{verifier} is at {head}, not {commit}")
    venv = os.path.join(work, "pq-signer-venv")
    vpy = os.path.join(venv, "Scripts", "python.exe") if os.name == "nt" else os.path.join(venv, "bin", "python")
    if not os.path.exists(vpy):
        run([sys.executable, "-m", "venv", venv])
        run([vpy, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", *SIGNER_PIP],
            log=os.path.join(work, "pq-signer-pip.log"))
    for d in ("pq-wallet", "p3-operator-ratification"):
        run(["forge", "build"], cwd=os.path.join(ROOT, "impl", d), log=os.path.join(work, f"pq-drill-build-{d}.log"))
    meter = os.path.join(work, "gas-meter")  # E4's meter, built with the settings of its own project
    os.makedirs(os.path.join(meter, "src"), exist_ok=True)
    shutil.copy(os.path.join(ROOT, "experiments", "contracts", "src", "Erc1271GasMeter.sol"), os.path.join(meter, "src"))
    with open(os.path.join(meter, "foundry.toml"), "w", encoding="utf-8") as f:
        f.write('[profile.default]\nsrc = "src"\nout = "out"\nsolc_version = "0.8.30"\nevm_version = "osaka"\n'
                'optimizer = true\noptimizer_runs = 10000\nvia_ir = true\nbytecode_hash = "none"\n')
    run(["forge", "build"], cwd=meter, log=os.path.join(work, "pq-drill-build-gas-meter.log"))
    runs = os.path.join(work, "pq-drill")
    n = 1 + sum(1 for x in glob.glob(os.path.join(runs, "osaka-repro*")))
    env = dict(os.environ, PQL_SDK=path, PQL_SDK_BRANCH="lifecycle/repro", PQL_OUT_ROOT=runs, PQL_PYTHON=sys.executable,
               PQL_MLDSA_PY=vpy, PQL_MLDSA_REPO=verifier,
               PQL_METER_ART=os.path.join(meter, "out", "Erc1271GasMeter.sol", "Erc1271GasMeter.json"))
    run(["bash", os.path.join(ROOT, "impl", "harness", "phase5", "pq-drill-local", "run_pq_drill_local.sh"), "osaka",
         f"repro{n}"], env=env, log=os.path.join(work, f"pq-drill-osaka-repro{n}.log"))
    out = os.path.join(runs, f"osaka-repro{n}")
    vitest = open(os.path.join(out, "vitest.log"), encoding="utf-8", errors="replace").read()
    if not re.search(r"Tests\s+9 passed \(9\)", vitest):
        sys.exit(f"expected 9 of 9 tests; see {os.path.join(out, 'vitest.log')}")
    run([sys.executable, "-I", os.path.join(ROOT, "impl", "harness", "phase5", "analyze_pq_drill_local.py"),
         os.path.join(runs, "analysis.json"), os.path.join(runs, "analysis.md"), out])
    md = open(os.path.join(runs, "analysis.md"), encoding="utf-8").read()
    if "Rows conforming: 81/81 (81 seen in every run)" not in md:
        sys.exit(f"expected 81 of 81 conforming rows; see {os.path.join(runs, 'analysis.md')}")
    print("Part B's local drill reproduced under Osaka: 9 of 9 tests, 81 of 81 rows as designed. Output in", out)
    print("Local-Amsterdam: set PQL_ANVIL_AMSTERDAM to the anvil of the Foundry nightly named in results/phase4/ENV.md\n"
          "and run impl/harness/phase5/pq-drill-local/run_pq_drill_local.sh amsterdam <id> with the same environment.\n"
          "The connector drill (the kms-worker; results/phase5/PQ_DRILL_MATRIX.md) needs a Linux host with Rust and\n"
          "Postgres: impl/harness/phase5/vps/setup_l5_tree.sh, then run_pq_drill.sh through chain_pq_drill.sh; the\n"
          "generator is impl/harness/phase5/make_pq_drill_tests.py and the analysis analyze_pq_drill.py.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", choices=["level0", "level0-mock", "conformance", "profile-a", "amsterdam",
                                       "connector-proof", "pq-drill"])
    ap.add_argument("--work", default=os.path.join(ROOT, "repro-out"))
    a = ap.parse_args()
    a.work = os.path.abspath(a.work)  # the scripts it calls change directory
    for name in ("git", "forge", "anvil", "node", "npm", "bash"):
        tool(name)
    if a.target == "level0":
        level0(a.work)
    elif a.target == "level0-mock":
        level0_mock(a.work)
    elif a.target == "conformance":
        conformance(a.work)
    elif a.target == "profile-a":
        profile_a(a.work)
    elif a.target == "pq-drill":
        pq_drill(a.work)
    elif a.target == "amsterdam":
        print("Amsterdam receipts need the Foundry nightly named in results/phase4/ENV.md and the Level 0-3 build\n"
              "artifacts; the steps are in results/phase4/P2_4_AMSTERDAM.md (impl/harness/phase4/p24_amsterdam.sh).")
    else:
        print("The real-verifier proof runs Zama's kms-worker against a local chain on a Linux host with Rust and a\n"
              "local Postgres; the steps are in results/level0/README.md section 5 and results/level0/CONNECTOR_PROOF.md.")


if __name__ == "__main__":
    main()
