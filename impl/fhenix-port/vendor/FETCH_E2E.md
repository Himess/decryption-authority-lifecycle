# Fetching what the end-to-end profiles need

The port's own suite (`forge test`, default profile) and the conformance kit need only what is vendored here. The
end-to-end profiles (`e2e`, `e2e-vendor-baseline`, `e2e-vendor-port`) also need three pieces whose licence we could
not find, so they are not in the public repository. Fetch them yourself:

| Piece | Source | Put it at |
|---|---|---|
| `@fhenixprotocol/cofhe-contracts@1.0.0` | `npm pack @fhenixprotocol/cofhe-contracts@1.0.0`; extract `package/` | `vendor/npm-cofhe-contracts-1.0.0/` |
| The `@cofhe/test-setup` contracts | `FhenixProtocol/cofhesdk` at `04a69f89807fa1916d7c5be0a372db254706c38b`, `test/setup/contracts/` and `test/setup/package.json` | `vendor/cofhe-test-setup-04a69f8/` |
| The plugin's 12 test files | the same commit, `packages/foundry-plugin/test/*.t.sol` | run `python3 -I impl/harness/phase4/make_p21_vendor_tests.py <cofhesdk checkout> impl/fhenix-port` (it writes `e2e/vendor-baseline/` and `e2e/vendor-port/`) |

`vendor/PROVENANCE.md` gives each piece's SHA-512 and SHA-256, as checked when it was first fetched.
