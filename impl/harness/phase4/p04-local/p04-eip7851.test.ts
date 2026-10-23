// =============================================================================
// Phase 4, P0.4: the EIP-7851 gap on a local EVM (proof class: Mock).
//
// EIP-7851 (draft) lets an EIP-7702 account disable its ECDSA root key; the account's code then reads
// 0xef0101 ‖ delegate ("ECDSA-disabled delegation indicator"). No client implements it. Simulation: the
// JSON-RPC proxy impl/harness/phase4/fault_proxy.py (--rewrite-file) answers eth_getCode for the account with
// 0xef0101 ‖ delegate, while anvil keeps the real EIP-7702 delegation 0xef0100 ‖ delegate, so calls into
// the account still run the delegate. Rewriting is toggled per row (the proxy re-reads the file on every call);
// "7702" rows are the same accounts without the rewrite.
//
// Accounts (fresh random keys, never printed):
//   X  delegates to E4's ML-DSA-44 ERC-1271 account (immutables only, so it works as a delegate);
//   Y  delegates to NoErc1271 (no isValidSignature: a call returns empty data);
//   E  a plain EOA (control).
// Signatures: the ECDSA root keys of X, Y, E; X's ML-DSA-44 key (E4's public local test seed).
//
// Verifiers, every RPC through the proxy with the row label as URL path:
//   zama-unmodified  Zama's verify_signature at fhevm ed851716c (experiments/udsig-harness), 250,000 cap;
//   l1-legacy        the unchanged verify_signature inside the Level 1 crate (udsig-h verify-legacy), 250,000 cap;
//   profile-h        the Level 1 entry point verify_user_decryption_signature (udsig-h verify-h), modes
//                    off / shadow / enforce, B_exec 2,000,000;
//   sdk              Zama's SDK precautionary check (branch lifecycle/level1) with Zama's ethers adapter,
//                    without a policy (today) and with the Profile H default policy in `enforce`.
// The relayer pre-check calls the crate's verify_user_decryption_signature (relayer/src/host/
// signature_prechecker.rs at 0eec675), so the profile-h rows are its verification step; it is not run here.
//
// Env (set by run_p04_local.sh): P04_OUT, ANVIL_PORT (8611), PROXY_PORT (8612), UDSIG_H
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Chain helpers from experiments/ (their own ethers copy).
import { ethers as xethers } from '../../../../experiments/node_modules/ethers/lib.esm/index.js';
import { startAnvil, makeProvider, makeAccounts, assertChain, sendTx } from '../../../../experiments/lib/chain.mjs';
import { deployArtifact } from '../../../../experiments/lib/artifacts.mjs';
import { Recorder } from '../../../../experiments/lib/log.mjs';
import { deployPqStack, mldsa, zamaVerify, ethersUnifiedDigest } from '../../../../experiments/E4/pqlib.mjs';
import { hardwareInfo } from '../../../../experiments/E4/e4-local.mjs';
// SDK internals (the check is not exported).
import { verifyErc1271UserDecrypt } from '@sdk-src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts';
import { PROFILE_H_DEFAULT_SIGNATURE_POLICY } from '@sdk-src/core/utils-p/decrypt/userDecryptSignaturePolicy.ts';
import type { UserDecryptSignaturePolicy } from '@sdk-src/core/utils-p/decrypt/userDecryptSignaturePolicy.ts';
import { kmsUserDecryptEip712V2Types } from '@sdk-src/core/kms/kmsUserDecryptEip712V2Types.ts';
import { ethereumModule } from '@sdk-src/ethers/internal/ethereum.ts';
import { PRIVATE_ETHERS_TOKEN } from '@sdk-src/ethers/internal/ethers-p.ts';
import { createFhevmRuntime } from '@sdk-src/core/runtime/CoreFhevmRuntime-p.ts';
import { createCoreFhevm } from '@sdk-src/core/runtime/CoreFhevm-p.ts';
import { sepolia } from '@sdk-src/core/chains/definitions/sepolia.ts';
import type { RelayerModule } from '@sdk-src/core/modules/relayer/types.ts';
import type { KmsUserDecryptEip712V2 } from '@sdk-src/core/types/kms.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');
const OUT = path.resolve(process.env.P04_OUT ?? path.join(here, '.build'));
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8611);
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8612);
const UDSIG_H =
  process.env.UDSIG_H ??
  path.join(ROOT, 'impl', '.tools', 'target-udsig-h-l1', 'release', process.platform === 'win32' ? 'udsig-h.exe' : 'udsig-h');
