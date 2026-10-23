"""P0.4 (Phase 5): consistency checks on the public documents after the Part A edits.

Usage: python -I p04_consistency.py <project dir> <base commit> <out.md>

1. Rule references. Every rule or test-case ID named in a public document must be defined in the ERC or the
   companion. Rules: C, O, R, S, V (ERC); A, H, K, Q (companion), as "- **X<n>. " list items. Test cases: the TC rows
   of both test tables. Extensions: E1, E2 (ERC sections), E3 (companion). Not rule references, and skipped:
   - A<n> written as a source, "A<n> §…", "[V, A<n>" or "by A<n>": the Phase 3 deliberation agents;
   - E<n> for n >= 4: the experiments (E4 is the ML-DSA-44 account experiment, and so on);
   - an ID inside backticks or inside a path or identifier.
2. Numbers against RESULTS. Every number on a line Phase 5 added to a public document (`git diff <base>`) is looked
   up, as written, in `results/RESULTS.md`, then in the reports of `results/` (not raw data). Lines and numbers found
   in neither are listed as CHECK for review. Skipped: numbers inside backticks, dates, version numbers, line or
   section references, and numbers glued to a name (EIP-8298, R13, ML-DSA-44).
3. Regression searches:
   - P0.1: no "only adds rights" wording;
   - P0.2: every TC15 mention quotes the kit's numbers or only defines TC15 (the P0.2 report itself is about the
     correction and is skipped);
   - P0.3: every paragraph that discusses EIP-7851 names EIP-8298 too, except the Phase 4 records.
4. Writing rules: no "quantum-proof", "quantum-safe", "groundbreaking" or "revocable privacy"; "revocable access" and
   "retire" in the README, the write-up, the one-pager and the ERC; the three limits where the design is summarised.
"""
import os
import re
import subprocess
import sys

root, base, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
ERC = "erc/ERC-XXXX-decryption-authority-lifecycle.md"
COMP = "docs/COMPANION_EXTENSIONS_AND_PROFILES.md"
PUBLIC = [ERC, COMP, "erc/assets/erc-XXXX/EVIDENCE.md", "erc/assets/erc-XXXX/conformance/README.md",
          "conformance/README.md", "docs/TARGET_ARCHITECTURE.md", "docs/HEDEF_MIMARI_TR.md", "docs/ERC_SPLIT_MAPPING.md",
          "drafts/RESEARCH_WRITEUP.md", "drafts/ONE_PAGER.md", "export/README.md", "results/RESULTS.md",
          "results/phase4/CORE_TRACEABILITY.md"]
# P2 (Phase 5): further public documents, comma-separated, from the environment. New files must be in the index
# (`git add -N`) so that `git diff` shows their lines as added. They are also checked for the three limits.
EXTRA = [x for x in os.environ.get("P5_EXTRA_PUBLIC", "").split(",") if x]
PUBLIC += EXTRA


def read(rel):
    return open(os.path.join(root, rel), encoding="utf-8").read()


def strip_code(line):
    return re.sub(r"`[^`]*`", " ", line)


out = []
fails = 0

# ---------------------------------------------------------------- 1. rule references
defined = set()
for rel in (ERC, COMP):
    for line in read(rel).split("\n"):
        m = re.match(r"^- \*\*([A-Z]{1,2}\d+)\. ", line)
        if m:
            defined.add(m.group(1))
        m = re.match(r"^\| (TC\d+) \|", line)
        if m:
            defined.add(m.group(1))
erc_text, comp_text = read(ERC), read(COMP)
for e in ("E1", "E2"):
    if re.search(rf"^### Extension {e}\b", erc_text, re.M):
        defined.add(e)
if re.search(r"\bE3\b", comp_text):
    defined.add("E3")
REF = re.compile(r"(?<![\w./#-])((?:TC|[COSRVAHKQE])\d{1,2})(?![\w])")
# Documents in which A<n> names a Profile A rule. Elsewhere (the architecture documents, RESULTS, the drafts) A<n> is
# a Phase 3 deliberation agent or a row of the architecture's disagreement table, unless the line says "Profile A".
A_RULE_DOCS = {ERC, COMP, "erc/assets/erc-XXXX/EVIDENCE.md", "results/phase4/CORE_TRACEABILITY.md"}
undefined = []
counts = {}
for rel in PUBLIC:
    for no, line in enumerate(read(rel).split("\n"), 1):
        text = strip_code(line)
        for m in REF.finditer(text):
            rid = m.group(1)
            if rid[0] == "E" and int(rid[1:]) >= 4:
                continue
            if rid[0] == "A":
                if rel not in A_RULE_DOCS and "Profile A" not in text:
                    continue
                if re.search(rf"\b{rid} §|\[[VIC][^\]]*\b{rid}\b|\bby {rid}\b|^- {rid} = |\b{rid}'s\b", text):
                    continue
            counts[rid] = counts.get(rid, 0) + 1
            if rid not in defined:
                undefined.append((rel, no, rid, line.strip()[:140]))
