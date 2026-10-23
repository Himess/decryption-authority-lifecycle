// =============================================================================
// Phase 5, P0.3: getAuthorityStatus for an account that adopted regular code (EIP-8298, simulated; proof class Mock).
//
// The SDK of branch lifecycle/phase4-sdk-status (main's SDK with Level 2, Level 1's getCode and the account-code
// report) reads the lifecycle ACL of Zama's cleartext mock: ACL v0.4.2 with Core and E1, deployed by Zama's own
// script from the Level 2 mock worktree. Every status call goes through the SDK's public entry points, for both
// adapters: createFhevmBaseClient of @fhevm/sdk/ethers or @fhevm/sdk/viem, then getAuthorityStatus.
//
// EIP-8298 (Draft, SETCODEFROM) lets an EOA adopt the regular code of a deployed contract. No client implements it.
// Simulation, as in the connector runs: X, a fresh local key, gets the runtime code of a deployed MLDSA44Account1271
// (E4's ML-DSA-44 ERC-1271 wallet; immutables only, so the code is the whole wallet) with anvil_setCode. X then
// retires through anvil_impersonateAccount, standing in for a call through its code (this wallet has no execute).
// The JSON-RPC proxy (impl/harness/phase4/fault_proxy.py) runs with an empty rewrite table and only records the wire.
//
// Accounts (fresh random keys, never printed): E a plain EOA; X first a plain EOA, then holding the wallet code.
//
// Env (set by run_p503_sdk.sh): RPC_URL (anvil, 127.0.0.1:8731), PROXY_PORT (8732), P503_OUT, HARNESS_MOCK_CLONE
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFhevmBaseClient as createEthersBaseClient,
  setFhevmRuntimeConfig as setEthersRuntimeConfig,
} from '@fhevm/sdk/ethers';
import {
  createFhevmBaseClient as createViemBaseClient,
  setFhevmRuntimeConfig as setViemRuntimeConfig,
} from '@fhevm/sdk/viem';
import { defineFhevmChain } from '@fhevm/sdk/chains';
import { getAuthorityStatus, type AuthorityStatus } from '@fhevm/sdk/actions/host';
// E4's ML-DSA-44 stack (experiments/, with its own ethers copy).
import { ethers as xethers } from '../../../../experiments/node_modules/ethers/lib.esm/index.js';
import { makeProvider, makeAccounts } from '../../../../experiments/lib/chain.mjs';
import { Recorder } from '../../../../experiments/lib/log.mjs';
import { deployPqStack } from '../../../../experiments/E4/pqlib.mjs';

const LABEL = 'proven in mock: the SDK status read on a local chain; EIP-8298 simulated by anvil_setCode (adopted regular code)';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');
const MOCK = path.resolve(process.env.HARNESS_MOCK_CLONE ?? path.join(ROOT, 'impl', 'wt-l2-mock'));
const OUT = path.resolve(process.env.P503_OUT ?? path.join(here, '.build'));
const RPC_URL = process.env.RPC_URL ?? '';
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8732);
const PROXY = path.join(ROOT, 'impl', 'harness', 'phase4', 'fault_proxy.py');
const REWRITE_FILE = path.join(OUT, 'P503_sdk_rewrite.json');
const PROXY_LOG = path.join(OUT, 'P503_sdk_host_rpc.jsonl');
const RESULT_JSON = path.join(OUT, 'P503_sdk_result.json');
const CHAIN_ID = 31_337;
const seedHex = xethers.keccak256(xethers.toUtf8Bytes('fhe-authority-lifecycle/E4/local-test-seed/v1')).slice(2);

const ACL_ABI = [
  'function getVersion() view returns (string)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function isAccountRetired(address) view returns (bool)',
  'function successorOf(address) view returns (address)',
  'function pendingSuccessorOf(address) view returns (address,uint64,bool)',
  'function retireAccount()',
];
const aclIface = new ethers.Interface(ACL_ABI);
const VIEW_NAMES: Record<string, string> = Object.fromEntries(
  ['getVersion', 'supportsInterface', 'isAccountRetired', 'successorOf', 'pendingSuccessorOf'].map((n) => [
    aclIface.getFunction(n)!.selector,
    n,
  ]),
);

// Addresses come from the mock worktree's own files (as in the Level 2 mock harness and P1.6).
function readHostAddresses(): Record<string, string> {
  const f = path.join(MOCK, 'sdk/js-sdk/contracts/src/v0.13.0/host-contracts/addresses/FHEVMHostAddresses.sol');
  const out: Record<string, string> = {};
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/address constant (\w+) = address\((0x[0-9a-fA-F]{40})\)/g)) {
    out[m[1]!] = ethers.getAddress(m[2]!);
  }
  return out;
}
function readDeployConstants() {
  const s = fs.readFileSync(path.join(MOCK, 'sdk/js-sdk/contracts/scripts/fhevm-deploy.sh'), 'utf8');
  const g = (re: RegExp) => {
    const m = s.match(re);
    if (!m) throw new Error(`cannot parse ${re} from fhevm-deploy.sh`);
    return m[1]!;
  };
  return {
    gatewayChainId: Number(g(/^chain_id_gateway=(\d+)/m)),
    decryption: ethers.getAddress(g(/^decryption_address=(0x[0-9a-fA-F]{40})/m)),
    inputVerification: ethers.getAddress(g(/^input_verification_address=(0x[0-9a-fA-F]{40})/m)),
  };
}

