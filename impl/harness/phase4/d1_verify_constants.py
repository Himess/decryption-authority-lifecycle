"""D1: recompute every constant in the ERC with Foundry's `cast` and compare.

Usage: python -I d1_verify_constants.py <cast executable> <ERC.md> <out.md>

Checks:
1. every "`signature` ... `0x…`" pair in the text: 4-byte values with `cast sig`, 32-byte values (event topics) with
   `cast keccak`;
2. each interface identifier of the Test vectors table: the XOR of the selectors listed in its row;
3. the EIP-712 type hashes and domain separator of E2;
4. the certificate vector: the chain-list hash, the struct hash, the digest, the two accounts of the public test
   mnemonic, and the signature (`cast wallet sign --no-hash` with the public test mnemonic, index 0);
5. the reference implementation's ERC-7201 location (`cast index-erc7201`).
The public test mnemonic is the one the ERC prints; no other key is used.
"""
import re
import subprocess
import sys

cast, erc_path, out_path = sys.argv[1:4]
text = open(erc_path, encoding="utf-8").read()
MNEMONIC = "test test test test test test test test test test test junk"
rows = []


def run(*args):
    return subprocess.run([cast, *args], capture_output=True, text=True, check=True).stdout.strip()


def check(what, stated, computed):
    ok = stated.lower() == computed.lower()
    rows.append((what, stated, computed, "ok" if ok else "**MISMATCH**"))


# 1. signature/value pairs.
pairs = re.findall(r"`([A-Za-z_][A-Za-z0-9_]*\([^`]*\))`[^`\n]{0,16}?`(0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{8})`", text)
seen = set()
for sig, value in pairs:
    if (sig, value) in seen:
        continue
    seen.add((sig, value))
    if len(value) == 10:
        check(f"selector {sig}", value, run("sig", sig))
    else:
        check(f"topic {sig}", value, run("keccak", sig))

# Constants the text names without a backticked signature next to them.
check("ERC-1271 magic value: selector isValidSignature(bytes32,bytes)", "0x1626ba7e", run("sig", "isValidSignature(bytes32,bytes)"))
assert "0x1626ba7e" in text and "0xffffffff" in text
rows.append(("ERC-165's invalid interface id (fixed by ERC-165, not computed)", "0xffffffff", "0xffffffff", "ok"))

# 2. interface identifiers.
table = re.search(r"\| Interface \| Functions \| Identifier \|\n\|---\|---\|---\|\n((?:\|.*\|\n)+)", text).group(1)
for line in table.strip().split("\n"):
    cells = [c.strip() for c in line.strip("|").split("|")]
    sels = re.findall(r"`(0x[0-9a-fA-F]{8})`", cells[1])
    x = 0
    for s in sels:
        x ^= int(s, 16)
    stated = re.search(r"`(0x[0-9a-fA-F]{8})`", cells[2]).group(1)
    check(f"interface id {cells[0]} (XOR of {len(sels)} selectors)", stated, f"0x{x:08x}")

# 3. EIP-712.
def stated_after(label):
    return re.search(label + r"[^=]*=\s*(0x[0-9a-fA-F]{64})", text, flags=re.S).group(1)


domain_typehash = run("keccak", "EIP712Domain(string name,string version)")
retire_typehash = run("keccak", "RetireAccount(address account,address successor,uint256[] chainIds)")
check("DOMAIN_TYPEHASH", stated_after(r"DOMAIN_TYPEHASH  = keccak256\(\"EIP712Domain\(string name,string version\)\"\)\n"), domain_typehash)
check("RETIRE_TYPEHASH", stated_after(r"RETIRE_TYPEHASH  = keccak256\(\"RetireAccount"), retire_typehash)
enc = run("abi-encode", "f(bytes32,bytes32,bytes32)", domain_typehash,
          run("keccak", "DecryptionAuthorityLifecycle"), run("keccak", "1"))
domain_separator = run("keccak", enc)
check("DOMAIN_SEPARATOR", stated_after(r"DOMAIN_SEPARATOR = keccak256\(abi\.encode\(DOMAIN_TYPEHASH,"), domain_separator)

# 4. The certificate vector.
vec = re.search(r"account    = (0x[0-9a-fA-F]{40})\nsuccessor  = (0x[0-9a-fA-F]{40})\nchainIds   = \[([0-9, ]+)\]", text)
account, successor, chains = vec.group(1), vec.group(2), [int(c) for c in vec.group(3).split(",")]
check("vector account = test mnemonic index 0", account, run("wallet", "address", "--mnemonic", MNEMONIC, "--mnemonic-index", "0"))
check("vector successor = test mnemonic index 1", successor, run("wallet", "address", "--mnemonic", MNEMONIC, "--mnemonic-index", "1"))
packed = "0x" + "".join(f"{c:064x}" for c in chains)
chains_hash = run("keccak", packed)
check("keccak256(abi.encodePacked(chainIds))", re.search(r"keccak256\(abi\.encodePacked\(chainIds\)\)\n\s+= (0x[0-9a-fA-F]{64})", text).group(1), chains_hash)
struct_hash = run("keccak", run("abi-encode", "f(bytes32,address,address,bytes32)", retire_typehash, account, successor, chains_hash))
check("structHash", re.search(r"structHash = (0x[0-9a-fA-F]{64})", text).group(1), struct_hash)
digest = run("keccak", "0x1901" + domain_separator[2:] + struct_hash[2:])
check("digest", re.search(r"digest     = (0x[0-9a-fA-F]{64})", text).group(1), digest)
sig_lines = re.search(r"signature  = (0x[0-9a-fA-F]+)\n\s+([0-9a-fA-F]+)\n\s+([0-9a-fA-F]+)", text)
stated_sig = sig_lines.group(1) + sig_lines.group(2) + sig_lines.group(3)
check("signature (cast wallet sign --no-hash, index 0)", stated_sig,
      run("wallet", "sign", "--no-hash", "--mnemonic", MNEMONIC, "--mnemonic-index", "0", digest))

# 5. ERC-7201 location of the reference implementation.
loc = re.search(r"namespace `([^`]+)`, at location `(0x[0-9a-fA-F]{64})`", text)
check(f"ERC-7201 location of {loc.group(1)}", loc.group(2), run("index-erc7201", loc.group(1)))

ok = sum(1 for r in rows if r[3] == "ok")
md = ["# D1: the ERC's constants recomputed with `cast`", "", f"`{run('--version').splitlines()[0]}`; ERC file checked: "
      "`erc/ERC-XXXX-decryption-authority-lifecycle.md`.", "",
      "| Constant | Stated | Recomputed | Result |", "|---|---|---|---|"]
md += [f"| {w} | `{s}` | `{c}` | {r} |" for w, s, c, r in rows]
md += ["", f"{ok} of {len(rows)} match."]
open(out_path, "w", encoding="utf-8", newline="\n").write("\n".join(md) + "\n")
print(f"{ok} of {len(rows)} match")
for r in rows:
    if r[3] != "ok":
        print("MISMATCH", r)
