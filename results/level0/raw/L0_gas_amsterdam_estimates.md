| Item | variant | anvil Prague receipt [M] | forge caller-side Prague / Amsterdam [M] | Amsterdam tx estimate [E] |
|---|---|---|---|---|
| allow (new pair) | v0.7.0 | 58,360 | 36,504 / 124,624 | 146,480 |
| allow (new pair) | v0.8.0 | 60,593 | 38,737 / 126,857 | 148,713 |
| retireAccount | v0.8.0 | 50,099 | 26,947 / 115,067 | 138,219 |
| carry n=1 | v0.7.0 | 62,192 | 39,008 / 127,128 | 150,312 |
| carry n=1 + retireAccount | v0.8.0 | 89,113 | 66,351 / 242,591 | 265,353 |
| carry n=10 | v0.7.0 | 342,013 | 316,549 / 1,197,749 | 1,223,213 |
| carry n=10 + retireAccount | v0.8.0 | 371,045 | 345,991 / 1,315,311 | 1,340,365 |
| carry n=100 | v0.7.0 | 3,140,457 | 3,098,881 / 11,910,881 | 11,952,457 |
| carry n=100 + retireAccount | v0.8.0 | 3,191,061 | 3,158,633 / 12,058,753 | 12,091,181 |
| carry n=500 | v0.7.0 | 15,603,846 | 15,554,956 / 59,614,956 | 59,663,846 |
| carry n=500 + retireAccount | v0.8.0 | 15,750,135 | 15,894,591 / 60,042,711 | 59,898,255 |
- v0_7_0: Amsterdam carry per handle ~119266 [E]; max handles per transaction under the 2^24 cap ~140 [E]
- v0_8_0: Amsterdam carry per handle ~119505 [E]; max handles per transaction under the 2^24 cap ~139 [E]
