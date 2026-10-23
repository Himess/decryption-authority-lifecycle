// =============================================================================
// Phase 4, P1.6: getAuthorityStatus on a local chain (proof class: Mock).
//
// The SDK of branch lifecycle/phase4-sdk-status (main's SDK with Level 2, Level 1's getCode and the account-code
// report) reads the lifecycle ACL of Zama's cleartext mock: ACL v0.4.2 with Core and E1, deployed by Zama's own
// script from the Level 2 mock worktree. Every status call goes through the SDK's public entry points, for both
// adapters: createFhevmBaseClient of @fhevm/sdk/ethers or @fhevm/sdk/viem, then getAuthorityStatus.
//
// EIP-7851 is simulated as in P0.4: the JSON-RPC proxy impl/harness/phase4/fault_proxy.py (--rewrite-file) answers
// eth_getCode for chosen accounts with 0xef0101 ‖ delegate, while anvil keeps their real EIP-7702 delegation
// (0xef0100 ‖ delegate, set by a type-4 transaction).
//
// Accounts (fresh random keys, never printed):
//   E  a plain EOA;
//   D  a one-byte contract (STOP): the delegate, and itself an account with regular code;
//   X  delegates to D; designates S, S accepts, the delay passes, X confirms and retires; then disables ECDSA
//      (simulated): a migration out of an EIP-7702 account, finished by disabling its key;
//   W  delegates to D; designates S2, S2 accepts (not confirmed); then disables ECDSA (simulated); stays active.
// Every row reads the same account through both adapters, each through the proxy with its own label (URL path).
//
// Env (set by run_p16_sdk.sh): RPC_URL (anvil, 127.0.0.1:8631), PROXY_PORT (8632), P16_OUT, HARNESS_MOCK_CLONE
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

const LABEL = 'proven in mock: the SDK status read on a local chain; EIP-7851 simulated by eth_getCode rewriting';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');
const MOCK = path.resolve(process.env.HARNESS_MOCK_CLONE ?? path.join(ROOT, 'impl', 'wt-l2-mock'));
const OUT = path.resolve(process.env.P16_OUT ?? path.join(here, '.build'));
const RPC_URL = process.env.RPC_URL ?? '';
const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8632);
const PROXY = path.join(ROOT, 'impl', 'harness', 'phase4', 'fault_proxy.py');
const REWRITE_FILE = path.join(OUT, 'P16_rewrite.json');
const PROXY_LOG = path.join(OUT, 'P16_host_rpc.jsonl');
const RESULT_JSON = path.join(OUT, 'P16_result.json');
const CHAIN_ID = 31_337;
/** Init code that deploys the one-byte runtime 0x00 (STOP). */
const ONE_BYTE_CONTRACT_INITCODE = '0x6001600c60003960016000f300';
const DEAD = '0x000000000000000000000000000000000000dEaD';

const ACL_ABI = [
  'function getVersion() view returns (string)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function isAccountRetired(address) view returns (bool)',
  'function successorOf(address) view returns (address)',
  'function pendingSuccessorOf(address) view returns (address,uint64,bool)',
  'function successorDelayOf(address) view returns (uint64)',
  'function retireAccount()',
  'function designateSuccessor(address)',
  'function acceptSuccession(address)',
  'function confirmSuccessor()',
];
const aclIface = new ethers.Interface(ACL_ABI);
const VIEW_NAMES: Record<string, string> = Object.fromEntries(
  ['getVersion', 'supportsInterface', 'isAccountRetired', 'successorOf', 'pendingSuccessorOf'].map((n) => [
    aclIface.getFunction(n)!.selector,
    n,
  ]),
);

