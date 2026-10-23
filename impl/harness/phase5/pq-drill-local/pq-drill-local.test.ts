// =============================================================================
// Phase 5, Part B on a local chain (proof class: Mock): the paths, set up with the real tools, then
//   - the old key's transactions after each path (B6, the on-chain part);
//   - the SDK: getAuthorityStatus and the Profile H precheck;
//   - B5: the registry owned by an operator-ratified upgrader (ML-DSA-44, 9 of 13), the guard, the canary;
//   - B8: every step's receipt.
//
// The registry is the Level 3 ACL v0.10.0 (Core, E1, E2), deployed with Zama's flow from the artifact of
// impl/harness/phase5/build_p5_artifacts.sh. The holders' wallets are the B0 wallet (impl/pq-wallet). Every key is
// our own test key: the old ECDSA keys are fresh random keys standing in for keys someone else also knows; the ML-DSA
// keys derive from public labels through E4's signer (experiments/E4/pq/mldsa_tool.py, the verifier repository's own
// code: unaudited). The paths:
//   B1   A carries its history to W1 with the carry tool (impl/carry-tool), which also retires A;
//   B2d  A designates W2, W2 accepts through `execute`, D passes, A confirms and retires;
//   B2c  the same with W3, then the watchtower (impl/watchtower) relays A's E2 certificate;
//   B3a  A delegates (EIP-7702, a type-4 transaction) to the wallet's code and sets its key in the same transaction;
//        the proxy answers eth_getCode(A) with 0xef0101 (EIP-7851, simulated);
//   B3b  the same, then A adopts the wallet's code (EIP-8298, simulated with anvil_setCode; storage stays).
//
// Env (set by run_pq_drill_local.sh): PQL_OUT, PQL_HARDFORK (osaka | amsterdam), PQL_ANVIL (binary), ANVIL_PORT
// (8761), PROXY_PORT (8762).
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFhevmBaseClient as createEthersBaseClient, setFhevmRuntimeConfig as setEthersRuntimeConfig } from '@fhevm/sdk/ethers';
import { defineFhevmChain } from '@fhevm/sdk/chains';
import { getAuthorityStatus } from '@fhevm/sdk/actions/host';
import { verifyErc1271UserDecrypt } from '@sdk-src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts';
import { PROFILE_H_DEFAULT_SIGNATURE_POLICY } from '@sdk-src/core/utils-p/decrypt/userDecryptSignaturePolicy.ts';
import { kmsUserDecryptEip712V2Types } from '@sdk-src/core/kms/kmsUserDecryptEip712V2Types.ts';
import { ethereumModule } from '@sdk-src/ethers/internal/ethereum.ts';
import { PRIVATE_ETHERS_TOKEN } from '@sdk-src/ethers/internal/ethers-p.ts';
import { createFhevmRuntime } from '@sdk-src/core/runtime/CoreFhevmRuntime-p.ts';
import { createCoreFhevm } from '@sdk-src/core/runtime/CoreFhevm-p.ts';
import { sepolia } from '@sdk-src/core/chains/definitions/sepolia.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');
const SCRATCH = path.resolve(ROOT, '..', 'scratch');
const OUT = path.resolve(process.env.PQL_OUT ?? path.join(here, '.build'));
const HARDFORK = process.env.PQL_HARDFORK ?? 'osaka';
const ANVIL = process.env.PQL_ANVIL ?? path.join(process.env.USERPROFILE ?? '', '.foundry', 'bin', 'anvil.exe');
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8761);
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8762);
const RPC = `http://127.0.0.1:${ANVIL_PORT}`;
const PROXY = path.join(ROOT, 'impl', 'harness', 'phase4', 'fault_proxy.py');
const REWRITE_FILE = path.join(OUT, 'PQL_rewrite.json');
const PROXY_LOG = path.join(OUT, 'PQL_host_rpc.jsonl');
const ART = path.join(ROOT, 'results', 'phase5', 'vps-artifacts');
// The paths below default to the project's own layout; scripts/repro.py (`make pq-drill`) overrides them for a fresh
// clone: the Python with eth-abi for E4's signer, the verifier checkout at cca262b5, the Python for the RPC proxy, and
// the gas meter's build.
const MLDSA_PY = process.env.PQL_MLDSA_PY ?? path.join(ROOT, 'experiments', 'E4', 'pq', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const MLDSA_TOOL = path.join(ROOT, 'experiments', 'E4', 'pq', 'mldsa_tool.py');
const MLDSA_REPO = process.env.PQL_MLDSA_REPO ?? path.join(SCRATCH, 'pq-verifiers', 'evm-ml-dsa-verifier');
const PYTHON = process.env.PQL_PYTHON ?? 'python';
const METER_ART = process.env.PQL_METER_ART ?? path.join(ROOT, 'experiments', 'contracts', 'out', 'Erc1271GasMeter.sol', 'Erc1271GasMeter.json');
const F1600_HEX = path.join(ROOT, 'impl', 'p3-operator-ratification', 'vendor', 'evm-ml-dsa-verifier-cca262b5', 'helpers', 'f1600_170.hex');
const F1600_CODEHASH = '0x4afb4435879cdf8e50474c7aab2bc3a679caed432550ad6dba64f509309a817b';
const KEY_LABEL = 'fhe-authority-lifecycle/P5/drill/holder-key/v1/';
const OPERATOR_LABEL = 'fhe-authority-lifecycle/P5/B5/operator-key/v1/';
const TX_CAP = 16_777_216n; // EIP-7825: 2^24 per transaction
// Under Amsterdam the code deposit is state gas (EIP-8037), so large deployments need more than 2^24 in total; the
// local pool accepts that unless --enable-tx-gas-limit is set (Phase 4, D66), and the block limit is raised to fit.
const DEPLOY_GAS = (process.env.PQL_HARDFORK ?? 'osaka') === 'amsterdam' ? 120_000_000n : TX_CAP;
const DAY = 86_400;
// Anvil's well-known development keys (public test values, local chains only).
const DEV_KEYS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];

