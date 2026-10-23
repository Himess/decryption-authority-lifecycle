# Fresh-clone reproduction of the public export (Phase 4, §8)

Logs of the runs in `results/phase4/PUBLIC_SAFETY_REVIEW.md` §2.6 (that review stays local). Each run cloned a
committed staging build of the export with Git's default settings on M1 (Windows 10, Git Bash) and ran
`python scripts/repro.py <target>`.

| Folder | Clone of | Targets |
|---|---|---|
| `run1/` | staging build s5 | `level0`; `conformance` (rerun after the first fixes) |
| `run2/` | staging build s8 | `level0` (v0.13.8 failed: a Soldeer registry request failed), `conformance` |
| `run3/` | staging build s10 | `level0`, `conformance`, `profile-a`, `level0-mock` |
| `run4/`, `run4b/` | staging build s10, same clone | `profile-a`; `level0-mock` (run4 stopped on a log-label bug in the mock script; fixed, then run4b) |
| `console/` | — | the console output of every run |

Kept per run: the step summaries, the Foundry logs of the ACL suites (isolation off), the kit and suite logs, Profile A's
log, and the mock's vitest log and summary. `SCAN_REPORT.txt` is the secret scan of this folder.
