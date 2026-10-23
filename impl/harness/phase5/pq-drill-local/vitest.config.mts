// Vitest config for the Phase 5 Part B local drill (pq-drill-local.test.ts). The SDK is the source of the worktree
// impl/wt-sdk-status (branch lifecycle/phase4-sdk-status: main's SDK with Level 1's Profile H precheck, Level 2's
// hygiene and the account-code report), through the exact-match aliases of Zama's own suite for the public entry
// points and the '@sdk-src/<path>' alias for internals (the precheck is not exported). The run modifies nothing in the
// worktree.
//
// Bare imports (vitest, ethers) resolve through ./node_modules, a junction to <sdk worktree>/sdk/js-sdk/node_modules
// that run_pq_drill_local.sh creates, so the SDK and the test share one copy of ethers.
//
// Env:  HARNESS_SDK_CLONE   the SDK worktree (default: ../../../wt-sdk-status)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sdkClone = resolve(process.env.HARNESS_SDK_CLONE ?? join(here, '..', '..', '..', 'wt-sdk-status'));
const sdkSrc = join(sdkClone, 'sdk', 'js-sdk', 'src');
const entry = (p: string) => join(sdkSrc, p, 'index.ts');
const project = resolve(here, '..', '..', '..', '..');

const exact: Array<[string, string]> = [
  ['@fhevm/sdk/ethers', entry('ethers')],
  ['@fhevm/sdk/chains', entry('core/chains')],
  ['@fhevm/sdk/actions/host', entry('core/actions/host')],
];

export default defineConfig({
  root: here,
  cacheDir: join(here, '.vite-cache'),
  resolve: {
    alias: [
      ...exact.map(([find, replacement]) => ({
        find: new RegExp(`^${find.replace(/[/.]/g, (c) => `\\${c}`)}$`),
        replacement,
      })),
      { find: /^@sdk-src\/(.*)$/, replacement: `${sdkSrc.replace(/\\/g, '/')}/$1` },
    ],
  },
  server: { fs: { allow: [here, sdkClone, project] } },
  test: {
    include: ['pq-drill-local.test.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
