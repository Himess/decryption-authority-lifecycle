// Vitest config for the Level 0 cleartext-mock end-to-end run (mock-e2e.test.ts).
//
// Same scheme as ../cleartext-roundtrip/vitest.config.mts: the test runs against
// Zama's SDK *source* in the pinned clone, with the exact-match aliases Zama's own
// suite uses (sdk/js-sdk/test/fheTest/vitest.config.ts). One addition:
//   '@sdk-src/<path>'  ->  <clone>/sdk/js-sdk/src/<path>
// used for three SDK internals: toFhevmHandle and initPublicAction, so layer L2 can call
// the SDK's own cleartext relayer module with the client precheck skipped, and the
// precheck's AclUserDecryptionError class (for an instanceof check). Nothing in the
// clone is modified.
//
// Bare imports (vitest, ethers) resolve through ./node_modules, a junction to
// <clone>/sdk/js-sdk/node_modules that run_mock_e2e.sh creates, so the SDK and the
// test share one ethers copy.
//
// Env:  HARNESS_FHEVM_CLONE  path to the fhevm clone (default: ../../fhevm-v0.13.8)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clone = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'fhevm-v0.13.8'));
const sdkSrc = join(clone, 'sdk', 'js-sdk', 'src');
const entry = (p: string) => join(sdkSrc, p, 'index.ts');

const aliases: Array<[string, string]> = [
  ['@fhevm/sdk/ethers/cleartext', entry('ethers/cleartext')],
  ['@fhevm/sdk/ethers', entry('ethers')],
  ['@fhevm/sdk/viem/cleartext', entry('viem/cleartext')],
  ['@fhevm/sdk/viem', entry('viem')],
  ['@fhevm/sdk/base', entry('core/base')],
  ['@fhevm/sdk/chains', entry('core/chains')],
  ['@fhevm/sdk/types', entry('core/types')],
  ['@fhevm/sdk/actions/base', entry('core/actions/base')],
  ['@fhevm/sdk/actions/chain', entry('core/actions/chain')],
  ['@fhevm/sdk/actions/decrypt', entry('core/actions/decrypt')],
  ['@fhevm/sdk/actions/encrypt', entry('core/actions/encrypt')],
  ['@fhevm/sdk/actions/host', entry('core/actions/host')],
];

export default defineConfig({
  root: here,
  cacheDir: join(here, '.vite-cache'),
  resolve: {
    alias: [
      ...aliases.map(([find, replacement]) => ({
        find: new RegExp(`^${find.replace(/[/.]/g, (c) => `\\${c}`)}$`),
        replacement,
      })),
      { find: /^@sdk-src\/(.*)$/, replacement: `${sdkSrc.replace(/\\/g, '/')}/$1` },
    ],
  },
  server: { fs: { allow: [here, clone] } },
  test: {
    include: ['mock-e2e.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
