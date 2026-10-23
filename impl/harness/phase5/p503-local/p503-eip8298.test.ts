// =============================================================================
// Phase 5, P0.3: EIP-8298 (SETCODEFROM), simulated, on a local EVM (proof class: Mock).
//
// EIP-8298 (Draft) lets an EOA adopt the regular code of a deployed contract; EIP-3607 then makes its
// ECDSA-signed transactions invalid ("This retires the account's key, not the account"). No client implements
// it. Simulation: account X, a fresh local key, gets the runtime code of a deployed MLDSA44Account1271 (E4's
// ML-DSA-44 ERC-1271 wallet) with anvil_setCode. The wallet keeps its state in immutables (verifier, key blob,
// key hash), so its code is the whole wallet and there is no storage to copy. Nothing rewrites what a verifier
// reads: the JSON-RPC proxy (impl/harness/phase4/fault_proxy.py) runs with an empty rewrite table and only
// records the wire; the run fails if it rewrote anything.
//
// Accounts (fresh random keys, never printed):
//   X  first a plain EOA, then adopts MLDSA44Account1271's runtime;
//   Y  adopts NoErc1271's runtime (no isValidSignature: a call returns empty data);
//   E  a plain EOA (control).
// Signatures: the ECDSA root keys of X, Y, E; X's ML-DSA-44 key (E4's public local test seed).
//
// Verifiers, every RPC through the proxy with the row label as URL path (as in P0.4):
//   zama-unmodified  Zama's verify_signature at fhevm ed851716c (experiments/udsig-harness), 250,000 cap;
//   l1-legacy        the unchanged verify_signature inside the Level 1 crate (udsig-h verify-legacy), 250,000 cap;
//   profile-h        the Level 1 entry point verify_user_decryption_signature (udsig-h verify-h), modes
//                    off / shadow / enforce, B_exec 2,000,000;
//   sdk              Zama's SDK precautionary check (branch lifecycle/level1) with Zama's ethers adapter,
//                    without a policy (today) and with the Profile H default policy in `enforce`.
//
// Env (set by run_p503_local.sh): P503_OUT, ANVIL_PORT (8721), PROXY_PORT (8722), UDSIG_H
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Chain helpers from experiments/ (their own ethers copy).
import { ethers as xethers } from '../../../../experiments/node_modules/ethers/lib.esm/index.js';
import { startAnvil, makeProvider, makeAccounts, assertChain } from '../../../../experiments/lib/chain.mjs';
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
const OUT = path.resolve(process.env.P503_OUT ?? path.join(here, '.build'));
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8721);
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8722);
const UDSIG_H =
  process.env.UDSIG_H ??
  path.join(ROOT, 'impl', '.tools', 'target-udsig-h-l1', 'release', process.platform === 'win32' ? 'udsig-h.exe' : 'udsig-h');
const PROXY = path.join(ROOT, 'impl', 'harness', 'phase4', 'fault_proxy.py');
const B_EXEC = 2_000_000;
const LEGACY_CAP = 250_000; // kms-connector config.rs:274 erc1271_gas_limit default @ ed851716c
const REWRITE_FILE = path.join(OUT, 'P503_rewrite.json');
const PROXY_LOG = path.join(OUT, 'P503_host_rpc.jsonl');

type Code = '8298' | 'eoa';
type Row = {
  label: string;
  verifier: string;
  account: 'X' | 'Y' | 'E';
  code: Code;
  signature: 'root-key' | 'ml-dsa-44';
  accepted: boolean;
  detail: Record<string, unknown>;
};
const rows: Row[] = [];

let anvil: { url: string; stop: () => Promise<void> };
let proxy: ChildProcess;
let proxyErr = '';
let chainId: bigint;
let provider: xethers.JsonRpcProvider;
let x: xethers.Wallet;
let y: xethers.Wallet;
let e: xethers.Wallet;
let pq: Record<string, string>;
let noErc1271: string;
const adopted: Record<string, { source: string; codeLength: number; codeHash: string }> = {};
const seedHex = xethers.keccak256(xethers.toUtf8Bytes('fhe-authority-lifecycle/E4/local-test-seed/v1')).slice(2);

const proxyUrl = (label: string) => `http://127.0.0.1:${PROXY_PORT}/p503.${label}`;

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

/** EIP-8298, simulated: `account` adopts the regular runtime code of `source`, read back from the node. */
async function adopt(name: string, account: string, source: string) {
  const code = await provider.getCode(source);
  if (code === '0x' || code.toLowerCase().startsWith('0xef01')) throw new Error(`${source} has no regular code`);
  await provider.send('anvil_setCode', [account, code]);
  if ((await provider.getCode(account)).toLowerCase() !== code.toLowerCase()) throw new Error(`${name}: adopted code not in place`);
  adopted[name] = { source, codeLength: (code.length - 2) / 2, codeHash: xethers.keccak256(code) };
}

