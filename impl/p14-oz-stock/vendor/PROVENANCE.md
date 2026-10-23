# Vendored npm packages (P1.4)

Fetched with `npm pack` from the public npm registry on 2026-10-21. Each tarball's SHA-512 equals the registry's
`dist.integrity`. The extracted directories are the tarballs' contents, unmodified (checked with `diff -r` against a fresh
extraction).

| Package | Published | `dist.integrity` (SHA-512, checked) | SHA-256 of the tarball | Licence |
|---|---|---|---|---|
| `@openzeppelin/confidential-contracts@0.5.3` | 2026-08-10 | `sha512-de4/+oM8IAaD3IaAOlexZYxupvo4U1rr/SxlfYQ+QveILVrmuyPvE/GlwDCeGdKRsxea22+6ay0CgchTjmlsCA==` | `2ae73c23361009c6e7accafae4cce09ab4eb032c7083ef91de3ae2f16c53b0d6` | MIT |
| `@openzeppelin/contracts@5.6.1` | 2026-02-27 | `sha512-Ly6SlsVJ3mj+b18W3R8gNufB7dTICT105fJhodGAGgyC2oqnBAhqSiNDJ8V8DLY05cCz81GLI0CU5vNYA1EC/w==` | `bd202ef9a2fd09f6005edc18437b4d3090841d0f676c01c814ee9608581d2e63` | MIT |
| `@openzeppelin/contracts-upgradeable@5.6.1` | 2026-02-27 | `sha512-n4a/vfRs114lXyUdYg7pyY8LvFKWvCDF5lEcRRAVxap8g6ZEdLqm+9tmt2zTtRHcNMxTYp9y5t6KBof4tHp7Og==` | `e61a6c39ba6c40aab5ff27d7e4dd203eb88999a29ca405cf07b7a62d05a9b028` | MIT |
| `encrypted-types@0.0.4` | 2025-06-11 | `sha512-f55ccBBUwvqWqr3ymAVOLZ6bzjsSQZlDN0GcKFmzkvTpml4Vm3Y6BCaHhCuW/ctrabTJJ3DFnUsjtFOpokJUaQ==` | `1a7b9435b4c72ec0a12f7afcbc1b293fdb5c285c3282404701b12aae7fe9d4aa` | see the package |

The confidential-contracts 0.5.3 package is also byte-identical to the copy installed in `experiments/node_modules`,
which Phase 3 ported mechanically for the host-contracts suite.

`@openzeppelin/contracts-upgradeable@5.6.1` is not used by the build: the host contracts resolve OpenZeppelin to Zama's
5.1.0 copies through context remappings (`foundry.toml`).