def id_key(s):
    return re.sub(r"\d", "", s), int(re.sub(r"\D", "", s))


out.append("## 1. Rule references\n")
ids = ", ".join(sorted(defined, key=id_key))
out.append(f"Defined in the ERC and the companion: {len(defined)} IDs ({ids}).")
out.append(f"References found in {len(PUBLIC)} public documents: {sum(counts.values())} ({len(counts)} distinct IDs).")
if undefined:
    out.append(f"\n**Undefined: {len(undefined)}**\n")
    for rel, no, rid, text in undefined:
        out.append(f"- `{rel}:{no}` {rid}: {text}")
else:
    out.append("Undefined: 0.")
fails += len(undefined)

# ---------------------------------------------------------------- 2. numbers on added lines
diff = subprocess.run(["git", "-C", root, "diff", "--unified=0", base, "--", *PUBLIC], capture_output=True, text=True,
                      encoding="utf-8").stdout
added = []
current = None
for line in diff.split("\n"):
    if line.startswith("+++ b/"):
        current = line[6:]
    elif line.startswith("@@"):
        m = re.search(r"\+(\d+)", line)
        lineno = int(m.group(1)) if m else 0
    elif line.startswith("+") and not line.startswith("+++"):
        added.append((current, lineno, line[1:]))
        lineno += 1
results_text = read("results/RESULTS.md")
reports = {}
for dp, _, names in os.walk(os.path.join(root, "results")):
    if os.sep + "raw" in dp or "/raw" in dp.replace("\\", "/"):
        continue
    for n in names:
        if n.endswith(".md"):
            rel = os.path.relpath(os.path.join(dp, n), root).replace("\\", "/")
            if rel != "results/RESULTS.md":
                reports[rel] = read(rel)
NUM = re.compile(r"(?<![\w.,:§/#+-])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(%|/\d+)?(?![\w.]\d|[\w])")


def tokens(text):
    """The numbers of a line: dates, years, numbers in backticks and numbers glued to a name removed."""
    text = strip_code(text)
    text = re.sub(r"\b20\d\d-\d\d-\d\d(T[\d:]+Z)?\b", " ", text)
    if re.match(r"^#+ ", text):  # headings carry section and phase numbers, not data
        return []
    found = []
    for m in NUM.finditer(text):
        if re.fullmatch(r"20\d\d", m.group(1)):
            continue
        found.append(m.group(1) + (m.group(2) or ""))
    return found


def present(num, text):
    return re.search(rf"(?<![\d,.]){re.escape(num)}(?![\d,]\d|\d)", text) is not None


lines_with_numbers = []
for rel, no, line in added:
    if rel.endswith("_TR.md"):
        # Turkish documents write thousands with points (156.448) and decimals with commas (4,43M): normalise the
        # thousands so the numbers compare with RESULTS.
        line = re.sub(r"(?<![\d.,])\d{1,3}(?:\.\d{3})+(?![\d.,]\d)", lambda m: m.group(0).replace(".", ","), line)
    nums = tokens(line)
    if not nums:
        continue
    significant = [n for n in nums if "," in n or "%" in n or "/" in n or "." in n or len(n) >= 3]
    cited = re.findall(r"(?:results/)?((?:phase[45]|level[0-3])/[\w./-]+\.md)", line)
    cited_text = " ".join(reports.get("results/" + c, "") for c in cited)
    if rel == "results/RESULTS.md":
        # RESULTS' own new rows are checked against the report they cite, every number of the row.
        missing = [n for n in nums if not present(n, cited_text)]
        status = "in the cited report" if cited_text and not missing else "CHECK"
    else:
        missing = [n for n in significant if not present(n, results_text)]
        status = "in RESULTS" if not missing else (
            "in the cited report" if cited_text and all(present(n, cited_text) for n in missing) else "CHECK")
    lines_with_numbers.append((rel, no, nums, significant, missing, status, line.strip()))
out.append("\n## 2. Numbers on the lines Phase 5 added\n")
n_check = sum(1 for x in lines_with_numbers if x[5] == "CHECK")
out.append(f"Added lines in public documents since `{base}`: {len(added)}; lines with numbers: {len(lines_with_numbers)}. "
           f"A line is 'in RESULTS' when every significant number on it (three digits or more, or with a comma, point, "
           f"percent or fraction) occurs in RESULTS.md as a whole token; otherwise 'in the cited report' when those "
           f"occur in the report the line cites; otherwise CHECK. Every line is listed, for review by hand: "
           f"{sum(1 for x in lines_with_numbers if x[5] == 'in RESULTS')} in RESULTS, "
           f"{sum(1 for x in lines_with_numbers if x[5] == 'in the cited report')} in the cited report, {n_check} CHECK.\n")
out.append("| File:line | Numbers | Not in RESULTS | Status |")
out.append("|---|---|---|---|")
for rel, no, nums, significant, missing, status, text in lines_with_numbers:
    out.append(f"| `{rel}:{no}` | {', '.join(nums)} | {', '.join(missing) or '-'} | {status} |")