const PROXY = path.join(ROOT, 'impl', 'harness', 'phase4', 'fault_proxy.py');
const B_EXEC = 2_000_000;
const LEGACY_CAP = 250_000; // kms-connector config.rs:274 erc1271_gas_limit default @ ed851716c
const REWRITE_FILE = path.join(OUT, 'P04_rewrite.json');
const PROXY_LOG = path.join(OUT, 'P04_host_rpc.jsonl');

type Row = {
  label: string;
  verifier: string;
  account: 'X' | 'Y' | 'E';
  code: '7851' | '7702' | 'eoa';
  signature: 'root-key' | 'ml-dsa-44';
  accepted: boolean;
  detail: Record<string, unknown>;
};
const rows: Row[] = [];

let anvil: { url: string; stop: () => Promise<void> };
let proxy: ChildProcess;
let proxyErr = '';
let chainId: bigint;
let x: xethers.Wallet;
let y: xethers.Wallet;
let e: xethers.Wallet;
let pq: Record<string, string>;
let noErc1271: string;
const seedHex = xethers.keccak256(xethers.toUtf8Bytes('fhe-authority-lifecycle/E4/local-test-seed/v1')).slice(2);

const proxyUrl = (label: string) => `http://127.0.0.1:${PROXY_PORT}/p04.${label}`;

/** 0xef0101 ‖ delegate for the accounts in `on`, nothing for the others (the node's own code). */
function setRewrite(on: Array<[string, string]>) {
  const table: Record<string, string> = {};
  for (const [account, delegate] of on) table[account.toLowerCase()] = ('0xef0101' + delegate.slice(2)).toLowerCase();
  fs.writeFileSync(REWRITE_FILE, JSON.stringify(table));
}