/** One crate or Zama verifier row. */
function crateRow(
  verifier: 'zama-unmodified' | 'l1-legacy' | 'profile-h.off' | 'profile-h.shadow' | 'profile-h.enforce',
  account: Row['account'],
  code: Code,
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
  code: Code,
  signature: Row['signature'],
  user: string,
  sign: (digest: string) => string,
) {
  const label = `${verifier}.${account}-${code}.${signature}`;
  const p = new ethers.JsonRpcProvider(proxyUrl(label), ethers.Network.from(Number(chainId)), {
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
  const context = createCoreFhevm(PRIVATE_ETHERS_TOKEN, { chain: sepolia, client: p, runtime });
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
  p.destroy();
  return record({ label, verifier, account, code, signature, accepted: detail.ok === true, detail: { ...detail, warnings } });
}

beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(PROXY_LOG, '');
  fs.writeFileSync(REWRITE_FILE, '{}'); // nothing is rewritten in P0.3
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

  provider = makeProvider('local', anvil.url);
  chainId = await assertChain(provider, 'local');
  const { FUNDER } = makeAccounts('local', provider);
  const rec = Object.create(Recorder.prototype);
  Object.assign(rec, { experiment: 'P503', mode: 'local', dir: OUT, file: path.join(OUT, 'P503_deploy_records.jsonl'), records: [] });
  fs.writeFileSync(rec.file, '');
  const fresh = async () => {
    const w = xethers.Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [w.address, xethers.toQuantity(10n ** 20n)]);
    return w;
  };
  pq = await deployPqStack(rec, 'P503.1', FUNDER, { seedHex });
  noErc1271 = (await deployArtifact(rec, 'P503.1', FUNDER, 'NoErc1271')).address;
  x = await fresh();
  y = await fresh();
  e = await fresh();
});

