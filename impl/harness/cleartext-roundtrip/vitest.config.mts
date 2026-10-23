// Vitest config for the Level-0 cleartext round-trip harness.
//
// It runs OUR test file (roundtrip.test.ts) against Zama's SDK *source* in a
// pinned clone, exactly the way Zama's own suite does in
// sdk/js-sdk/test/fheTest/vitest.config.ts (aliases from '@fhevm/sdk/...' to
// sdk/js-sdk/src/.../index.ts). Nothing in the clone is modified.
//
// Bare imports from this directory (vitest, ethers) resolve through
// ./node_modules, a junction/symlink to <clone>/sdk/js-sdk/node_modules that
// baselineB_cleartext.sh creates, so the SDK and this test share one ethers copy.
//
// Env:
//   HARNESS_FHEVM_CLONE  path to the fhevm clone (default: ../../fhevm-main)
import { defineConfig } from 'vitest/config';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clone = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'fhevm-main'));
const sdkSrc = join(clone, 'sdk', 'js-sdk', 'src');
const entry = (p: string) => join(sdkSrc, p, 'index.ts');

// Exact-match aliases; '/cleartext' entries first (same order rule as Zama's config).
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
    alias: aliases.map(([find, replacement]) => ({
      find: new RegExp(`^${find.replace(/[/.]/g, (c) => `\\${c}`)}$`),
      replacement,
    })),
  },
  server: { fs: { allow: [here, clone] } },
  test: {
    include: ['roundtrip.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    retry: 0,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
