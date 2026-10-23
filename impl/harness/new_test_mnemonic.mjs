#!/usr/bin/env node
// =============================================================================
// Creates a fresh, local-only BIP-39 test mnemonic for the harness and stores it
// in impl/harness/.env as HARNESS_MNEMONIC (git-ignored by the project's
// "**/.env" rule). It never prints the mnemonic or any private key; it prints
// only the derived addresses used as test accounts.
//
// Usage:  node impl/harness/new_test_mnemonic.mjs [--force] [--clone <path-to-fhevm-clone>]
//
// The accounts exist only on the local anvil chain the harness starts. They are
// funded there with anvil_setBalance; nothing is ever sent to a public network.
// =============================================================================
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const cloneIdx = args.indexOf('--clone');
const clone = cloneIdx >= 0 ? resolve(args[cloneIdx + 1]) : resolve(here, '..', 'fhevm-main');

// Reuse the ethers copy installed in the clone's js-sdk (no extra install).
const require = createRequire(join(clone, 'sdk', 'js-sdk', 'package.json'));
const { ethers } = require('ethers');

const envPath = join(here, '.env');
let phrase;
if (existsSync(envPath) && !force) {
  const m = readFileSync(envPath, 'utf8').match(/^HARNESS_MNEMONIC="([^"]+)"/m);
  if (!m) throw new Error(`${envPath} exists but has no HARNESS_MNEMONIC; rerun with --force`);
  phrase = m[1];
  console.log(`reusing existing mnemonic in ${envPath}`);
} else {
  phrase = ethers.Wallet.createRandom().mnemonic.phrase;
  writeFileSync(
    envPath,
    `# Local-only test mnemonic for impl/harness (git-ignored). Created ${new Date().toISOString()}.\n` +
      `# Used only on local anvil chains started by the harness. Do not reuse anywhere else.\n` +
      `HARNESS_MNEMONIC="${phrase}"\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  console.log(`wrote a fresh mnemonic to ${envPath}`);
}

const names = ['alice', 'bob', 'carol', 'dave'];
const mn = ethers.Mnemonic.fromPhrase(phrase);
names.forEach((n, i) => {
  const w = ethers.HDNodeWallet.fromMnemonic(mn, `m/44'/60'/0'/0/${i}`);
  console.log(`${n.padEnd(6)} m/44'/60'/0'/0/${i}  ${w.address}`);
});
