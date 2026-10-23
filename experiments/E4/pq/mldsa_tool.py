"""
mldsa_tool.py - thin CLI over fireblocks-labs/evm-ml-dsa-verifier's own off-chain tooling.

All cryptography is the upstream repository's code, imported read-only from its checkout:
  * tools/fixtures/vecgen.py : derive_keypair(seed)  -> Dilithium2.key_derive (NIST xofs)
                               sign_nist(sk, msg)    -> deterministic FIPS 204 sign, ctx = b""
  * prepare/prepare.py       : build(pk)             -> 20,545-byte pk blob (0x00-prefixed)
  * pythonref/dilithium_py   : Dilithium2.verify     -> local self-check of every signature

This wrapper only moves bytes around. Secrets: the 32-byte key seed is read from the environment
variable MLDSA44_SEED_HEX (never from argv, never printed). Output is one JSON object on stdout.

  python -I mldsa_tool.py --repo <checkout> pubkey
      -> {"pk": hex(1312 B), "blob": hex(20545 B)}
  python -I mldsa_tool.py --repo <checkout> sign --msg 0x<hex>
      -> {"sig": hex(2420 B), "self_verified": true}

The caller (run.mjs) keeps "sig" in memory and records only keccak256(sig).
"""
import argparse
import json
import os
import sys


def load_repo(repo):
    fixtures = os.path.join(repo, "tools", "fixtures")
    pyref = os.path.join(repo, "pythonref")
    prep = os.path.join(repo, "prepare")
    for p in (pyref, fixtures, prep):
        if not os.path.isdir(p):
            raise SystemExit(f"mldsa_tool: missing {p}")
        sys.path.insert(0, p)
    import vecgen  # noqa: E402  (repo code)
    import prepare  # noqa: E402  (repo code)
    from dilithium_py.dilithium.default_parameters import Dilithium2 as D  # noqa: E402
    from dilithium_py.shake.shake_wrapper import shake128, shake256  # noqa: E402

    return vecgen, prepare, D, shake128, shake256


def seed_from_env():
    raw = os.environ.get("MLDSA44_SEED_HEX", "").strip().removeprefix("0x")
    if len(raw) != 64:
        raise SystemExit("mldsa_tool: MLDSA44_SEED_HEX must hold 32 bytes of hex")
    return bytes.fromhex(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("pubkey")
    s = sub.add_parser("sign")
    s.add_argument("--msg", required=True)
    a = ap.parse_args()

    vecgen, prepare, D, shake128, shake256 = load_repo(a.repo)
    pk, sk = vecgen.derive_keypair(seed_from_env())
    if len(pk) != 1312:
        raise SystemExit(f"mldsa_tool: unexpected pk length {len(pk)}")

    if a.cmd == "pubkey":
        blob = prepare.build(pk)
        if len(blob) != 20545:
            raise SystemExit(f"mldsa_tool: unexpected blob length {len(blob)}")
        out = {"pk": pk.hex(), "blob": blob.hex()}
    else:
        msg = bytes.fromhex(a.msg.removeprefix("0x"))
        sig = vecgen.sign_nist(sk, msg)
        if len(sig) != 2420:
            raise SystemExit(f"mldsa_tool: unexpected signature length {len(sig)}")
        ok = D.verify(pk, msg, sig, _xof=shake256, _xof2=shake128)
        out = {"sig": sig.hex(), "self_verified": bool(ok), "msg_len": len(msg)}
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
