"""Profile Q share-collection simulation (Decryption Authority Lifecycle, TC16 / O1, Level 3).

A threshold oracle of n = 13 operators releases a user decryption when the client collects t + 1 = 5 valid shares
(t = 4). k operators enforce a restriction (here: Profile Q refusing an ECDSA-rooted request); the others answer.
Each operator may also be down, independently, with probability q.

The simulation uses real Shamir sharing over GF(2^127 - 1): a random secret, a random degree-t polynomial, one share
per operator, and Lagrange interpolation at 0 from the shares the client receives. A trial succeeds when the
reconstructed value equals the secret. This is a model of the threshold rule only: it stands in for the KMS's
threshold decryption, which is not reimplemented. It is checked two ways:
  - every k in 0..13 with q = 0: reconstruction succeeds if and only if 13 - k >= 5, that is k <= 8;
  - with outages (q = 1%, 5%): a Monte Carlo success rate per k, against the exact binomial probability
    P[Binomial(13 - k, 1 - q) >= 5].
For a restriction to stop a release it must hold at k >= n - t = 9 operators; below that, refusing operators only
remove the margin that covers outages, which is the partial-adoption cliff of TARGET_ARCHITECTURE §4.4 (b).

Usage: python -I profile_q_sim.py <out.json> [trials]
"""
import json
import math
import random
import sys

P = (1 << 127) - 1  # a Mersenne prime
N, T = 13, 4


def share(secret, rng):
    coeffs = [secret] + [rng.randrange(P) for _ in range(T)]
    return {x: sum(c * pow(x, i, P) for i, c in enumerate(coeffs)) % P for x in range(1, N + 1)}


def reconstruct(points):
    """Lagrange interpolation at 0 from any T + 1 points; None if fewer."""
    if len(points) < T + 1:
        return None
    xs = list(points)[: T + 1]
    total = 0
    for i in xs:
        num, den = 1, 1
        for j in xs:
            if j != i:
                num = num * (-j) % P
                den = den * (i - j) % P
        total = (total + points[i] * num * pow(den, P - 2, P)) % P
    return total


def trial(k, q, rng):
    secret = rng.randrange(P)
    shares = share(secret, rng)
    enforcing = set(rng.sample(range(1, N + 1), k))
    received = {x: y for x, y in shares.items() if x not in enforcing and rng.random() >= q}
    return reconstruct(received) == secret


def exact(k, q):
    m = N - k
    return sum(math.comb(m, j) * (1 - q) ** j * q ** (m - j) for j in range(T + 1, m + 1))


def main():
    out_path = sys.argv[1]
    trials = int(sys.argv[2]) if len(sys.argv) > 2 else 20_000
    rng = random.Random(20261021)
    result = {"n": N, "t": T, "field": "GF(2^127 - 1)", "trials": trials, "noOutage": [], "withOutage": []}

    # q = 0: deterministic per k (one trial per k is enough; run 50 to exercise random subsets).
    for k in range(N + 1):
        ok = [trial(k, 0.0, rng) for _ in range(50)]
        result["noOutage"].append({"k": k, "answering": N - k, "reconstructs": all(ok), "anyFailure": not all(ok) and any(ok)})
    threshold_ok = all((r["reconstructs"] == (N - r["k"] >= T + 1)) for r in result["noOutage"])
    result["rule_k_le_8_iff_reconstructs"] = threshold_ok

    for q in (0.01, 0.05):
        for k in range(N + 1):
            s = sum(trial(k, q, rng) for _ in range(trials))
            mc = s / trials
            ex = exact(k, q)
            se = math.sqrt(max(ex * (1 - ex), 1e-12) / trials)
            result["withOutage"].append(
                {"q": q, "k": k, "monteCarlo": round(mc, 5), "exact": round(ex, 6), "within4se": abs(mc - ex) <= 4 * se + 1e-9}
            )
    result["monteCarloMatchesExact"] = all(r["within4se"] for r in result["withOutage"])

    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    print("k  answering  reconstructs(q=0)  P[release] q=1% (exact / MC)   q=5% (exact / MC)")
    for k in range(N + 1):
        a = result["noOutage"][k]
        o1 = next(r for r in result["withOutage"] if r["q"] == 0.01 and r["k"] == k)
        o5 = next(r for r in result["withOutage"] if r["q"] == 0.05 and r["k"] == k)
        print(f"{k:2d}  {a['answering']:9d}  {str(a['reconstructs']):17s}  {o1['exact']:.6f} / {o1['monteCarlo']:.5f}        {o5['exact']:.6f} / {o5['monteCarlo']:.5f}")
    print("rule (k <= 8 iff reconstruction):", threshold_ok, "| Monte Carlo within 4 SE of exact:", result["monteCarloMatchesExact"])


if __name__ == "__main__":
    main()
