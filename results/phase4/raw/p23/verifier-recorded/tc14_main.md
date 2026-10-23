# TC14 against the Zama worker harness

Fixture: `tc14.json` (7 rows). Runs: 3.

| Row | Rule | Expect | p02-main-r1-20261021T185516Z | p02-main-r2-20261021T185754Z | p02-main-r3-20261021T190035Z |
|---|---|---|---|---|---|
| `tc14.main.after` | V5 and freshness (L = 0) | not-forwarded | conforms | conforms | conforms |
| `tc14.main.race` | V5 and freshness (L = 0) | forwarded | conforms | conforms | conforms |
| `tc14.main.reorg-before` | V5 and freshness (L = 0) | not-forwarded | conforms | conforms | conforms |
| `tc14.main.reorg-after` | V5 and freshness (L = 0) | forwarded | conforms | conforms | conforms |
| `tc14.main.restart-mid-check` | V5 and freshness (L = 0) | not-forwarded | conforms | conforms | conforms |
| `tc14.main.already-sent-live` | V5 and freshness (L = 0) | forwarded | conforms | conforms | conforms |
| `tc14.main.already-sent-retired` | V5 and freshness (L = 0) | not-forwarded | conforms | conforms | conforms |

Cells: 21 conform, 0 violate, 0 missing. Rows missing from every run: 0.
