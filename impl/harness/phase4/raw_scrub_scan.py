"""Scrub and secret-scan raw run output copied back from the VPS (Phase 4; brief §1.1 and the export exclusions).

Usage: python -I raw_scrub_scan.py <dir> <report.txt> [--scan-only]
Environment: SCRUB_HOSTNAMES, a comma-separated list of host names to replace (read from the environment, so they
appear in no command line and no report).

1. Scrub, in place, every text file under <dir>:
   - each listed host name becomes `VPS`;
   - every IPv4 address other than 127.0.0.1 and 0.0.0.0 becomes `<ip>`;
   - ANSI colour codes are removed (the tracing output's colours; the text is unchanged).
   With --scan-only nothing is rewritten: the scan runs on the files as they are (for raw data already filed).
2. Scan every file for secret classes and machine identifiers, and write per-class counts to <report.txt>. For a
   secret class the report names the file and line only, never the content. Exit 1 if a secret class has a hit.
"""
import os
import re
import sys

ANSI = re.compile(r"\x1b\[[0-9;]*m")
IPV4 = re.compile(r"(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])")

SECRET_CLASSES = {
    "mnemonic-word": re.compile(r"(?i)\bmnemonic\b(?!-random)"),
    "private-key-word": re.compile(r"(?i)private[ _-]?key"),
    "hex-secret": re.compile(r"(?i)(secret|seed|priv|\bsk\b)[^\n]{0,24}?\b(0x)?[0-9a-f]{64}\b"),
    "password-assignment": re.compile(r"(?i)\b(password|passwd)\b\s*[=:]\s*\S+"),
    "url-credentials": re.compile(r"\b[a-z][a-z0-9+.-]*://[^/\s:@]+:[^/\s@]+@"),
}
# A libtest or vitest result line names a test, never a value (e.g. Zama's `test_private_key_is_redacted_in_debug_output`,
# or `✓ src/core/kms/TransportKeyRing.test.ts > disposeTransportKeyPair > zero-fills the private key ... 7ms`).
# Matched against the stripped line.
TEST_RESULT_LINE = re.compile(r"^test \S+ \.\.\. (ok|FAILED|ignored)$|^[✓×↓] \S+\.test\.ts > .* \d+ms$")
# forge prints the fuzzer's PRNG seed after a failing fuzz test, so that the run can be reproduced; it is test input,
# not key material (Phase 4, P2.1 mutation logs).
FUZZ_SEED_LINE = re.compile(r"^Fuzz seed: 0x[0-9a-f]{64} \(use `--fuzz-seed` to reproduce\)$")
IDENTIFIER_CLASSES = {
    "ipv4-public": None,  # computed below
    "path-c-users": re.compile(r"(?i)c:\\users\\"),
    "path-home": re.compile(r"/home/[a-z]"),
}


def is_text(path):
    with open(path, "rb") as f:
        chunk = f.read(4096)
    return b"\x00" not in chunk


def scrub_ip(m):
    ip = m.group(0)
    if ip in ("127.0.0.1", "0.0.0.0"):
        return ip
    if all(0 <= int(g) <= 255 for g in m.groups()):
        return "<ip>"
    return ip


def main():
    root, report = sys.argv[1], sys.argv[2]
    scan_only = "--scan-only" in sys.argv[3:]
    if not os.path.isdir(root) or not any(files for _, _, files in os.walk(root)):
        sys.exit(f"raw_scrub_scan: {root} is not a directory with files")
    hosts = [h for h in os.environ.get("SCRUB_HOSTNAMES", "").split(",") if h]
    counts = {k: 0 for k in list(SECRET_CLASSES) + list(IDENTIFIER_CLASSES) + ["hostname-left", "files", "binary"]}
    hits = []
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            # Our own reports name the classes ("private-key-word=0"); a rescan must not count them.
            if name == "SCAN_REPORT.txt" or os.path.abspath(path) == os.path.abspath(report):
                continue
            counts["files"] += 1
            if not is_text(path):
                counts["binary"] += 1
                hits.append(f"binary file (not scanned): {rel}")
                continue
            with open(path, encoding="utf-8", errors="surrogateescape", newline="") as f:
                text = f.read()
            new = text
            if not scan_only:
                new = ANSI.sub("", new)
                for h in hosts:
                    new = new.replace(h, "VPS")
                new = IPV4.sub(scrub_ip, new)
            if new != text:
                with open(path, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
                    f.write(new)
            for i, line in enumerate(new.splitlines(), 1):
                for cls, rx in SECRET_CLASSES.items():
                    exempt = TEST_RESULT_LINE.match(line.strip()) or FUZZ_SEED_LINE.match(line.strip())
                    if rx.search(line) and not exempt:
                        counts[cls] += 1
                        hits.append(f"SECRET {cls}: {rel}:{i}")
                for m in IPV4.finditer(line):
                    if m.group(0) not in ("127.0.0.1", "0.0.0.0") and all(0 <= int(g) <= 255 for g in m.groups()):
                        counts["ipv4-public"] += 1
                        hits.append(f"IDENTIFIER ipv4: {rel}:{i}")
                for cls in ("path-c-users", "path-home"):
                    if IDENTIFIER_CLASSES[cls].search(line):
                        counts[cls] += 1
                for h in hosts:
                    if h.lower() in line.lower():
                        counts["hostname-left"] += 1
                        hits.append(f"IDENTIFIER hostname: {rel}:{i}")
    secret_hits = sum(counts[k] for k in SECRET_CLASSES) + counts["hostname-left"] + counts["ipv4-public"]
    with open(report, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"raw_scrub_scan of {os.path.basename(os.path.normpath(root))}: {counts['files']} files\n")
        for k, v in counts.items():
            f.write(f"{k}={v}\n")
        f.write(f"RESULT secret_or_hostname_hits={secret_hits}\n")
        for h in hits:
            f.write(h + "\n")
    print(open(report, encoding="utf-8").read().splitlines()[-1] if not hits else f"RESULT secret_or_hostname_hits={secret_hits} (see report)")
    sys.exit(1 if secret_hits else 0)


if __name__ == "__main__":
    main()