type Artifact = { abi: ethers.InterfaceAbi; bytecode: string; deployed: string };
function artifact(p: string): Artifact {
  const a = JSON.parse(fs.readFileSync(p, 'utf8'));
  const obj = (x: unknown) => (typeof x === 'string' ? x : (x as { object: string }).object);
  return { abi: a.abi, bytecode: obj(a.bytecode), deployed: obj(a.deployedBytecode) };
}
const A = {
  acl: () => artifact(path.join(ART, 'level3_acl_main.json')),
  empty: () => artifact(path.join(ART, 'empty_uups_proxy_acl_main.json')),
  proxy: () => artifact(path.join(ART, 'DeployableERC1967Proxy.json')),
  executor: () => artifact(path.join(ART, 'ExecutorStub.json')),
  dapp: () => artifact(path.join(ART, 'DappStub.json')),
  base: () => artifact(path.join(ART, 'base_acl_main.json')),
  wallet: () => artifact(path.join(ROOT, 'impl', 'pq-wallet', 'out', 'PQWallet.sol', 'PQWallet.json')),
  verifier: () => artifact(path.join(ROOT, 'impl', 'pq-wallet', 'out', 'MLDSA44Verifier.sol', 'MLDSA44Verifier.json')),
  owner: () => artifact(path.join(ROOT, 'impl', 'p3-operator-ratification', 'out', 'OperatorRatifiedRegistryOwner.sol', 'OperatorRatifiedRegistryOwner.json')),
};

// ---------------------------------------------------------------------------- the chain
let anvil: ChildProcess;
let proxy: ChildProcess;
let provider: ethers.JsonRpcProvider;
const rows: Array<Record<string, unknown>> = [];
const receipts: Array<Record<string, unknown>> = [];
let errIface: ethers.Interface;

function record(row: Record<string, unknown>) {
  rows.push(row);
  return row;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitUp(url: string) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
      if (r.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`${url} did not come up`);
}

/** The receipt of `hash`, polled within a bound (a wait that misses it once can hang on anvil). */
async function receiptOf(hash: string): Promise<ethers.TransactionReceipt> {
  for (let i = 0; i < 200; i++) {
    const r = await provider.getTransactionReceipt(hash);
    if (r) return r;
    await sleep(50);
  }
  throw new Error(`no receipt for ${hash}`);
}

function revertName(e: unknown): string {
  const any = e as { data?: string; info?: { error?: { data?: string } }; error?: { data?: string }; shortMessage?: string; message?: string };
  const data = any?.data ?? any?.info?.error?.data ?? any?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
    try {
      const parsed = errIface.parseError(data);
      if (parsed) return parsed.name;
    } catch {}
    return data.slice(0, 10);
  }
  return `error:${(any?.shortMessage ?? any?.message ?? String(e)).slice(0, 80)}`;
}

/** One transaction: simulated first (for the revert reason), then sent with a fixed gas limit, so that a refusal is a
 *  mined, reverted transaction. */
async function sendTx(from: ethers.Wallet, to: string, data: string, what: string, opts: { gasLimit?: bigint; value?: bigint } = {}) {
  let revert = '-';
  try {
    await provider.call({ from: from.address, to, data, value: opts.value });
  } catch (e) {
    revert = revertName(e);
  }
  const tx = await from.sendTransaction({ to, data, gasLimit: opts.gasLimit ?? 3_000_000n, value: opts.value });
  const r = await receiptOf(tx.hash);
  const out = { what, status: r.status, gasUsed: r.gasUsed.toString(), revert, calldataBytes: (data.length - 2) / 2, block: r.blockNumber };
  receipts.push(out);
  return out;
}

async function deploy(from: ethers.Wallet, art: Artifact, args: unknown[], what: string, gasLimit = DEPLOY_GAS): Promise<string> {
  const f = new ethers.ContractFactory(art.abi, art.bytecode);
  const tx = await f.getDeployTransaction(...args);
  const sent = await from.sendTransaction({ data: tx.data, gasLimit });
  const r = await receiptOf(sent.hash);
  receipts.push({ what, status: r.status, gasUsed: r.gasUsed.toString(), initcodeBytes: (tx.data!.length - 2) / 2, address: r.contractAddress });
  if (r.status !== 1 || !r.contractAddress) throw new Error(`${what}: deployment failed (gas used ${r.gasUsed})`);
  return ethers.getAddress(r.contractAddress);
}

/** Init code that deploys `data` as a contract's code (a data contract: the key blob, the Keccak helper). */
function dataInitCode(data: string) {
  const len = (data.length - 2) / 2;
  const u16 = (n: number) => n.toString(16).padStart(4, '0');
  return '0x61' + u16(len) + '600e600039' + '61' + u16(len) + '6000f3' + data.slice(2);
}
async function deployData(from: ethers.Wallet, data: string, what: string): Promise<string> {
  const sent = await from.sendTransaction({ data: dataInitCode(data), gasLimit: DEPLOY_GAS });
  const r = await receiptOf(sent.hash);
  receipts.push({ what, status: r.status, gasUsed: r.gasUsed.toString(), codeBytes: (data.length - 2) / 2, address: r.contractAddress });
  if (r.status !== 1 || !r.contractAddress) throw new Error(`${what}: deployment failed (gas used ${r.gasUsed})`);
  return ethers.getAddress(r.contractAddress);
}

/** Runtime code that returns abi.encode(version) for any call: PUSH2 len, PUSH2 15, PUSH1 0, CODECOPY, PUSH2 len,
 *  PUSH1 0, RETURN, then the encoded string. */
function versionStub(version: string) {
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [version]);
  const len = ((enc.length - 2) / 2).toString(16).padStart(4, '0');
  return '0x61' + len + '61000f600039' + '61' + len + '6000f3' + enc.slice(2);
}

