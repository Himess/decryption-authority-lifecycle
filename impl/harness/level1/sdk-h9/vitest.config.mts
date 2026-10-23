// Vitest config for the Level 1 H9 run of the SDK's precautionary signature check on a local EVM
// (sdk-h9-real-evm.test.ts). Same scheme as ../../level2-mock/vitest.config.mts: the test runs against
// the SDK *source* of the worktree (branch lifecycle/level1: Zama's SDK plus the Profile H change),
// through the alias
//   '@sdk-src/<path>'  ->  <worktree>/sdk/js-sdk/src/<path>
// because the check and the ethers adapter are SDK internals. The run modifies nothing in the worktree.
//
// Bare imports (vitest, ethers) resolve through ./node_modules, a junction to
// <worktree>/sdk/js-sdk/node_modules that run_sdk_h9.sh creates. The chain helpers come from
// experiments/ (E4's ML-DSA-44 account, E5's EIP-7702 delegation) with their own ethers copy.
//
// Env:  HARNESS_FHEVM_CLONE  path to the fhevm worktree (default: ../../../wt-l1-h9)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clone = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', '..', 'wt-l1-h9'));
const sdkSrc = join(clone, 'sdk', 'js-sdk', 'src');
const experiments = resolve(here, '..', '..', '..', '..', 'experiments');

export default defineConfig({
  root: here,
  cacheDir: join(here, '.vite-cache'),
  resolve: {
    alias: [{ find: /^@sdk-src\/(.*)$/, replacement: `${sdkSrc.replace(/\\/g, '/')}/$1` }],
  },
  server: { fs: { allow: [here, clone, experiments] } },
  test: {
    include: ['sdk-h9-real-evm.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
