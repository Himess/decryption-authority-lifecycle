// Vitest config for the Phase 4 P1.6 run (p16-sdk-status.test.ts). Same scheme as
// ../../level2-mock/vitest.config.mts: the test runs against the SDK *source* of a worktree, here
// impl/wt-sdk-status (branch lifecycle/phase4-sdk-status), through the exact-match aliases Zama's own suite
// uses (sdk/js-sdk/test/fheTest/vitest.config.ts). The chain is Zama's cleartext mock deployed from
// impl/wt-l2-mock, whose files the test only reads (addresses, deploy constants). The run modifies nothing in
// either worktree.
//
// Bare imports (vitest, ethers, viem) resolve through ./node_modules, a junction to
// <sdk worktree>/sdk/js-sdk/node_modules that run_p16_sdk.sh creates, so the SDK and the test share one copy
// of each.
//
// Env:  HARNESS_SDK_CLONE   the SDK worktree (default: ../../../wt-sdk-status)
//       HARNESS_MOCK_CLONE  the mock worktree (default: ../../../wt-l2-mock)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sdkClone = resolve(process.env.HARNESS_SDK_CLONE ?? join(here, '..', '..', '..', 'wt-sdk-status'));
const mockClone = resolve(process.env.HARNESS_MOCK_CLONE ?? join(here, '..', '..', '..', 'wt-l2-mock'));
const sdkSrc = join(sdkClone, 'sdk', 'js-sdk', 'src');
const entry = (p: string) => join(sdkSrc, p, 'index.ts');

const aliases: Array<[string, string]> = [
  ['@fhevm/sdk/ethers', entry('ethers')],
  ['@fhevm/sdk/viem', entry('viem')],
  ['@fhevm/sdk/chains', entry('core/chains')],
  ['@fhevm/sdk/actions/host', entry('core/actions/host')],
];

export default defineConfig({
  root: here,
  cacheDir: join(here, '.vite-cache'),
  resolve: {
    alias: aliases.map(([find, replacement]) => ({
      find: new RegExp(`^${find.replace(/[/.]/g, (c) => `\\${c}`)}$`),
      replacement,
    })),
  },
  server: { fs: { allow: [here, sdkClone, mockClone] } },
  test: {
    include: ['p16-sdk-status.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