// ---------------------------------------------------------------------------- ML-DSA-44 (E4's signer)
function mldsa(label: string, args: string[]) {
  const seed = ethers.keccak256(ethers.toUtf8Bytes(label)).slice(2);
  const r = spawnSync(MLDSA_PY, ['-I', '-B', MLDSA_TOOL, '--repo', MLDSA_REPO, ...args], {
    env: { SYSTEMROOT: process.env.SYSTEMROOT ?? '', PATH: process.env.PATH ?? '', MLDSA44_SEED_HEX: seed },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`mldsa_tool ${args[0]}: ${(r.stderr || '').slice(-600)}`);
  return JSON.parse(r.stdout);
}
const mldsaKey = (label: string) => {
  const v = mldsa(label, ['pubkey']);
  return { pk: '0x' + v.pk, blob: '0x' + v.blob, pkHash: ethers.keccak256('0x' + v.pk) };
};
const mldsaSign = (label: string, digest: string) => {
  const v = mldsa(label, ['sign', '--msg', digest]);
  if (v.self_verified !== true) throw new Error('ML-DSA signature did not self-verify');
  return '0x' + v.sig;
};

// ---------------------------------------------------------------------------- the scenario's state
type Path = {
  name: 'B1' | 'B2d' | 'B2c' | 'B3a' | 'B3b';
  old: ethers.Wallet;
  label: string; // the holder's ML-DSA key label
  holder: string;
  history: string[];
  hv: string;
  kda: string;
};
const S: Record<string, any> = {};
let paths: Path[] = [];
const inPlace = (p: Path) => p.name.startsWith('B3');

function makeHandle(chainId: bigint) {
  const h = ethers.getBytes(ethers.randomBytes(32));
  h[21] = 0xff;
  const c = ethers.getBytes(ethers.toBeHex(chainId, 8));
  h.set(c, 22);
  h[30] = 5;
  h[31] = 0;
  return ethers.hexlify(h);
}

async function grant(handle: string, user: string, what: string) {
  const exec = new ethers.Interface(A.executor().abi);
  return sendTx(S.funder, S.executor, exec.encodeFunctionData('produce', [S.acl, handle, S.dapp, user]), what);
}

/** `wallet.execute(target, data)`, authorized by the wallet's ML-DSA-44 key, relayed by a development account. */
async function execute(wallet: string, label: string, target: string, data: string, what: string) {
  const w = new ethers.Contract(wallet, A.wallet().abi, provider);
  const digest: string = await w.executeDigest(target, data);
  const sig = mldsaSign(label, digest);
  const call = w.interface.encodeFunctionData('execute', [target, data, sig]);
  const r = await sendTx(S.relayer, wallet, call, what, { gasLimit: 4_000_000n });
  if (r.status !== 1) throw new Error(`${what}: reverted (${r.revert})`);
  return r;
}

function proxyProvider(label: string) {
  return new ethers.JsonRpcProvider(`http://127.0.0.1:${PROXY_PORT}/pql.${label}`, ethers.Network.from(31337), { staticNetwork: true, cacheTimeout: -1, batchMaxCount: 1 });
}

/** getAuthorityStatus through the SDK's ethers adapter, over the proxy (which answers 0xef0101 for B3a's account). */
async function status(label: string, address: string) {
  const p = proxyProvider(`status.${label}`);
  try {
    return await getAuthorityStatus(createEthersBaseClient({ provider: p, chain: S.chain }) as never, { address });
  } finally {
    p.destroy();
  }
}

/** The SDK's precautionary check with the Profile H policy (`enforce`), over the proxy. */
async function precheck(label: string, user: string, sign: (digest: string) => string) {
  const p = proxyProvider(`precheck.${label}`);
  const runtime = createFhevmRuntime(PRIVATE_ETHERS_TOKEN, {
    ethereum: ethereumModule().ethereum,
    relayer: {} as never,
    config: { logger: { debug: undefined, warn: () => {}, error: undefined } },
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
  } as never as { types: Record<string, ethers.TypedDataField[]>; primaryType: string; domain: ethers.TypedDataDomain; message: Record<string, unknown> };
  const digest = ethers.TypedDataEncoder.hash(eip712.domain, { [eip712.primaryType]: [...eip712.types[eip712.primaryType]!] }, eip712.message);
  const policy = { ...PROFILE_H_DEFAULT_SIGNATURE_POLICY, codeFirstMode: 'enforce' };
  try {
    await verifyErc1271UserDecrypt(context, { userAddress: ethers.getAddress(user) as never, eip712: eip712 as never, signature: sign(digest) as never, policy });
    return { accepted: true };
  } catch (e) {
    return { accepted: false, error: (e as Error).constructor.name };
  } finally {
    p.destroy();
  }
}

function runNode(script: string, args: string[], env: Record<string, string>) {
  const r = spawnSync(process.execPath, [script, ...args], {
    env: { SYSTEMROOT: process.env.SYSTEMROOT ?? '', PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// ---------------------------------------------------------------------------- setup
beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(PROXY_LOG, '');
  fs.writeFileSync(REWRITE_FILE, '{}');
  const gasArgs = HARDFORK === 'amsterdam' ? ['--gas-limit', '300000000'] : [];
  anvil = spawn(ANVIL, ['--host', '127.0.0.1', '--port', String(ANVIL_PORT), '--hardfork', HARDFORK, ...gasArgs, '--silent'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  await waitUp(RPC);
  proxy = spawn(PYTHON, ['-I', PROXY, String(PROXY_PORT), RPC, PROXY_LOG, '--rewrite-file', REWRITE_FILE], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
  await waitUp(`http://127.0.0.1:${PROXY_PORT}`);
  fs.writeFileSync(PROXY_LOG, '');
  provider = new ethers.JsonRpcProvider(RPC, ethers.Network.from(31337), { staticNetwork: true, cacheTimeout: -1, batchMaxCount: 1 });
  const node = await provider.send('anvil_nodeInfo', []);
  S.env = { hardfork: node?.hardFork, client: await provider.send('web3_clientVersion', []), anvil: ANVIL.replace(/\\/g, '/').split('/').slice(-3).join('/') };
  errIface = new ethers.Interface([
    ...(A.acl().abi as ethers.InterfaceAbi as unknown[]).filter((x: any) => x.type === 'error'),
    ...(A.wallet().abi as unknown[]).filter((x: any) => x.type === 'error'),
    ...(A.owner().abi as unknown[]).filter((x: any) => x.type === 'error'),
    'error Error(string)',
  ] as ethers.InterfaceAbi);
  S.funder = new ethers.Wallet(DEV_KEYS[0]!, provider);
  S.relayer = new ethers.Wallet(DEV_KEYS[1]!, provider);
  S.v = new ethers.Wallet(DEV_KEYS[2]!, provider);
  const fresh = async () => {
    const w = ethers.Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [w.address, ethers.toQuantity(ethers.parseEther('100'))]);
    return w as unknown as ethers.Wallet;
  };

  // The registry: EmptyUUPSProxyACL behind an ERC-1967 proxy, then upgraded to the Level 3 ACL (Zama's flow).
  const emptyArt = A.empty();
  const empty = await deploy(S.funder, emptyArt, [], 'EmptyUUPSProxyACL');
  const init = new ethers.Interface(emptyArt.abi).encodeFunctionData('initialize', [S.funder.address]);
  S.acl = await deploy(S.funder, A.proxy(), [empty, init], 'ERC1967 proxy');
  S.impl = await deploy(S.funder, A.acl(), [], 'ACL v0.10.0 implementation');
  const aclIface = new ethers.Interface(A.acl().abi);
  const up = await sendTx(S.funder, S.acl, new ethers.Interface(emptyArt.abi).encodeFunctionData('upgradeToAndCall', [S.impl, aclIface.encodeFunctionData('initializeFromEmptyProxy', [])]), 'upgradeToAndCall(ACL, initializeFromEmptyProxy())');
  expect(up.status).toBe(1);
  S.reg = new ethers.Contract(S.acl, A.acl().abi, provider);
  expect(await S.reg.getVersion()).toBe('ACL v0.10.0');
  // Test-only stand-ins, as in the connector harness: the executor and the confidential bridge (a no-op).
  S.executor = ethers.getAddress(await S.reg.getFHEVMExecutorAddress());
  await provider.send('anvil_setCode', [S.executor, A.executor().deployed]);
  S.bridge = ethers.getAddress(await S.reg.getConfidentialBridgeAddress());
  await provider.send('anvil_setCode', [S.bridge, '0x00']);
  S.dapp = await deploy(S.funder, A.dapp(), [], 'DappStub');

  // The ML-DSA-44 verifier (Fireblocks cca262b5, unaudited) and its Keccak helper, deployed by transactions.
  const helperHex = '0x' + fs.readFileSync(F1600_HEX, 'utf8').replace(/\s+/g, '').replace(/^0x/, '');
  expect(ethers.keccak256(helperHex)).toBe(F1600_CODEHASH);
  S.helper = await deployData(S.funder, helperHex, 'Keccak-f1600 helper (data contract)');
  S.verifier = await deploy(S.funder, A.verifier(), [S.helper], 'MLDSA44Verifier');
  S.template = await deploy(S.funder, A.wallet(), [S.verifier, ethers.ZeroAddress, ethers.ZeroHash], 'PQWallet code without a key');

  // B5: the registry's owner is the operator-ratified upgrader: 13 ML-DSA-44 operator keys, 9 of 13, 7 days.
  S.operators = [] as string[];
  for (let i = 0; i < 13; i++) {
    const k = mldsaKey(`${OPERATOR_LABEL}${i}`);
    S.operators.push(await deployData(S.funder, k.blob, `operator ${i} key blob`));
  }
  S.owner = await deploy(S.funder, A.owner(), [S.verifier, S.acl, S.funder.address, S.operators, 9, 7 * DAY], 'OperatorRatifiedRegistryOwner');
  const own = new ethers.Contract(S.owner, A.owner().abi, provider);
  expect((await sendTx(S.funder, S.acl, aclIface.encodeFunctionData('transferOwnership', [S.owner]), 'ACL.transferOwnership(upgrader)')).status).toBe(1);
  expect((await sendTx(S.relayer, S.owner, own.interface.encodeFunctionData('acceptRegistryOwnership', []), 'upgrader.acceptRegistryOwnership()')).status).toBe(1);
  expect(ethers.getAddress(await S.reg.owner())).toBe(S.owner);

  // The SDK's chain: only the ACL is read (the other addresses are never contacted).
  S.chain = defineFhevmChain({
    id: 31337,
    fhevm: {
      contracts: {
        acl: { address: S.acl as `0x${string}` },
        inputVerifier: { address: '0x000000000000000000000000000000000000c0d1' },
        kmsVerifier: { address: '0x000000000000000000000000000000000000c0d2' },
      },
      relayerUrl: 'http://127.0.0.1:9',
      gateway: { id: 54321, contracts: { decryption: { address: '0x000000000000000000000000000000000000c0d3' }, inputVerification: { address: '0x000000000000000000000000000000000000c0d4' } } },
    },
  });
  setEthersRuntimeConfig({});
  // Test-only stand-ins: the SDK reads the InputVerifier's and the KMSVerifier's getVersion() before any status read.
  // Each answers every call with its contract's version on main ed851716c.
  await provider.send('anvil_setCode', ['0x000000000000000000000000000000000000c0d1', versionStub('InputVerifier v0.3.0')]);
  await provider.send('anvil_setCode', ['0x000000000000000000000000000000000000c0d2', versionStub('KMSVerifier v0.5.0')]);

  // The paths: an old key, a holder key, three handles of history, V's delegation to A and A's to Dk.
  const chainId = 31337n;
  const exp = BigInt(Math.floor(Date.now() / 1000) + 365 * DAY);
  S.dk = await fresh();
  for (const name of ['B1', 'B2d', 'B2c', 'B3a', 'B3b'] as const) {
    const old = await fresh();
    const label = `${KEY_LABEL}${name}`;
    let holder = old.address;
    if (!name.startsWith('B3')) {
      const k = mldsaKey(label);
      const blob = await deployData(S.funder, k.blob, `${name} holder key blob`);
      holder = await deploy(S.funder, A.wallet(), [S.verifier, blob, k.pkHash], `${name} wallet W`);
    }
    const history: string[] = [];
    for (let i = 0; i < 3; i++) {
      const h = makeHandle(chainId);
      await grant(h, old.address, `${name} grant h${i}`);
      history.push(h);
    }
    const hv = makeHandle(chainId);
    await grant(hv, S.v.address, `${name} grant hv to V`);
    await sendTx(S.v, S.acl, aclIface.encodeFunctionData('delegateForUserDecryption', [old.address, S.dapp, exp]), `${name} V delegates to A`);
    await sendTx(old, S.acl, aclIface.encodeFunctionData('delegateForUserDecryption', [S.dk.address, S.dapp, exp]), `${name} A delegates to Dk`);
    paths.push({ name, old, label, holder, history, hv, kda: ethers.getAddress(ethers.dataSlice(ethers.keccak256(ethers.toUtf8Bytes(`pql-kda-${name}`)), 12)) });
  }
  S.exp = exp;
  S.aclIface = aclIface;
}, 1_800_000);

afterAll(async () => {
  proxy?.kill();
  anvil?.kill();
  const wire: Record<string, Record<string, number>> = {};
  let rewritten = 0;
  for (const line of fs.readFileSync(PROXY_LOG, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.rewrite === true) rewritten++;
    const label = String(r.path || '/').replace(/^\//, '');
    const k = r.req?.method === 'eth_getCode' ? `eth_getCode${r.rewrite ? ' (rewritten)' : ''}` : r.req?.method;
    (wire[label] ??= {})[k] = ((wire[label] ??= {})[k] ?? 0) + 1;
  }
  const plain = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
  fs.writeFileSync(path.join(OUT, 'PQL_result.json'), JSON.stringify(plain({
    label: `Mock: the post-quantum path on a local chain (anvil, ${HARDFORK})`,
    env: S.env, hardfork: HARDFORK, date: new Date().toISOString(),
    addresses: { acl: S.acl, impl: S.impl, owner: S.owner, verifier: S.verifier, template: S.template, dapp: S.dapp },
    paths: paths.map((p) => ({ name: p.name, old: p.old.address, holder: p.holder, history: p.history })),
    rows, receipts, proxyRewritten: rewritten, wire,
  }), null, 1));
});

// ---------------------------------------------------------------------------- the paths
describe(`Part B on a local chain (${HARDFORK})`, () => {
  it('B1: the carry tool carries the history to W1 and retires A in one transaction', () => {
    const b = paths[0]!;
    const json = path.join(OUT, 'PQL_carry_B1.json');
    const r = runNode(path.join(ROOT, 'impl', 'carry-tool', 'carry.mjs'),
      ['--rpc', RPC, '--acl', S.acl, '--old', b.old.address, '--new', b.holder, '--allow-contract', S.dapp, '--signer', 'env', '--json', json],
      { CARRY_OLD_PRIVATE_KEY: b.old.privateKey });
    fs.writeFileSync(path.join(OUT, 'PQL_carry_B1.log'), r.stdout + r.stderr);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const out = JSON.parse(fs.readFileSync(json, 'utf8'));
    for (const s of out.result.sent) receipts.push({ what: `B1 carry tool tx ${s.chunk} (${s.handles} handles${s.retires ? ' + retireAccount()' : ''})`, status: s.status, gasUsed: String(s.gasUsed), calldataBytes: s.calldataBytes });
    record({ kind: 'path', path: 'B1', step: 'carry', handles: out.plan.kept.length, verified: out.result.verified?.ok });
    expect(out.plan.kept.length).toBe(3);
    expect(out.result.verified.ok).toBe(true);
  });

  it('B2: designation, acceptance through execute, the delay, confirmation; B2d retires, B2c through the watchtower', async () => {
    const iface: ethers.Interface = S.aclIface;
    for (const b of [paths[1]!, paths[2]!]) {
      expect((await sendTx(b.old, S.acl, iface.encodeFunctionData('designateSuccessor', [b.holder]), `${b.name} designateSuccessor`)).status).toBe(1);
      await execute(b.holder, b.label, S.acl, iface.encodeFunctionData('acceptSuccession', [b.old.address]), `${b.name} W accepts (execute)`);
    }
    const delay = Number(await S.reg.successorDelayOf(paths[1]!.old.address));
    await provider.send('evm_increaseTime', [delay]);
    await provider.send('evm_mine', []);
    for (const b of [paths[1]!, paths[2]!]) {
      expect((await sendTx(b.old, S.acl, iface.encodeFunctionData('confirmSuccessor', []), `${b.name} confirmSuccessor`)).status).toBe(1);
    }
    expect((await sendTx(paths[1]!.old, S.acl, iface.encodeFunctionData('retireAccount', []), 'B2d retireAccount')).status).toBe(1);
    // B2c: A signed its certificate while its key was safe; the watchtower relays it.
    const b = paths[2]!;
    const cert = { account: b.old.address, successor: b.holder, chainIds: [31337n] };
    const signature = await b.old.signTypedData({ name: 'DecryptionAuthorityLifecycle', version: '1' },
      { RetireAccount: [{ name: 'account', type: 'address' }, { name: 'successor', type: 'address' }, { name: 'chainIds', type: 'uint256[]' }] }, cert);
    const cfg = path.join(OUT, 'PQL_watchtower_B2c.json');
    fs.writeFileSync(cfg, JSON.stringify({ certificate: { ...cert, chainIds: ['31337'], signature }, chains: [{ name: 'local', rpc: RPC, acl: S.acl }], relayer: S.relayer.address }));
    const r = runNode(path.join(ROOT, 'impl', 'watchtower', 'watchtower.mjs'), ['relay', '--config', cfg, '--signer', 'env'], { WATCHTOWER_RELAYER_KEY: S.relayer.privateKey });
    fs.writeFileSync(path.join(OUT, 'PQL_watchtower_B2c.log'), r.stdout + r.stderr);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const relayed = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    receipts.push({ what: 'B2c certificate relayed by the watchtower', status: relayed.status, gasUsed: String(relayed.gasUsed), calldataBytes: relayed.calldataBytes });
    for (const p of [paths[1]!, paths[2]!]) {
      expect(await S.reg.isAccountRetired(p.old.address)).toBe(true);
      expect(ethers.getAddress(await S.reg.successorOf(p.old.address))).toBe(p.holder);
    }
    record({ kind: 'path', path: 'B2', step: 'successor confirmed, retired (B2d) and certified (B2c)', delaySeconds: delay });
  });

  it('B3: a type-4 transaction delegates A to the wallet code and sets its key; B3a reads as EIP-7851, B3b adopts the code', async () => {
    const walletIface = new ethers.Interface(A.wallet().abi);
    const rewrite: Record<string, string> = {};
    for (const b of [paths[3]!, paths[4]!]) {
      const k = mldsaKey(b.label);
      const blob = await deployData(S.funder, k.blob, `${b.name} key blob`);
      const nonce = await provider.getTransactionCount(b.old.address, 'pending');
      const auth = await b.old.authorize({ address: S.template, nonce: nonce + 1, chainId: 31337n });
      const tx = await b.old.sendTransaction({ type: 4, to: b.old.address, data: walletIface.encodeFunctionData('initialize', [blob, k.pkHash]), authorizationList: [auth], nonce, gasLimit: 300_000n });
      const r = await receiptOf(tx.hash);
      receipts.push({ what: `${b.name} type-4 delegation and initialize (one transaction)`, status: r.status, gasUsed: r.gasUsed.toString() });
      expect(r.status).toBe(1);
      expect((await provider.getCode(b.old.address)).toLowerCase()).toBe(('0xef0100' + S.template.slice(2)).toLowerCase());
      if (b.name === 'B3a') {
        rewrite[b.old.address.toLowerCase()] = ('0xef0101' + S.template.slice(2)).toLowerCase();
      } else {
        // EIP-8298, simulated: the account adopts the wallet's regular code; the storage written through the delegation stays.
        await provider.send('anvil_setCode', [b.old.address, await provider.getCode(S.template)]);
        const w = new ethers.Contract(b.old.address, A.wallet().abi, provider);
        const [kb] = await w.key();
        expect(ethers.getAddress(kb)).toBe(blob);
      }
    }
    fs.writeFileSync(REWRITE_FILE, JSON.stringify(rewrite));
    // Every holder declares a KDA (E3) through `execute`.
    for (const b of paths) {
      await execute(b.holder, b.label, S.acl, S.aclIface.encodeFunctionData('delegateForUserDecryption', [b.kda, S.dapp, S.exp]), `${b.name} holder declares its KDA (execute)`);
    }
    record({ kind: 'path', path: 'B3', step: 'delegated, keyed; B3a rewritten to 0xef0101, B3b adopted' });
  });

  // -------------------------------------------------------------------------- the SDK
  it('SDK: getAuthorityStatus of every A and holder', async () => {
    const want: Record<string, { a: [string, boolean, boolean]; h: string }> = {
      B1: { a: ['empty', true, false], h: 'regular' },
      B2d: { a: ['empty', true, true], h: 'regular' },
      B2c: { a: ['empty', true, true], h: 'regular' },
      B3a: { a: ['eip7851', false, false], h: 'eip7851' },
      B3b: { a: ['regular', false, false], h: 'regular' },
    };
    for (const b of paths) {
      const sa = await status(`${b.name}.A`, b.old.address);
      const sh = await status(`${b.name}.holder`, b.holder);
      const [kind, retired, hasSuccessor] = want[b.name]!.a;
      record({ kind: 'sdk-status', path: b.name, who: 'A', observed: { code: sa.accountCode.kind, retired: sa.retired, successor: sa.successor }, expected: { code: kind, retired, successor: hasSuccessor ? b.holder : null } });
      record({ kind: 'sdk-status', path: b.name, who: 'holder', observed: { code: sh.accountCode.kind, retired: sh.retired }, expected: { code: want[b.name]!.h, retired: false } });
      expect(sa.accountCode.kind).toBe(kind);
      expect(sa.retired).toBe(retired);
      expect(sa.successor).toBe(hasSuccessor ? b.holder : null);
      expect(sh.accountCode.kind).toBe(want[b.name]!.h);
      expect(sh.retired).toBe(false);
    }
  });

  it('SDK: the Profile H precheck accepts each holder ML-DSA-44 signature; it refuses the old key where A has code', async () => {
    for (const b of paths) {
      const holder = await precheck(`${b.name}.holder`, b.holder, (d) => mldsaSign(b.label, d));
      const old = await precheck(`${b.name}.old`, b.old.address, (d) => b.old.signingKey.sign(d).serialized);
      record({ kind: 'sdk-precheck', path: b.name, who: 'holder', observed: holder, expected: { accepted: true } });
      record({ kind: 'sdk-precheck', path: b.name, who: 'old key', observed: old, expected: { accepted: !inPlace(b) }, note: inPlace(b) ? 'A has code: ERC-1271 only' : 'A has no code: the signature is valid; A is retired (getAuthorityStatus, the registry)' });
      expect(holder.accepted).toBe(true);
      expect(old.accepted).toBe(!inPlace(b));
    }
  });

  // -------------------------------------------------------------------------- B6, on-chain
  it('B6: the old key transactions after each path', async () => {
    const iface: ethers.Interface = S.aclIface;
    const attacker = ethers.Wallet.createRandom().connect(provider) as unknown as ethers.Wallet;
    await provider.send('anvil_setBalance', [attacker.address, ethers.toQuantity(ethers.parseEther('10'))]);
    const t7 = BigInt(Math.floor(Date.now() / 1000) - 7200);
    for (const b of paths) {
      const mined = inPlace(b) ? 1 : 0;
      const cases: Array<[string, ethers.Wallet, string, number]> = [
        ['T1.allow', b.old, iface.encodeFunctionData('allow', [b.history[0], attacker.address]), mined],
        ['T2.allowForDecryption', b.old, iface.encodeFunctionData('allowForDecryption', [[b.history[1]]]), mined],
        ['T3.delegate', b.old, iface.encodeFunctionData('delegateForUserDecryption', [attacker.address, S.dapp, S.exp]), mined],
        ['T4.designateSuccessor', b.old, iface.encodeFunctionData('designateSuccessor', [attacker.address]), mined],
        ['T5.confirmSuccessor', b.old, iface.encodeFunctionData('confirmSuccessor', []), 0],
      ];
      for (const [action, from, data, want] of cases) {
        const r = await sendTx(from, S.acl, data, `${b.name} ${action}`);
        record({ kind: 'tx', path: b.name, action, expected: want === 1 ? 'mined' : 'reverted', observed: r.status === 1 ? 'mined' : 'reverted', revert: r.revert, gasUsed: r.gasUsed });
        expect(r.status, `${b.name} ${action} ${r.revert}`).toBe(want);
      }
      const cert = { account: b.old.address, successor: attacker.address, chainIds: [31337n] };
      const sig = await b.old.signTypedData({ name: 'DecryptionAuthorityLifecycle', version: '1' },
        { RetireAccount: [{ name: 'account', type: 'address' }, { name: 'successor', type: 'address' }, { name: 'chainIds', type: 'uint256[]' }] }, cert);
      const r6 = await sendTx(attacker, S.acl, iface.encodeFunctionData('retireAccountWithSig', [cert.account, cert.successor, cert.chainIds, sig]), `${b.name} T6.certificate`);
      record({ kind: 'tx', path: b.name, action: 'T6.certificate', expected: 'reverted', observed: r6.status === 1 ? 'mined' : 'reverted', revert: r6.revert, gasUsed: r6.gasUsed });
      expect(r6.status).toBe(0);
      const r7 = await sendTx(b.old, S.acl, iface.encodeFunctionData('invalidateDecryptionSignaturesBefore', [t7]), `${b.name} T7.invalidateSignaturesBefore`);
      record({ kind: 'tx', path: b.name, action: 'T7.invalidateSignaturesBefore', expected: 'mined', observed: r7.status === 1 ? 'mined' : 'reverted', revert: r7.revert, gasUsed: r7.gasUsed });
      expect(r7.status).toBe(1);
      if (!inPlace(b)) {
        const r8 = await sendTx(b.old, S.acl, iface.encodeFunctionData('retireAccount', []), `${b.name} T8.retireAccount`);
        record({ kind: 'tx', path: b.name, action: 'T8.retireAccount', expected: 'reverted', observed: r8.status === 1 ? 'mined' : 'reverted', revert: r8.revert, gasUsed: r8.gasUsed });
        expect(r8.status).toBe(0);
      }
    }
    // In place, the holder undoes them through `execute`: the attacker's delegation and designation, and Dk's delegation.
    for (const b of [paths[3]!, paths[4]!]) {
      await execute(b.holder, b.label, S.acl, iface.encodeFunctionData('revokeDelegationForUserDecryption', [attacker.address, S.dapp]), `${b.name} holder revokes the attacker's delegation`);
      await execute(b.holder, b.label, S.acl, iface.encodeFunctionData('revokeDelegationForUserDecryption', [S.dk.address, S.dapp]), `${b.name} holder revokes Dk's delegation`);
      await execute(b.holder, b.label, S.acl, iface.encodeFunctionData('cancelSuccessorDesignation', []), `${b.name} holder cancels the attacker's designation`);
      const pending = await S.reg.pendingSuccessorOf(b.old.address);
      record({ kind: 'undo', path: b.name, delegatedToAttacker: await S.reg.isDelegatedForUserDecryption(b.old.address, attacker.address, S.dapp), pendingSuccessor: pending[0] });
      expect(await S.reg.isDelegatedForUserDecryption(b.old.address, attacker.address, S.dapp)).toBe(false);
      expect(pending[0]).toBe(ethers.ZeroAddress);
    }
    S.attacker = attacker;
  });

  // -------------------------------------------------------------------------- B5
  it('B5: operator-ratified upgrades: 8 signatures revert, 9 pass the guard to a Core release, a release without Core reverts at the guard; the canary stays green', async () => {
    const own = new ethers.Contract(S.owner, A.owner().abi, provider);
    const canaryCfg = (pinned: Array<{ address: string; codeHash: string }>) => {
      const p = path.join(OUT, 'PQL_canary.json');
      fs.writeFileSync(p, JSON.stringify({ rpc: RPC, acl: S.acl, canary: paths[0]!.old.address, handle: paths[0]!.history[0], app: S.dapp, delegate: S.dk.address, pinned }));
      return p;
    };
    const canary = (what: string, pinned: Array<{ address: string; codeHash: string }>) => {
      const r = runNode(path.join(ROOT, 'impl', 'canary', 'canary.mjs'), ['--config', canaryCfg(pinned)], {});
      record({ kind: 'canary', what, ok: r.status === 0, line: r.stdout.trim().split('\n').at(-1) });
      return r.status === 0;
    };
    const pin = async (impl: string) => ({ address: impl, codeHash: ethers.keccak256(await provider.getCode(impl)) });
    const pinned = [await pin(S.impl)];
    expect(canary('before any upgrade', pinned)).toBe(true);

    const impl2 = await deploy(S.funder, A.acl(), [], 'ACL v0.10.0 implementation, second deployment (a Core release)');
    const implBase = await deploy(S.funder, A.base(), [], 'ACL v0.7.0 implementation (a release without Core)');
    const ratify = async (impl: string, signers: number[], what: string, wantOk: boolean) => {
      expect((await sendTx(S.funder, S.owner, own.interface.encodeFunctionData('propose', [impl, '0x']), `propose ${what}`)).status).toBe(1);
      const id: string = await own.proposalId(impl, '0x');
      await provider.send('evm_increaseTime', [7 * DAY]);
      await provider.send('evm_mine', []);
      const sigs = signers.map((i) => mldsaSign(`${OPERATOR_LABEL}${i}`, id));
      const r = await sendTx(S.relayer, S.owner, own.interface.encodeFunctionData('execute', [impl, '0x', signers, sigs]), `execute ${what} with ${signers.length} signatures`, { gasLimit: TX_CAP });
      const implNow = ethers.getAddress(ethers.dataSlice(await provider.getStorage(S.acl, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'), 12));
      record({ kind: 'b5', what, signatures: signers.length, expected: wantOk ? 'mined' : 'reverted', observed: r.status === 1 ? 'mined' : 'reverted', revert: r.revert, gasUsed: r.gasUsed, implementationAfter: implNow });
      expect(r.status, `${what}: ${r.revert}`).toBe(wantOk ? 1 : 0);
      return r;
    };
    const eight = [0, 1, 2, 3, 4, 5, 6, 7];
    const nine = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    await ratify(impl2, eight, 'the Core release, 8 signatures', false);
    // The same proposal stays pending: executing it again with 9 signatures needs no new proposal.
    const id2: string = await own.proposalId(impl2, '0x');
    const sigs9 = nine.map((i) => mldsaSign(`${OPERATOR_LABEL}${i}`, id2));
    const r9 = await sendTx(S.relayer, S.owner, own.interface.encodeFunctionData('execute', [impl2, '0x', nine, sigs9]), 'execute the Core release with 9 signatures', { gasLimit: TX_CAP });
    record({ kind: 'b5', what: 'the Core release, 9 signatures', signatures: 9, expected: 'mined', observed: r9.status === 1 ? 'mined' : 'reverted', revert: r9.revert, gasUsed: r9.gasUsed });
    expect(r9.status, r9.revert).toBe(1);
    pinned.push(await pin(impl2));
    expect(canary('after the Core release', pinned)).toBe(true);
    await ratify(implBase, nine, 'the release without Core, 9 signatures', false);
    expect(canary('after the refused release', pinned)).toBe(true);
    // The old keys are still refused after the upgrade, and the retired accounts stay retired.
    const r = await sendTx(paths[0]!.old, S.acl, S.aclIface.encodeFunctionData('allow', [paths[0]!.history[2], S.attacker.address]), 'B1 T1.allow after the upgrade');
    record({ kind: 'tx', path: 'B1', action: 'T1.allow.after-upgrade', expected: 'reverted', observed: r.status === 1 ? 'mined' : 'reverted', revert: r.revert, gasUsed: r.gasUsed });
    expect(r.status).toBe(0);
    for (const b of paths.slice(0, 3)) expect(await S.reg.isAccountRetired(b.old.address)).toBe(true);
  });

  // -------------------------------------------------------------------------- B8: the per-request ERC-1271 cost
  it('B8: the ERC-1271 call each holder needs: its gas (E4 meter) and its time on this node', async () => {
    // The wallet answers the reject value when the verifier fails or runs out of gas, so eth_estimateGas on
    // isValidSignature finds the gas to answer, not to accept. E4's meter measures the call that accepts.
    const meterArt = artifact(METER_ART);
    const meterAddr = await deploy(S.funder, meterArt, [], 'Erc1271GasMeter (E4, test only)');
    const meter = new ethers.Contract(meterAddr, meterArt.abi, provider);
    for (const b of paths) {
      const digest = ethers.keccak256(ethers.toUtf8Bytes(`pql-b8-${b.name}`));
      const sig = mldsaSign(b.label, digest);
      const [okFull, magicFull, gasFull] = await meter.measure(b.holder, digest, sig, 0);
      const [okCap, magicCap, gasCap] = await meter.measure(b.holder, digest, sig, 250_000);
      const data = new ethers.Interface(['function isValidSignature(bytes32,bytes) view returns (bytes4)']).encodeFunctionData('isValidSignature', [digest, sig]);
      const times: number[] = [];
      let ret = '';
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        ret = await provider.call({ to: b.holder, data, gasLimit: 2_183_048n });
        times.push(performance.now() - t0);
      }
      times.sort((x, y) => x - y);
      record({
        kind: 'b8-erc1271', path: b.name, meterGasUsed: gasFull.toString(), meterOk: okFull, meterMagic: magicFull,
        cap250k: { ok: okCap, magic: magicCap, gasUsed: gasCap.toString() }, returned: ret.slice(0, 10),
        msMedian: times[2]!.toFixed(2), msMin: times[0]!.toFixed(2), calldataBytes: (data.length - 2) / 2,
      });
      expect(magicFull).toBe('0x1626ba7e');
      expect(magicCap).toBe('0xffffffff');
      expect(ret.slice(0, 10)).toBe('0x1626ba7e');
    }
  });

  // -------------------------------------------------------------------------- last: the old key retires a B3 account
  it('B3 does not combine with Core retirement: the old key retires A, which ends its wallet too', async () => {
    for (const b of [paths[3]!, paths[4]!]) {
      const r = await sendTx(b.old, S.acl, S.aclIface.encodeFunctionData('retireAccount', []), `${b.name} T8.retireAccount`);
      record({ kind: 'tx', path: b.name, action: 'T8.retireAccount', expected: 'mined', observed: r.status === 1 ? 'mined' : 'reverted', revert: r.revert, gasUsed: r.gasUsed });
      expect(r.status).toBe(1);
      const s = await status(`${b.name}.A.after-t8`, b.old.address);
      record({ kind: 'sdk-status', path: b.name, who: 'A after T8', observed: { code: s.accountCode.kind, retired: s.retired }, expected: { retired: true } });
      expect(s.retired).toBe(true);
      // The wallet's own requests now name a retired account: its execute still runs, but the registry refuses it.
      const exec = await (async () => {
        try {
          await execute(b.holder, b.label, S.acl, S.aclIface.encodeFunctionData('delegateForUserDecryption', [ethers.Wallet.createRandom().address, S.dapp, S.exp]), `${b.name} wallet acts after A's retirement`);
          return 'mined';
        } catch (e) {
          return `reverted (${String((e as Error).message).slice(0, 80)})`;
        }
      })();
      record({ kind: 'tx', path: b.name, action: 'P4.wallet-after-retirement', expected: 'reverted', observed: exec });
      expect(exec.startsWith('reverted')).toBe(true);
    }
  });
});
