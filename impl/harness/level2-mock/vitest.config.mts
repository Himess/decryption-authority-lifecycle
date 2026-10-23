// Vitest config for the Level 2 cleartext-mock end-to-end run (mock-e2e-l2.test.ts). Copied from
// ../level0-mock/vitest.config.mts; only the default worktree and the test file differ.
//
// Same scheme as ../cleartext-roundtrip/vitest.config.mts: the test runs against the
// SDK *source* of the worktree (branch lifecycle/level2-mock: Zama's SDK plus the Level 2
// hygiene change), with the exact-match aliases Zama's own suite uses
// (sdk/js-sdk/test/fheTest/vitest.config.ts). One addition:
//   '@sdk-src/<path>'  ->  <worktree>/sdk/js-sdk/src/<path>
// used for SDK internals the public entry points do not export (the error classes, the
// transport-key helpers). The run modifies nothing in the worktree.
//
// Bare imports (vitest, ethers) resolve through ./node_modules, a junction to
// <worktree>/sdk/js-sdk/node_modules that run_mock_e2e_l2.sh creates, so the SDK and the
// test share one ethers copy.
//
// Env:  HARNESS_FHEVM_CLONE  path to the fhevm worktree (default: ../../wt-l2-mock)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clone = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'wt-l2-mock'));
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
    include: ['mock-e2e-l2.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