review = [x for x in lines_with_numbers if x[5] == "CHECK"]
if review:
    out.append("\nCHECK lines in full:\n")
    for rel, no, nums, significant, missing, status, text in review:
        out.append(f"- `{rel}:{no}` (missing {', '.join(missing)}): {text[:400]}")

# ---------------------------------------------------------------- 3. regression searches
out.append("\n## 3. Regression searches\n")
SCOPE_ALL = PUBLIC + [os.path.relpath(os.path.join(dp, n), root).replace("\\", "/")
                      for d in ("results/phase5",) for dp, _, ns in os.walk(os.path.join(root, d))
                      for n in ns if n.endswith(".md") and "raw" not in dp]
hits = [(rel, no, line.strip()[:120]) for rel in PUBLIC for no, line in enumerate(read(rel).split("\n"), 1)
        if re.search(r"only adds? rights|adds rights only|only add rights", line, re.I)
        and "Consistency pass (P0.4)" not in line]  # that RESULTS row describes this very search
out.append(f"- P0.1, \"only adds rights\" wording: {len(hits)} hits" + "".join(f"\n  - `{h[0]}:{h[1]}` {h[2]}" for h in hits))
fails += len(hits)
tc15 = []
for rel in PUBLIC:
    lines = read(rel).split("\n")
    for i, line in enumerate(lines):
        if re.search(r"\bTC15\b|TC13[–-]TC15", line) and "Consistency pass (P0.4)" not in line:
            window = " ".join(x.strip() for x in lines[i:i + 2])
            if re.search(r"35 (conform|cells|uyumlu|hücre)|35 conforming", window):
                continue
            if re.search(r"^\| TC15 \| V6, V7 \||^\| TC15, V[67] \||`tc15\.json`|TC15 \(25\)|25 rows over 7 runs|"
                         r"TC13 P0\.1, TC14 P0\.2, TC15 Level 1 and P0\.3|TC13–TC15 matrices", line) or rel == "docs/ERC_SPLIT_MAPPING.md":
                continue
            tc15.append((rel, i + 1, line.strip()[:120]))
out.append(f"- P0.2, TC15 mentions without the kit's numbers or a definition: {len(tc15)}" +
           "".join(f"\n  - `{h[0]}:{h[1]}` {h[2]}" for h in tc15))
fails += len(tc15)
lone = []
for rel in PUBLIC:
    if rel in ("docs/ERC_SPLIT_MAPPING.md",):
        continue
    paras = re.split(r"\n\s*\n", read(rel))
    for p in paras:
        if "7851" in p and "8298" not in p:
            first = p.strip().split("\n")[0][:120]
            lone.append((rel, first))
out.append(f"- P0.3, paragraphs that discuss EIP-7851 without EIP-8298: {len(lone)} (listed for review; Phase 4 records "
           "and statements about the indicator itself may keep EIP-7851 alone)" + "".join(f"\n  - `{h[0]}`: {h[1]}" for h in lone))

# ---------------------------------------------------------------- 4. writing rules
out.append("\n## 4. Writing rules\n")
banned = [(rel, no, line.strip()[:120]) for rel in PUBLIC + ["drafts/RESEARCH_WRITEUP.md"]
          for no, line in enumerate(read(rel).split("\n"), 1)
          if re.search(r"quantum-proof|quantum-safe|groundbreaking|revocable privacy", line, re.I)]
out.append(f"- Banned words: {len(banned)} hits" + "".join(f"\n  - `{h[0]}:{h[1]}` {h[2]}" for h in banned))
fails += len(banned)
for rel in ("export/README.md", "drafts/RESEARCH_WRITEUP.md", "drafts/ONE_PAGER.md", ERC):
    t = read(rel)
    ra, rt = len(re.findall(r"revocable access", t, re.I)), len(re.findall(r"\bretire", t, re.I))
    ok = ra > 0 and rt > 0
    fails += not ok
    out.append(f"- `{rel}`: \"revocable access\" {ra}, \"retire…\" {rt}: {'ok' if ok else '**missing**'}")
LIMITS = [r"pre-emptive|preemptive", r"clawback|claw back|already decrypted|already been decrypted",
          r"oracle|operators?|threshold"]
for rel in ["export/README.md", "drafts/RESEARCH_WRITEUP.md", "drafts/ONE_PAGER.md", ERC, "results/RESULTS.md"] + EXTRA:
    t = read(rel)
    m = re.search(r"three limits|üç sınır", t, re.I)
    ok = bool(m)
    out.append(f"- `{rel}`: the three limits {'stated' if ok else '**not found**'}")
    fails += not ok

out.insert(0, f"# P0.4 consistency checks, base `{base}`\n\nResult: {fails} failures in the automated parts "
              f"(rule references, regression searches, writing rules); the numbers listed in §2 are reviewed by hand.\n")
open(out_path, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(f"failures {fails}; undefined refs {len(undefined)}; lines with numbers {len(lines_with_numbers)} "
      f"(CHECK {len(review)}); tc15 {len(tc15)}; 7851-alone paragraphs {len(lone)}")