afterAll(async () => {
  proxy?.kill();
  await anvil?.stop();
  // Wire evidence per row: what eth_getCode answered (and whether the proxy rewrote it), the eth_call gas.
  const wire: Record<string, Array<Record<string, unknown>>> = {};
  let rewritten = 0;
  for (const line of fs.readFileSync(PROXY_LOG, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    const label = String(r.path || '/').replace(/^\/p503\./, '');
    const q = r.req;
    if (r.rewrite === true) rewritten++;
    (wire[label] ??= []).push({
      method: q.method,
      block: q.method === 'eth_getCode' || q.method === 'eth_call' ? q.params[1] : undefined,
      codePrefix: q.method === 'eth_getCode' ? String(r.resp?.result ?? '').slice(0, 10) : undefined,
      codeLength: q.method === 'eth_getCode' ? (String(r.resp?.result ?? '0x').length - 2) / 2 : undefined,
      rewritten: r.rewrite === true,
      gas: q.method === 'eth_call' ? q.params[0].gas : undefined,
      selector: q.method === 'eth_call' ? String(q.params[0].input ?? q.params[0].data ?? '').slice(0, 10) : undefined,
      result: q.method === 'eth_call' ? String(r.resp?.result ?? '').slice(0, 10) || undefined : undefined,
      error: r.resp?.error ? String(r.resp.error.message ?? '').slice(0, 80) : undefined,
    });
  }
  for (const row of rows) row.detail.wire = wire[row.label] ?? [];
  fs.writeFileSync(
    path.join(OUT, 'P503_local.json'),
    JSON.stringify(
      {
        label: 'Mock: EIP-8298 simulated on a local EVM (anvil, Osaka): the account holds regular wallet code (anvil_setCode); nothing rewritten',
        env: { hardware: hardwareInfo(), chainId: chainId?.toString(), date: new Date().toISOString(), udsigH: path.relative(ROOT, UDSIG_H) },
        contracts: { ...pq, noErc1271 },
        accounts: { X: x?.address, Y: y?.address, E: e?.address },
        adopted,
        proxyRewritten: rewritten,
        rows,
      },
      (k, v) => (typeof v === 'bigint' ? v.toString() : v),
      1,
    ),
  );
  if (proxyErr.trim()) fs.writeFileSync(path.join(OUT, 'P503_proxy.err'), proxyErr);
});

describe('P0.3: EIP-8298 simulation (adopted regular code)', () => {
  it('the digest the crate computes is the EIP-712 digest ethers computes', () => {
    expect(digestOf(x.address)).toBe(ethersUnifiedDigest(permitFor(x.address)));
  });

  it('reference: X as a plain EOA is accepted by every verifier', () => {
    const d = digestOf(x.address);
    for (const v of ['zama-unmodified', 'l1-legacy', 'profile-h.enforce'] as const) {
      const r = crateRow(v, 'X', 'eoa', 'root-key', x.address, ecdsa(x, d), d);
      expect(r.accepted, v).toBe(true);
    }
  });

  it('adoption: X takes the ML-DSA-44 wallet runtime, Y the NoErc1271 runtime (anvil_setCode)', async () => {
    await adopt('X', x.address, pq.account);
    await adopt('Y', y.address, noErc1271);
    expect(adopted.X!.codeLength).toBeGreaterThan(23);
    expect(adopted.Y!.codeLength).toBeGreaterThan(0);
  });

  it('the gap: unmodified verifiers accept the root key of an account holding regular code', () => {
    const d = digestOf(x.address);
    const zama = crateRow('zama-unmodified', 'X', '8298', 'root-key', x.address, ecdsa(x, d), d);
    expect(zama.accepted).toBe(true);
    const legacy = crateRow('l1-legacy', 'X', '8298', 'root-key', x.address, ecdsa(x, d), d);
    expect(legacy.accepted).toBe(true);
    // Profile H `off` keeps today's ordering; `shadow` serves it and reports the code-first verdict.
    expect(crateRow('profile-h.off', 'X', '8298', 'root-key', x.address, ecdsa(x, d), d).accepted).toBe(true);
    const shadow = crateRow('profile-h.shadow', 'X', '8298', 'root-key', x.address, ecdsa(x, d), d);
    expect(shadow.accepted).toBe(true);
    expect((shadow.detail.shadow as { would_reject: boolean }).would_reject).toBe(true);
    // The same with code that has no isValidSignature.
    const dy = digestOf(y.address);
    expect(crateRow('zama-unmodified', 'Y', '8298', 'root-key', y.address, ecdsa(y, dy), dy).accepted).toBe(true);
  });

  it('Profile H enforce refuses the root key: regular code, ERC-1271 only, no shim', () => {
    const d = digestOf(x.address);
    const r = crateRow('profile-h.enforce', 'X', '8298', 'root-key', x.address, ecdsa(x, d), d);
    expect(r.accepted).toBe(false);
    expect(r.detail.variant).toBe('WrongMagic');
    expect(String(r.detail.code)).toMatch(/^Regular/);
    const dy = digestOf(y.address);
    const ry = crateRow('profile-h.enforce', 'Y', '8298', 'root-key', y.address, ecdsa(y, dy), dy);
    expect(ry.accepted).toBe(false);
    expect(ry.detail.variant).toBe('EmptyReturn');
    expect(String(ry.detail.code)).toMatch(/^Regular/);
  });

  it('Profile H enforce accepts the wallet ML-DSA-44 signature at B_exec 2,000,000', () => {
    const d = digestOf(x.address);
    const sig = mldsaSig(d);
    const r = crateRow('profile-h.enforce', 'X', '8298', 'ml-dsa-44', x.address, sig, d);
    expect(r.accepted).toBe(true);
    expect(String(r.detail.code)).toMatch(/^Regular/);
    // Today's verifiers refuse it: 250,000 gas cannot run the ML-DSA-44 verification.
    expect(crateRow('zama-unmodified', 'X', '8298', 'ml-dsa-44', x.address, sig, d).accepted).toBe(false);
    expect(crateRow('l1-legacy', 'X', '8298', 'ml-dsa-44', x.address, sig, d).accepted).toBe(false);
    // Control: a plain EOA under enforce.
    const de = digestOf(e.address);
    expect(crateRow('profile-h.enforce', 'E', 'eoa', 'root-key', e.address, ecdsa(e, de), de).accepted).toBe(true);
  });

  it('the SDK pre-check agrees with the verifier', async () => {
    expect((await sdkRow('sdk.today', 'X', '8298', 'root-key', x.address, (d) => ecdsa(x, d))).accepted).toBe(true);
    expect((await sdkRow('sdk.today', 'X', '8298', 'ml-dsa-44', x.address, mldsaSig)).accepted).toBe(false);
    expect((await sdkRow('sdk.enforce', 'X', '8298', 'root-key', x.address, (d) => ecdsa(x, d))).accepted).toBe(false);
    expect((await sdkRow('sdk.enforce', 'X', '8298', 'ml-dsa-44', x.address, mldsaSig)).accepted).toBe(true);
    expect((await sdkRow('sdk.enforce', 'Y', '8298', 'root-key', y.address, (d) => ecdsa(y, d))).accepted).toBe(false);
    expect((await sdkRow('sdk.enforce', 'E', 'eoa', 'root-key', e.address, (d) => ecdsa(e, d))).accepted).toBe(true);
  });

  it('the proxy rewrote nothing: every verifier read the node own answer', () => {
    const lines = fs.readFileSync(PROXY_LOG, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => JSON.parse(l).rewrite === true)).toHaveLength(0);
  });
});
