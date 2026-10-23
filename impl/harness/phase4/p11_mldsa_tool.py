"""
p11_mldsa_tool.py - ML-DSA-44/65/87 keys and signatures for the P1.1 (E3, KDA route) connector tests.

All cryptography is dilithium-py (pure Python FIPS 204, unaudited) as vendored in the fireblocks-labs/evm-ml-dsa-verifier
checkout (`pythonref/dilithium_py`, the copy E4's signer uses), imported read-only. Dilithium2/3/5 there are the FIPS 204
parameter sets ML-DSA-44/65/87: `key_derive` is FIPS 204 KeyGen_internal from a 32-byte seed, `sign` is Algorithm 2 with
an empty context (pure ML-DSA, M' = 0 || 0 || M), deterministic (rnd = 0^32), and `verify` is Algorithm 3. The NIST
SHAKE wrappers are passed explicitly, as in E4's `sign_nist`.

This tool shares no code with the Rust verifiers it feeds (RustCrypto ml-dsa, fips204, libcrux, PQClean).

Secrets: the 32-byte seed is read from MLDSA_SEED_HEX (never from argv, never printed). One JSON object on stdout.

  python -I p11_mldsa_tool.py --repo <checkout> pubkey --scheme ML-DSA-65
      -> {"scheme": "ML-DSA-65", "pk": hex}
  python -I p11_mldsa_tool.py --repo <checkout> sign --scheme ML-DSA-65 --msg 0x<hex>
      -> {"scheme": "ML-DSA-65", "sig": hex, "self_verified": true, "msg_len": n}
"""
import argparse
import json
import os
import sys

LENGTHS = {"ML-DSA-44": (1312, 2420), "ML-DSA-65": (1952, 3309), "ML-DSA-87": (2592, 4627)}


def load(repo, scheme):
    pyref = os.path.join(repo, "pythonref")
    if not os.path.isdir(os.path.join(pyref, "dilithium_py")):
        raise SystemExit(f"p11_mldsa_tool: missing {pyref}/dilithium_py")
    sys.path.insert(0, pyref)
    from dilithium_py.dilithium.default_parameters import Dilithium2, Dilithium3, Dilithium5  # noqa: E402
    from dilithium_py.shake.shake_wrapper import shake128, shake256  # noqa: E402

    d = {"ML-DSA-44": Dilithium2, "ML-DSA-65": Dilithium3, "ML-DSA-87": Dilithium5}[scheme]
    return d, shake128, shake256


def seed_from_env():
    raw = os.environ.get("MLDSA_SEED_HEX", "").strip().removeprefix("0x")
    if len(raw) != 64:
        raise SystemExit("p11_mldsa_tool: MLDSA_SEED_HEX must hold 32 bytes of hex")
    return bytes.fromhex(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pubkey")
    p.add_argument("--scheme", required=True, choices=sorted(LENGTHS))
    s = sub.add_parser("sign")
    s.add_argument("--scheme", required=True, choices=sorted(LENGTHS))
    s.add_argument("--msg", required=True)
    a = ap.parse_args()

    d, shake128, shake256 = load(a.repo, a.scheme)
    pk, sk = d.key_derive(seed_from_env(), _xof=shake256, _xof2=shake128)
    pk_len, sig_len = LENGTHS[a.scheme]
    if len(pk) != pk_len:
        raise SystemExit(f"p11_mldsa_tool: unexpected {a.scheme} pk length {len(pk)}")
    if a.cmd == "pubkey":
        out = {"scheme": a.scheme, "pk": pk.hex()}
    else:
        msg = bytes.fromhex(a.msg.removeprefix("0x"))
        sig = d.sign(sk, msg, ctx=b"", deterministic=True, _xof=shake256, _xof2=shake128)
        if len(sig) != sig_len:
            raise SystemExit(f"p11_mldsa_tool: unexpected {a.scheme} signature length {len(sig)}")
        ok = d.verify(pk, msg, sig, ctx=b"", _xof=shake256, _xof2=shake128)
        out = {"scheme": a.scheme, "sig": sig.hex(), "self_verified": bool(ok), "msg_len": len(msg)}
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