// ---------------------------------------------------------------------------
// Addresses come from the mock worktree's own files (as in the Level 2 mock harness).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// The proxy: 0xef0101 ‖ delegate for the accounts in the table, the node's own answer otherwise.
// ---------------------------------------------------------------------------
let proxy: ChildProcess;
let proxyErr = '';
function setRewrite(on: Array<[string, string]>) {
  const table: Record<string, string> = {};
  for (const [account, delegate] of on) table[account.toLowerCase()] = ('0xef0101' + delegate.slice(2)).toLowerCase();
  fs.writeFileSync(REWRITE_FILE, JSON.stringify(table));
}
const proxyUrl = (label: string) => `http://127.0.0.1:${PROXY_PORT}/${label}`;

type Adapter = 'ethers' | 'viem';
type Expected = Omit<AuthorityStatus, 'chainId' | 'aclAddress' | 'account'>;
const rows: Array<{
  label: string;
  adapter: Adapter;
  account: string;
  simulated: string;
  nodeCode: string;
  status: unknown;
}> = [];
const plain = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
const result: Record<string, any> = { label: LABEL, startedAt: new Date().toISOString() };

describe('P1.6: getAuthorityStatus reports EIP-7851 accounts and E1 successor state (local chain)', () => {
  let provider: ethers.JsonRpcProvider;
  let chain: ReturnType<typeof defineFhevmChain>;
  let acl: ethers.Contract;
  let aclAddress: string;
  const W: Record<string, ethers.HDNodeWallet> = {};
  let D: string;

  const send = async (w: ethers.Signer, fn: string, args: unknown[]) => {
    const tx = await (acl.connect(w) as ethers.Contract)[fn]!(...args);
    const rc = await tx.wait();
    expect(rc?.status, `${fn} must succeed`).toBe(1);
    return rc as ethers.TransactionReceipt;
  };

  /** EIP-7702 delegation by a real type-4 transaction, self-sponsored, to a dead address with no data. */
  const delegate = async (w: ethers.HDNodeWallet, target: string) => {
    const nonce = await provider.getTransactionCount(w.address, 'pending');
    const auth = await w.authorize({ address: target, nonce: nonce + 1, chainId: BigInt(CHAIN_ID) });
    const tx = await w.sendTransaction({
      type: 4,
      to: DEAD,
      data: '0x',
      authorizationList: [auth],
      nonce,
      gasLimit: 100_000n,
    });
    expect((await tx.wait())?.status).toBe(1);
    expect((await provider.getCode(w.address)).toLowerCase()).toBe(('0xef0100' + target.slice(2)).toLowerCase());
  };

  /** One status read through the SDK, with the given adapter, through the proxy under its own label. */
  const statusVia = async (adapter: Adapter, label: string, address: string): Promise<AuthorityStatus> => {
    const url = proxyUrl(`p16.${adapter}.${label}`);
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

  /** One row: the same account through both adapters; the node's own code (no proxy) is recorded alongside. */
  const row = async (label: string, address: string, simulated: string, expected: Expected) => {
    const nodeCode = await provider.getCode(address);
    for (const adapter of ['ethers', 'viem'] as const) {
      const s = await statusVia(adapter, label, address);
      rows.push({ label: `p16.${adapter}.${label}`, adapter, account: label.split('.')[0]!, simulated, nodeCode, status: plain(s) });
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
    setRewrite([]);
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
    for (const role of ['E', 'X', 'S', 'W', 'S2', 'DEPLOYER']) {
      W[role] = ethers.Wallet.createRandom().connect(provider);
      await provider.send('anvil_setBalance', [W[role]!.address, ethers.toQuantity(ethers.parseEther('100'))]);
    }
    const rc = await (await W.DEPLOYER!.sendTransaction({ data: ONE_BYTE_CONTRACT_INITCODE })).wait();
    D = ethers.getAddress(rc!.contractAddress!);
    expect(await provider.getCode(D)).toBe('0x00');
    result.env = {
      clientVersion: await provider.send('web3_clientVersion', []),
      hardFork: (await provider.send('anvil_nodeInfo', []))?.hardFork,
      aclVersion: await acl.getVersion!(),
      acl: aclAddress,
      delegate: D,
      accounts: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, w.address])),
    };
  });

  afterAll(() => {
    proxy?.kill();
    // The wire per label: eth_getCode (rewritten or the node's answer) and the ACL views read.
    const wire: Record<string, Record<string, number>> = {};
    for (const line of fs.readFileSync(PROXY_LOG, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const label = String(r.path ?? '').replace(/^\//, '');
      const w = (wire[label] ??= {});
      const method = r.req?.method;
      const key =
        method === 'eth_getCode'
          ? `eth_getCode${r.rewrite ? ' (rewritten)' : ''}`
          : method === 'eth_call'
            ? `eth_call ${VIEW_NAMES[String(r.req.params?.[0]?.data ?? r.req.params?.[0]?.input ?? '').slice(0, 10)] ?? 'other'}`
            : method;
      w[key] = (w[key] ?? 0) + 1;
    }
    result.rows = rows;
    result.wire = wire;
    result.proxyStderrTail = proxyErr.slice(-500);
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(RESULT_JSON, JSON.stringify(plain(result), null, 2));
  });

  it('setup: the mock runs ACL v0.4.2 with Core and E1', () => {
    expect(result.env.aclVersion).toBe('ACL v0.4.2');
  });

  it('an EOA, a contract and an EIP-7702 account, all active', async () => {
    await row('E.eoa', W.E!.address, 'none', { accountCode: { kind: 'empty' }, ...active });
    await row('D.contract', D, 'none', { accountCode: { kind: 'regular' }, ...active });
    await delegate(W.X!, D);
    await row('X.7702', W.X!.address, 'none', { accountCode: { kind: 'eip7702', delegate: D }, ...active });
  });

  it('X migrates out (E1 successor, retirement), then disables ECDSA: EIP-7851 with the successor state', async () => {
    await send(W.X!, 'designateSuccessor', [W.S!.address]);
    await send(W.S!, 'acceptSuccession', [W.X!.address]);
    const delay = (await acl.successorDelayOf!(W.X!.address)) as bigint;
    await provider.send('evm_increaseTime', [Number(delay)]);
    await provider.send('evm_mine', []);
    await send(W.X!, 'confirmSuccessor', []);
    await send(W.X!, 'retireAccount', []);
    const retired = { lifecycle: true, retired: true, successor: W.S!.address, pendingSuccessor: null };
    await row('X.7702-retired', W.X!.address, 'none', { accountCode: { kind: 'eip7702', delegate: D }, ...retired });
    setRewrite([[W.X!.address, D]]);
    await row('X.7851-retired', W.X!.address, '0xef0101 ‖ D', { accountCode: { kind: 'eip7851', delegate: D }, ...retired });
    // The node still holds the EIP-7702 indicator: the rewrite is the proxy's alone.
    expect((await provider.getCode(W.X!.address)).toLowerCase()).toBe(('0xef0100' + D.slice(2)).toLowerCase());
    result.successorDelay = delay;
  });

  it('W, still active with a pending accepted designation, disables ECDSA: EIP-7851 with the pending successor', async () => {
    await delegate(W.W!, D);
    const rc = await send(W.W!, 'designateSuccessor', [W.S2!.address]);
    await send(W.S2!, 'acceptSuccession', [W.W!.address]);
    const at = BigInt((await provider.getBlock(rc.blockNumber))!.timestamp);
    const delay = (await acl.successorDelayOf!(W.W!.address)) as bigint;
    const pending = {
      lifecycle: true,
      retired: false,
      successor: null,
      pendingSuccessor: { address: W.S2!.address, confirmableAt: at + delay, accepted: true },
    };
    await row('W.7702-pending', W.W!.address, 'none', { accountCode: { kind: 'eip7702', delegate: D }, ...pending });
    setRewrite([
      [W.X!.address, D],
      [W.W!.address, D],
    ]);
    await row('W.7851-pending', W.W!.address, '0xef0101 ‖ D', { accountCode: { kind: 'eip7851', delegate: D }, ...pending });
    // The other accounts read as before.
    await row('E.eoa-after', W.E!.address, 'none', { accountCode: { kind: 'empty' }, ...active });
  });
});