let proxy: ChildProcess;
let proxyErr = '';
const proxyUrl = (label: string) => `http://127.0.0.1:${PROXY_PORT}/${label}`;

type Adapter = 'ethers' | 'viem';
type Expected = Omit<AuthorityStatus, 'chainId' | 'aclAddress' | 'account'>;
const rows: Array<{ label: string; adapter: Adapter; account: string; nodeCodeLength: number; status: unknown }> = [];
const plain = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
const result: Record<string, any> = { label: LABEL, startedAt: new Date().toISOString() };

describe('P0.3: getAuthorityStatus reports an account holding adopted regular code (EIP-8298, simulated)', () => {
  let provider: ethers.JsonRpcProvider;
  let chain: ReturnType<typeof defineFhevmChain>;
  let acl: ethers.Contract;
  let aclAddress: string;
  let wallet: string;
  const W: Record<string, ethers.HDNodeWallet> = {};

  /** One status read through the SDK, with the given adapter, through the proxy under its own label. */
  const statusVia = async (adapter: Adapter, label: string, address: string): Promise<AuthorityStatus> => {
    const url = proxyUrl(`p503.${adapter}.${label}`);
    if (adapter === 'ethers') {
      const p = new ethers.JsonRpcProvider(url, ethers.Network.from(CHAIN_ID), {
        staticNetwork: true,
        cacheTimeout: -1,
        batchMaxCount: 1,
      });
      try {
        return await getAuthorityStatus(createEthersBaseClient({ provider: p, chain }) as never, { address });
      } finally {
        p.destroy();
      }
    }
    const publicClient = createPublicClient({
      chain: {
        id: CHAIN_ID,
        name: 'anvil (local)',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [url] } },
      },
      transport: http(url, { batch: false }),
      cacheTime: 0,
    });
    return await getAuthorityStatus(createViemBaseClient({ publicClient, chain }) as never, { address });
  };

  /** One row: the same account through both adapters; the node's own code length is recorded alongside. */
  const row = async (label: string, address: string, expected: Expected) => {
    const nodeCodeLength = (ethers.dataLength(await provider.getCode(address)));
    for (const adapter of ['ethers', 'viem'] as const) {
      const s = await statusVia(adapter, label, address);
      rows.push({ label: `p503.${adapter}.${label}`, adapter, account: label.split('.')[0]!, nodeCodeLength, status: plain(s) });
      expect(s).toEqual({ chainId: CHAIN_ID, aclAddress, account: ethers.getAddress(address), ...expected });
    }
  };
  const active = { lifecycle: true, retired: false, successor: null, pendingSuccessor: null } as const;

  beforeAll(async () => {
    expect(RPC_URL, 'RPC_URL must be set').not.toBe('');
    expect(new URL(RPC_URL).hostname).toBe('127.0.0.1');
    expect(new URL(RPC_URL).port, 'port 8545 is reserved on this machine').not.toBe('8545');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(PROXY_LOG, '');
    fs.writeFileSync(REWRITE_FILE, '{}'); // nothing is rewritten in P0.3
    proxy = spawn('python', ['-I', PROXY, String(PROXY_PORT), RPC_URL, PROXY_LOG, '--rewrite-file', REWRITE_FILE], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    proxy.stderr!.on('data', (d) => (proxyErr = (proxyErr + d.toString()).slice(-4000)));
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(proxyUrl('ready'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        });
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    fs.writeFileSync(PROXY_LOG, ''); // drop the readiness probe

    const addrs = readHostAddresses();
    const dc = readDeployConstants();
    aclAddress = addrs.aclAdd!;
    chain = defineFhevmChain({
      id: CHAIN_ID,
      fhevm: {
        contracts: {
          acl: { address: addrs.aclAdd as `0x${string}` },
          inputVerifier: { address: addrs.inputVerifierAdd as `0x${string}` },
          kmsVerifier: { address: addrs.kmsVerifierAdd as `0x${string}` },
        },
        relayerUrl: 'http://127.0.0.1:9', // never contacted: host reads only
        gateway: {
          id: dc.gatewayChainId,
          contracts: {
            decryption: { address: dc.decryption as `0x${string}` },
            inputVerification: { address: dc.inputVerification as `0x${string}` },
          },
        },
      },
    });
    setEthersRuntimeConfig({});
    setViemRuntimeConfig({});

    provider = new ethers.JsonRpcProvider(RPC_URL, ethers.Network.from(CHAIN_ID), {
      staticNetwork: true,
      cacheTimeout: -1,
      batchMaxCount: 1,
    });
    acl = new ethers.Contract(aclAddress, ACL_ABI, provider);
    for (const role of ['E', 'X']) {
      W[role] = ethers.Wallet.createRandom().connect(provider);
      await provider.send('anvil_setBalance', [W[role]!.address, ethers.toQuantity(ethers.parseEther('100'))]);
    }
    // E4's stack, deployed by an anvil dev account (public test key) through the experiments' own helpers.
    const xprovider = makeProvider('local', RPC_URL);
    const { FUNDER } = makeAccounts('local', xprovider);
    const rec = Object.create(Recorder.prototype);
    Object.assign(rec, { experiment: 'P503', mode: 'local', dir: OUT, file: path.join(OUT, 'P503_sdk_deploy_records.jsonl'), records: [] });
    fs.writeFileSync(rec.file, '');
    const pq = await deployPqStack(rec, 'P503.sdk', FUNDER, { seedHex });
    wallet = ethers.getAddress(pq.account);
    result.env = {
      clientVersion: await provider.send('web3_clientVersion', []),
      hardFork: (await provider.send('anvil_nodeInfo', []))?.hardFork,
      aclVersion: await acl.getVersion!(),
      acl: aclAddress,
      wallet,
      accounts: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, w.address])),
    };
  });

  afterAll(() => {
    proxy?.kill();
    // The wire per label: eth_getCode (the node's answer; nothing is rewritten) and the ACL views read.
    const wire: Record<string, Record<string, number>> = {};
    let rewritten = 0;
    for (const line of fs.readFileSync(PROXY_LOG, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      if (r.rewrite === true) rewritten++;
      const label = String(r.path ?? '').replace(/^\//, '');
      const w = (wire[label] ??= {});
      const method = r.req?.method;
      const key =
        method === 'eth_getCode'
          ? `eth_getCode (${ethers.dataLength(String(r.resp?.result ?? '0x'))} B)`
          : method === 'eth_call'
            ? `eth_call ${VIEW_NAMES[String(r.req.params?.[0]?.data ?? r.req.params?.[0]?.input ?? '').slice(0, 10)] ?? 'other'}`
            : method;
      w[key] = (w[key] ?? 0) + 1;
    }
    result.rows = rows;
    result.wire = wire;
    result.proxyRewritten = rewritten;
    result.proxyStderrTail = proxyErr.slice(-500);
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(RESULT_JSON, JSON.stringify(plain(result), null, 2));
  });

  it('setup: the mock runs ACL v0.4.2 with Core and E1', () => {
    expect(result.env.aclVersion).toBe('ACL v0.4.2');
  });

  it('before: E and X are plain EOAs, active; the wallet itself reads as regular code', async () => {
    await row('E.eoa', W.E!.address, { accountCode: { kind: 'empty' }, ...active });
    await row('X.eoa', W.X!.address, { accountCode: { kind: 'empty' }, ...active });
    await row('wallet.contract', wallet, { accountCode: { kind: 'regular' }, ...active });
  });

  it('X adopts the ML-DSA-44 wallet runtime (anvil_setCode): regular, active', async () => {
    const code = await provider.getCode(wallet);
    expect(code.toLowerCase().startsWith('0xef01')).toBe(false);
    await provider.send('anvil_setCode', [W.X!.address, code]);
    expect((await provider.getCode(W.X!.address)).toLowerCase()).toBe(code.toLowerCase());
    result.adopted = { source: wallet, codeLength: ethers.dataLength(code), codeHash: ethers.keccak256(code) };
    await row('X.8298', W.X!.address, { accountCode: { kind: 'regular' }, ...active });
  });

  it('X retires (impersonated, standing in for a call through its code): regular, retired', async () => {
    const x = W.X!.address;
    await provider.send('anvil_impersonateAccount', [x]);
    const hash = await provider.send('eth_sendTransaction', [
      { from: x, to: aclAddress, data: aclIface.encodeFunctionData('retireAccount', []) },
    ]);
    // Poll the receipt (bounded): anvil mines just after answering, and nothing else is mined afterwards, so a wait
    // that misses the receipt on its first look and then waits for the next block would never return.
    let rc: { status: string } | null = null;
    for (let i = 0; i < 100 && rc == null; i++) {
      rc = await provider.send('eth_getTransactionReceipt', [hash]);
      if (rc == null) await new Promise((r) => setTimeout(r, 100));
    }
    await provider.send('anvil_stopImpersonatingAccount', [x]);
    expect(rc?.status).toBe('0x1');
    result.retirement = { gasUsed: BigInt((rc as unknown as { gasUsed: string }).gasUsed).toString() };
    expect(await acl.isAccountRetired!(x)).toBe(true);
    await row('X.8298-retired', x, {
      accountCode: { kind: 'regular' },
      lifecycle: true,
      retired: true,
      successor: null,
      pendingSuccessor: null,
    });
    await row('E.eoa-after', W.E!.address, { accountCode: { kind: 'empty' }, ...active });
  });

  it('the proxy rewrote nothing', () => {
    const lines = fs.readFileSync(PROXY_LOG, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => JSON.parse(l).rewrite === true)).toHaveLength(0);
  });
});