function udsig(args: string[], stdin = '') {
  const r = spawnSync(UDSIG_H, args, { input: stdin, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw new Error(`udsig-h ${args[0]} failed: ${(r.stderr || '').slice(-800)}`);
  return JSON.parse(r.stdout.trim());
}

/** The RFC-016 permit of `user`, one shape for every row. */
function permitFor(user: string) {
  return {
    chainId: Number(chainId),
    gateway: '0x000000000000000000000000000000000000dEaD',
    userAddress: user,
    publicKey: '0x' + 'ab'.repeat(800),
    allowedContracts: ['0x1111111111111111111111111111111111111111'],
    startTimestamp: 1_800_000_000,
    durationSeconds: 86_400,
    extraData: '0x01' + '00'.repeat(32),
  };
}
const digestOf = (user: string): string => udsig(['digest'], JSON.stringify(permitFor(user))).digest;

const ecdsa = (w: xethers.Wallet, digest: string) => xethers.Signature.from(w.signingKey.sign(digest)).serialized;
const mldsaSig = (digest: string) => '0x' + mldsa('sign', { seedHex, msg: digest }).sig;

function record(row: Row) {
  rows.push(row);
  return row;
}

/** One crate or Zama verifier row. */
function crateRow(
  verifier: 'zama-unmodified' | 'l1-legacy' | 'profile-h.off' | 'profile-h.shadow' | 'profile-h.enforce',
  account: Row['account'],
  code: Row['code'],
  signature: Row['signature'],
  signer: string,
  sigHex: string,
  digest: string,
) {
  const label = `${verifier}.${account}-${code}.${signature}`;
  const url = proxyUrl(label);
  let out: Record<string, unknown>;
  if (verifier === 'zama-unmodified') out = zamaVerify(url, signer, digest, sigHex, LEGACY_CAP);
  else if (verifier === 'l1-legacy') out = udsig(['verify-legacy', url, signer, digest, String(LEGACY_CAP)], sigHex);
  else {
    const mode = verifier.split('.')[1];
    out = udsig(['verify-h', url, signer, digest, mode, String(B_EXEC), '1', '0', '-', '800', '33'], sigHex);
  }
  return record({ label, verifier, account, code, signature, accepted: out.ok === true, detail: out });
}

/** One SDK row: Zama's ethers adapter over a provider whose every request goes to the proxy, labelled. */
async function sdkRow(
  verifier: 'sdk.today' | 'sdk.enforce',
  account: Row['account'],
  code: Row['code'],
  signature: Row['signature'],
  user: string,
  sign: (digest: string) => string,
) {
  const label = `${verifier}.${account}-${code}.${signature}`;
  const provider = new ethers.JsonRpcProvider(proxyUrl(label), ethers.Network.from(Number(chainId)), {
    staticNetwork: true,
    cacheTimeout: -1,
    batchMaxCount: 1,
  });
  const warnings: string[] = [];
  const runtime = createFhevmRuntime(PRIVATE_ETHERS_TOKEN, {
    ethereum: ethereumModule().ethereum,
    relayer: {} as RelayerModule,
    config: { logger: { debug: undefined, warn: (m: string) => warnings.push(m), error: undefined } },
  });
  const context = createCoreFhevm(PRIVATE_ETHERS_TOKEN, { chain: sepolia, client: provider, runtime });
  const eip712 = {
    domain: { name: 'Decryption', version: '1', chainId: 54321n, verifyingContract: ethers.getAddress('0x000000000000000000000000000000000000dead') },
    types: kmsUserDecryptEip712V2Types,
    primaryType: 'UserDecryptRequestVerification',
    message: {
      userAddress: ethers.getAddress(user),
      publicKey: '0x' + 'ab'.repeat(800),
      allowedContracts: [ethers.getAddress('0x1111111111111111111111111111111111111111')],
      startTimestamp: '1800000000',
      durationSeconds: '86400',
      extraData: '0x01' + '00'.repeat(32),
    },
  } as unknown as KmsUserDecryptEip712V2;
  const fields = eip712.types[eip712.primaryType];
  const digest = ethers.TypedDataEncoder.hash(
    eip712.domain as unknown as ethers.TypedDataDomain,
    { [eip712.primaryType]: [...fields] },
    eip712.message as unknown as Record<string, unknown>,
  );
  const policy: UserDecryptSignaturePolicy | undefined =
    verifier === 'sdk.enforce' ? { ...PROFILE_H_DEFAULT_SIGNATURE_POLICY, codeFirstMode: 'enforce' } : undefined;
  let detail: Record<string, unknown>;
  try {
    await verifyErc1271UserDecrypt(context, { userAddress: ethers.getAddress(user) as never, eip712, signature: sign(digest) as never, policy });
    detail = { ok: true };
  } catch (err) {
    detail = { ok: false, error: (err as Error).constructor.name, message: (err as Error).message.slice(0, 300) };
  }
  provider.destroy();
  return record({ label, verifier, account, code, signature, accepted: detail.ok === true, detail: { ...detail, warnings } });
}

/** EIP-7702 delegation by a real type-4 transaction, self-sponsored. The tx calls a dead address with no data, so
 *  it succeeds whatever the delegate is (E5's helper calls the account, which the ML-DSA account would revert). */
async function delegate(rec: unknown, wallet: xethers.Wallet, target: string, kind: string) {
  const provider = wallet.provider!;
  const nonce = await provider.getTransactionCount(wallet.address, 'pending');
  const auth = await wallet.authorize({ address: target, nonce: nonce + 1, chainId });
  await sendTx(
    rec,
    'P04.2',
    wallet,
    { type: 4, to: '0x000000000000000000000000000000000000dEaD', data: '0x', authorizationList: [auth], nonce, gasLimit: 100_000n },
    { action: `EIP-7702 delegate -> ${kind}`, authorizationNonce: nonce + 1 },
  );
  const code = await provider.getCode(wallet.address);
  if (code.toLowerCase() !== ('0xef0100' + target.slice(2)).toLowerCase()) throw new Error(`delegation ${kind} not in place`);
}

beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(PROXY_LOG, '');
  setRewrite([]);
  anvil = await startAnvil({ port: ANVIL_PORT, hardfork: 'osaka', gasLimit: 1_000_000_000 });
  proxy = spawn('python', ['-I', PROXY, String(PROXY_PORT), anvil.url, PROXY_LOG, '--rewrite-file', REWRITE_FILE], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  proxy.stderr!.on('data', (d) => (proxyErr = (proxyErr + d.toString()).slice(-4000)));
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PROXY_PORT}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  fs.writeFileSync(PROXY_LOG, ''); // drop the readiness probe

  const provider = makeProvider('local', anvil.url);
  chainId = await assertChain(provider, 'local');
  const { FUNDER } = makeAccounts('local', provider);
  const rec = Object.create(Recorder.prototype);
  Object.assign(rec, { experiment: 'P04', mode: 'local', dir: OUT, file: path.join(OUT, 'P04_deploy_records.jsonl'), records: [] });
  fs.writeFileSync(rec.file, '');
  const fresh = async () => {
    const w = xethers.Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [w.address, xethers.toQuantity(10n ** 20n)]);
    return w;
  };
  pq = await deployPqStack(rec, 'P04.1', FUNDER, { seedHex });
  noErc1271 = (await deployArtifact(rec, 'P04.1', FUNDER, 'NoErc1271')).address;
  x = await fresh();
  y = await fresh();
  e = await fresh();
  await delegate(rec, x, pq.account, 'MLDSA44Account1271');
  await delegate(rec, y, noErc1271, 'NoErc1271');
});

