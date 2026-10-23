"""K8 share check (Decryption Authority Lifecycle, Phase 4, P1.1).

Input: the `K8-NODES` lines of the crate test `tests/k8.rs` (13 nodes, t = 4). Each line names a deployment, the
library with the injected fault, a parameter set, and the nodes that accepted the forged request.

For every line, the forged request gets a share only from the nodes that accepted it. The shares come from real Shamir
sharing over GF(2^127 - 1), with the `share` and `reconstruct` functions of the Phase 3 simulation
(`impl/harness/level3/profile_q_sim.py`, unchanged). The forgery decrypts if the accepting nodes' shares reconstruct
the secret, which needs t + 1 = 5 of them. Like the Phase 3 simulation, this is a model of the threshold rule only;
it does not reimplement the KMS's threshold decryption.

Usage: python -I k8_sim.py <k8_crate_output.txt> <out.json>
"""
import importlib.util
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SIM = os.path.join(HERE, "..", "level3", "profile_q_sim.py")


def load_sim():
    spec = importlib.util.spec_from_file_location("profile_q_sim", SIM)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    src, out = sys.argv[1], sys.argv[2]
    sim = load_sim()
    rng = random.Random(20261021)
    rows = []
    with open(src, encoding="utf-8") as f:
        for line in f:
            # libtest may print the test's name on the same line as its first output.
            at = line.find("K8-NODES ")
            if at < 0:
                continue
            row = json.loads(line[at + len("K8-NODES "):])
            secret = rng.randrange(sim.P)
            shares = sim.share(secret, rng)
            received = {x: shares[x] for x in row["accepting"]}
            row["shares"] = len(received)
            row["forgery_decrypts"] = sim.reconstruct(received) == secret
            rows.append(row)
    summary = {}
    for r in rows:
        key = r["deployment"]
        s = summary.setdefault(key, {"k8_single_ok": r["k8_single_ok"], "cases": 0, "max_accepting": 0, "decrypts": 0})
        s["cases"] += 1
        s["max_accepting"] = max(s["max_accepting"], r["shares"])
        s["decrypts"] += int(r["forgery_decrypts"])
    result = {"n": sim.N, "t": sim.T, "field": "GF(2^127 - 1)", "source": os.path.basename(src), "rows": rows, "summary": summary}
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    print("deployment        k8_single_ok  cases  max accepting nodes  forgeries that decrypt")
    for k, s in summary.items():
        print(f"{k:17s} {str(s['k8_single_ok']):13s} {s['cases']:5d}  {s['max_accepting']:19d}  {s['decrypts']:22d}")
    for r in rows:
        if r["forgery_decrypts"]:
            print(f"  decrypts: {r['deployment']} faulty={r['faulty']} {r['scheme']} accepting={r['accepting']}")


if __name__ == "__main__":
    main()