afterAll(async () => {
  proxy?.kill();
  await anvil?.stop();
  // Wire evidence per row: what eth_getCode answered (and whether the proxy rewrote it), the eth_call gas.
  const wire: Record<string, Array<Record<string, unknown>>> = {};
  for (const line of fs.readFileSync(PROXY_LOG, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    const label = String(r.path || '/').replace(/^\/p04\./, '');
    const q = r.req;
    (wire[label] ??= []).push({
      method: q.method,
      block: q.method === 'eth_getCode' || q.method === 'eth_call' ? q.params[1] : undefined,
      code: q.method === 'eth_getCode' ? r.resp?.result : undefined,
      rewritten: r.rewrite === true,
      gas: q.method === 'eth_call' ? q.params[0].gas : undefined,
      selector: q.method === 'eth_call' ? String(q.params[0].input ?? q.params[0].data ?? '').slice(0, 10) : undefined,
      result: q.method === 'eth_call' ? String(r.resp?.result ?? '').slice(0, 10) || undefined : undefined,
      error: r.resp?.error ? String(r.resp.error.message ?? '').slice(0, 80) : undefined,
    });
  }
  for (const row of rows) row.detail.wire = wire[row.label] ?? [];
  fs.writeFileSync(
    path.join(OUT, 'P04_local.json'),
    JSON.stringify(
      {
        label: 'Mock: the EIP-7851 gap on a local EVM (anvil, Osaka), eth_getCode rewritten to 0xef0101 ‖ delegate by a proxy',
        env: { hardware: hardwareInfo(), chainId: chainId?.toString(), date: new Date().toISOString(), udsigH: path.relative(ROOT, UDSIG_H) },
        contracts: { ...pq, noErc1271 },
        accounts: { X: x?.address, Y: y?.address, E: e?.address },
        rows,
      },
      (k, v) => (typeof v === 'bigint' ? v.toString() : v),
      1,
    ),
  );
  if (proxyErr.trim()) fs.writeFileSync(path.join(OUT, 'P04_proxy.err'), proxyErr);
});

describe('P0.4: EIP-7851 simulation (0xef0101 ‖ delegate)', () => {
  it('the digest the crate computes is the EIP-712 digest ethers computes', () => {
    expect(digestOf(x.address)).toBe(ethersUnifiedDigest(permitFor(x.address)));
  });

  it('row 1: unmodified verifiers accept the root key of an ECDSA-disabled account (the gap)', () => {
    setRewrite([[x.address, pq.account], [y.address, noErc1271]]);
    const d = digestOf(x.address);
    const zama = crateRow('zama-unmodified', 'X', '7851', 'root-key', x.address, ecdsa(x, d), d);
    expect(zama.accepted).toBe(true);
    const legacy = crateRow('l1-legacy', 'X', '7851', 'root-key', x.address, ecdsa(x, d), d);
    expect(legacy.accepted).toBe(true);
    // Profile H `off` keeps today's ordering; `shadow` serves it and reports the code-first verdict.
    expect(crateRow('profile-h.off', 'X', '7851', 'root-key', x.address, ecdsa(x, d), d).accepted).toBe(true);
    const shadow = crateRow('profile-h.shadow', 'X', '7851', 'root-key', x.address, ecdsa(x, d), d);
    expect(shadow.accepted).toBe(true);
    expect((shadow.detail.shadow as { would_reject: boolean }).would_reject).toBe(true);
    // The same with a delegate that has no isValidSignature.
    const dy = digestOf(y.address);
    expect(crateRow('zama-unmodified', 'Y', '7851', 'root-key', y.address, ecdsa(y, dy), dy).accepted).toBe(true);
  });

  it('row 2: Profile H enforce refuses the root key: 0xef0101 is regular code, ERC-1271 only, no shim', () => {
    setRewrite([[x.address, pq.account], [y.address, noErc1271]]);
    const d = digestOf(x.address);
    const r = crateRow('profile-h.enforce', 'X', '7851', 'root-key', x.address, ecdsa(x, d), d);
    expect(r.accepted).toBe(false);
    expect(r.detail.variant).toBe('WrongMagic');
    expect(String(r.detail.code)).toMatch(/^Regular/);
    const dy = digestOf(y.address);
    const ry = crateRow('profile-h.enforce', 'Y', '7851', 'root-key', y.address, ecdsa(y, dy), dy);
    expect(ry.accepted).toBe(false);
    expect(ry.detail.variant).toBe('EmptyReturn');
    expect(String(ry.detail.code)).toMatch(/^Regular/);
  });

  it('row 3: Profile H enforce accepts the ML-DSA-44 signature at B_exec 2,000,000', () => {
    setRewrite([[x.address, pq.account], [y.address, noErc1271]]);
    const d = digestOf(x.address);
    const sig = mldsaSig(d);
    const r = crateRow('profile-h.enforce', 'X', '7851', 'ml-dsa-44', x.address, sig, d);
    expect(r.accepted).toBe(true);
    expect(String(r.detail.code)).toMatch(/^Regular/);
    // Today's verifiers refuse it: 250,000 gas cannot run the ML-DSA-44 verification.
    expect(crateRow('zama-unmodified', 'X', '7851', 'ml-dsa-44', x.address, sig, d).accepted).toBe(false);
    expect(crateRow('l1-legacy', 'X', '7851', 'ml-dsa-44', x.address, sig, d).accepted).toBe(false);
  });

  it('reference: the same accounts as EIP-7702 delegations (0xef0100), no rewrite', () => {
    setRewrite([]);
    const d = digestOf(x.address);
    expect(crateRow('zama-unmodified', 'X', '7702', 'root-key', x.address, ecdsa(x, d), d).accepted).toBe(true);
    // The delegate answers (it refuses a 65-byte signature): its verdict stands, no fallback.
    const rx = crateRow('profile-h.enforce', 'X', '7702', 'root-key', x.address, ecdsa(x, d), d);
    expect(rx.accepted).toBe(false);
    expect(String(rx.detail.code)).toMatch(/^Eip7702/);
    expect(crateRow('profile-h.enforce', 'X', '7702', 'ml-dsa-44', x.address, mldsaSig(d), d).accepted).toBe(true);
    // No isValidSignature at all: the narrow shim (H2) falls back to the root key, for 0xef0100 only.
    const dy = digestOf(y.address);
    const ry = crateRow('profile-h.enforce', 'Y', '7702', 'root-key', y.address, ecdsa(y, dy), dy);
    expect(ry.accepted).toBe(true);
    // Control: a plain EOA.
    const de = digestOf(e.address);
    expect(crateRow('profile-h.enforce', 'E', 'eoa', 'root-key', e.address, ecdsa(e, de), de).accepted).toBe(true);
  });

  it('row 5: the SDK pre-check agrees with the verifier', async () => {
    setRewrite([[x.address, pq.account], [y.address, noErc1271]]);
    expect((await sdkRow('sdk.today', 'X', '7851', 'root-key', x.address, (d) => ecdsa(x, d))).accepted).toBe(true);
    expect((await sdkRow('sdk.today', 'X', '7851', 'ml-dsa-44', x.address, mldsaSig)).accepted).toBe(false);
    const root = await sdkRow('sdk.enforce', 'X', '7851', 'root-key', x.address, (d) => ecdsa(x, d));
    expect(root.accepted).toBe(false);
    expect((await sdkRow('sdk.enforce', 'X', '7851', 'ml-dsa-44', x.address, mldsaSig)).accepted).toBe(true);
    expect((await sdkRow('sdk.enforce', 'Y', '7851', 'root-key', y.address, (d) => ecdsa(y, d))).accepted).toBe(false);
    setRewrite([]);
    expect((await sdkRow('sdk.enforce', 'Y', '7702', 'root-key', y.address, (d) => ecdsa(y, d))).accepted).toBe(true);
  });
});
