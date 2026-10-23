// =============================================================================
// Level 2 in Zama's own cleartext mock, end to end, on a local anvil:
//   - the E1 successor scenario through the SDK (designate, accept, wait D, confirm, retire; the successor reads the
//     retired account's handles, including one granted after retirement; every other delegate is refused; a pending
//     designation dies with the retirement);
//   - the SDK hygiene of Level 2 (d): the typed ACCOUNT_RETIRED refusal, getAuthorityStatus, one transport key per
//     request, and the purge of keys and permits on retirement.
//
//   Stack:   sdk/js-sdk/contracts v0.13.0 cleartext host stack, deployed by Zama's own script, with CleartextACL
//            re-pointed at the ACL v0.4.2 backport (Core + E1), branch lifecycle/level2-mock.
//   Signers: Zama's default 4-signer KMS set (non-forge), so the cleartext relayer takes the on-chain
//            CleartextKMSVerifier.userDecrypt / delegatedUserDecrypt path.
//   SDK:     the worktree's SDK source: Zama's SDK plus the Level 2 hygiene change.
//
// LABEL: proven in mock: the delegated view and the SDK flow; plaintext is public in the mock.
//
// Accounts are fresh random wallets created in memory for this run; only addresses are recorded. Nothing is sent
// anywhere but RPC_URL (127.0.0.1, never port 8545).
//
// Env (set by run_mock_e2e_l2.sh): RPC_URL, HARNESS_FHEVM_CLONE, HARNESS_RESULT_JSON
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFhevmCleartextDecryptClient, createFhevmCleartextEncryptClient } from '@fhevm/sdk/ethers/cleartext';
import { setFhevmRuntimeConfig } from '@fhevm/sdk/ethers';
import { defineFhevmChain } from '@fhevm/sdk/chains';
import { asEncryptedValue } from '@fhevm/sdk/types';
import { getAuthorityStatus } from '@fhevm/sdk/actions/host';
import { createTransportKeyRing, isTransportKeyPairDisposed, purgeIfRetired } from '@fhevm/sdk/actions/decrypt';
// The SDK does not export its error classes; the test checks them with instanceof (same module instances).
import { AclAccountRetiredError, AclUserDecryptionError } from '@sdk-src/core/errors/AclError.ts';

const LABEL = 'proven in mock: the delegated view and the SDK flow; plaintext is public in the mock';

const here = dirname(fileURLToPath(import.meta.url));
const CLONE = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'wt-l2-mock'));
const RPC_URL = process.env.RPC_URL ?? '';
const RESULT_JSON = process.env.HARNESS_RESULT_JSON ?? join(here, '.build', 'last-result.json');

const CORE_INTERFACE_ID = '0x556d2088';
const SUCCESSION_INTERFACE_ID = '0x7dc5e209';
const FHE_TYPE = { uint32: 4, uint64: 5 } as const; // library-solidity/lib/FheType.sol
const DAY = 24n * 3600n;

// ---------------------------------------------------------------------------
// Addresses come from the worktree's own files (as in the Level 0 harness).
// ---------------------------------------------------------------------------
function readHostAddresses(): Record<string, string> {
  const f = join(CLONE, 'sdk/js-sdk/contracts/src/v0.13.0/host-contracts/addresses/FHEVMHostAddresses.sol');
  const out: Record<string, string> = {};
  for (const m of readFileSync(f, 'utf8').matchAll(/address constant (\w+) = address\((0x[0-9a-fA-F]{40})\)/g)) {
    out[m[1]!] = ethers.getAddress(m[2]!);
  }
  return out;
}
function readDeployConstants() {
  const s = readFileSync(join(CLONE, 'sdk/js-sdk/contracts/scripts/fhevm-deploy.sh'), 'utf8');
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
function readFheTestAddress(): string {
  const j = JSON.parse(readFileSync(join(CLONE, 'sdk/js-sdk/test/chains/chain-defaults.json'), 'utf8'));
  return ethers.getAddress(j.localcleartext.fheTestAddress);
}

// Every eth_call the SDK makes, to tell a precheck refusal (no relayer call) from a relayer one.
class RecordingProvider extends ethers.JsonRpcProvider {
  calls: string[] = [];
  override async _send(payload: ethers.JsonRpcPayload | Array<ethers.JsonRpcPayload>) {
    for (const p of Array.isArray(payload) ? payload : [payload]) {
      if (p.method === 'eth_call') {
        const tx = (p.params as any[])[0] ?? {};
        this.calls.push(String(tx.data ?? tx.input ?? '0x').slice(0, 10));
      }
    }
    return super._send(payload);
  }
}

const ACL_ABI = [
  'error SenderRetired(address sender)',
  'error SuccessorNotYetConfirmable(address successor, uint64 confirmableAt)',
  'function getVersion() view returns (string)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function successorDelay() view returns (uint64)',
  'function successorOf(address) view returns (address)',
  'function isAccountRetired(address) view returns (bool)',
  'function isHandleDelegatedForUserDecryption(address,address,address,bytes32) view returns (bool)',
  'function persistAllowed(bytes32,address) view returns (bool)',
  'function delegateForUserDecryption(address,address,uint64)',
  'function allow(bytes32,address)',
  'function retireAccount()',
  'function designateSuccessor(address)',
  'function acceptSuccession(address)',
  'function confirmSuccessor()',
  'event AccountRetired(address indexed account, address indexed successor)',
];
const KMSV_ABI = [
  'function userDecrypt((bytes32 handle,address contractAddress)[],address,bytes,address[],uint256,uint256,bytes) view returns (bytes,address[],uint256,bytes)',
  'function delegatedUserDecrypt((bytes32 handle,address contractAddress)[],address,address,bytes,address[],uint256,uint256,bytes) view returns (bytes,address[],uint256,bytes)',
];
const FHETEST_ABI = [
  'function setEuint64(bytes32,bytes,uint64,bool) returns (bytes32)',
  'function setEuint32(bytes32,bytes,uint32,bool) returns (bytes32)',
  'function getHandleOf(address account, uint8 fheType) view returns (bytes32)',
];
const aclIface = new ethers.Interface(ACL_ABI);
const kmsvIface = new ethers.Interface(KMSV_ABI);
const RELAYER_SELECTORS = new Set([kmsvIface.getFunction('userDecrypt')!.selector, kmsvIface.getFunction('delegatedUserDecrypt')!.selector]);
const errText = (e: any) => String(e?.shortMessage ?? e?.message ?? e).split('\n')[0]!.slice(0, 300);

const result: Record<string, any> = { label: LABEL, startedAt: new Date().toISOString() };

describe('Level 2 in the Zama cleartext mock: E1 successor and SDK hygiene', () => {
  let provider: RecordingProvider;
  let fheTestAddress: string;
  let acl: ethers.Contract, fheTest: ethers.Contract;
  let encClient: any, decClient: any;
  const W: Record<string, ethers.HDNodeWallet> = {};
  const H: Record<string, any> = {};

  const latestTs = async () => BigInt((await provider.getBlock('latest'))!.timestamp);
  const sendTx = async (w: ethers.Signer, c: ethers.Contract, fn: string, args: unknown[]) => {
    const tx = await (c.connect(w) as ethers.Contract)[fn]!(...args);
    const rc = await tx.wait();
    expect(rc?.status, `${fn} must succeed`).toBe(1);
    return rc as ethers.TransactionReceipt;
  };
  const status = async (who: string) => {
    const s = await getAuthorityStatus(decClient, { address: who });
    return { lifecycle: s.lifecycle, retired: s.retired, successor: s.successor, pendingSuccessor: s.pendingSuccessor };
  };

  async function encryptAndSet(owner: ethers.HDNodeWallet, kind: keyof typeof FHE_TYPE, value: bigint) {
    const r = await encClient.encryptValues({ contractAddress: fheTestAddress, userAddress: owner.address, values: [{ type: kind, value }] });
    const fn = { uint64: 'setEuint64', uint32: 'setEuint32' }[kind];
    await sendTx(owner, fheTest, fn, [r.encryptedValues[0], r.inputProof, value, false]);
    return { handle: (await fheTest.getHandleOf!(owner.address, FHE_TYPE[kind])) as string, value };
  }

  async function signPermit(signer: ethers.HDNodeWallet, kp: any, delegator?: string) {
    return decClient.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [fheTestAddress],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: signer.address,
      signer,
      ...(delegator ? { delegatorAddress: delegator } : {}),
    });
  }

  // One user decryption through the SDK client (precheck, then the cleartext relayer).
  async function decrypt(requester: ethers.HDNodeWallet, handles: string[], o: { delegator?: string; kp?: any } = {}) {
    const kp = o.kp ?? (await decClient.generateTransportKeyPair());
    const permit = await signPermit(requester, kp, o.delegator);
    provider.calls = [];
    try {
      const vals = await decClient.decryptValues({
        encryptedValues: handles.map((h) => asEncryptedValue(h)),
        contractAddress: fheTestAddress,
        signedPermit: permit,
        transportKeyPair: kp,
      });
      return { ok: true, values: vals.map((v: any) => String(v.value)), relayerCalled: provider.calls.some((s) => RELAYER_SELECTORS.has(s)) };
    } catch (e: any) {
      return {
        ok: false,
        typedRetired: e instanceof AclAccountRetiredError,
        aclUserDecryptionError: e instanceof AclUserDecryptionError,
        code: e?.code,
        accounts: e?.accounts,
        error: errText(e),
        relayerCalled: provider.calls.some((s) => RELAYER_SELECTORS.has(s)),
      };
    }
  }
  const expectTypedRetired = (r: any, account: string) => {
    expect(r.ok).toBe(false);
    expect(r.typedRetired, r.error).toBe(true);
    expect(r.aclUserDecryptionError).toBe(true);
    expect(r.code).toBe('ACCOUNT_RETIRED');
    expect(r.accounts).toContain(account);
    expect(r.relayerCalled, 'the precheck refuses before the relayer').toBe(false);
  };
  const expectGenericRefusal = (r: any) => {
    expect(r.ok).toBe(false);
    expect(r.aclUserDecryptionError, r.error).toBe(true);
    expect(r.typedRetired).toBe(false);
    expect(r.relayerCalled).toBe(false);
  };

  beforeAll(async () => {
    expect(RPC_URL, 'RPC_URL must be set').not.toBe('');
    expect(['127.0.0.1', 'localhost']).toContain(new URL(RPC_URL).hostname);
    expect(new URL(RPC_URL).port, 'port 8545 is reserved on this machine').not.toBe('8545');

    const addrs = readHostAddresses();
    const dc = readDeployConstants();
    fheTestAddress = readFheTestAddress();
    const chain = defineFhevmChain({
      id: 31_337,
      fhevm: {
        contracts: {
          acl: { address: addrs.aclAdd as `0x${string}` },
          inputVerifier: { address: addrs.inputVerifierAdd as `0x${string}` },
          kmsVerifier: { address: addrs.kmsVerifierAdd as `0x${string}` },
          protocolConfig: { address: addrs.protocolConfigAdd as `0x${string}` },
        },
        relayerUrl: 'http://127.0.0.1:9', // the cleartext relayer module performs no HTTP
        gateway: {
          id: dc.gatewayChainId,
          contracts: {
            decryption: { address: dc.decryption as `0x${string}` },
            inputVerification: { address: dc.inputVerification as `0x${string}` },
          },
        },
      },
    });
    provider = new RecordingProvider(RPC_URL, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
    acl = new ethers.Contract(addrs.aclAdd!, ACL_ABI, provider);
    fheTest = new ethers.Contract(fheTestAddress, FHETEST_ABI, provider);

    for (const role of ['OLD', 'S', 'DOLD', 'X', 'NEW', 'OLD2', 'S2', 'U']) {
      W[role] = ethers.Wallet.createRandom().connect(provider);
      await provider.send('anvil_setBalance', [W[role]!.address, ethers.toQuantity(ethers.parseEther('100'))]);
    }
    result.accounts = Object.fromEntries(Object.entries(W).map(([k, w]) => [k, w.address]));

    setFhevmRuntimeConfig({ auth: { type: 'ApiKeyHeader', value: 'local-harness-not-a-key' } });
    encClient = createFhevmCleartextEncryptClient({ chain, provider });
    decClient = createFhevmCleartextDecryptClient({ chain, provider });
    await encClient.ready;
    await decClient.ready;
    result.env = {
      rpcUrl: RPC_URL,
      clientVersion: await provider.send('web3_clientVersion', []),
      hardFork: (await provider.send('anvil_nodeInfo', []))?.hardFork,
      worktree: CLONE,
      addresses: { acl: addrs.aclAdd, kmsVerifier: addrs.kmsVerifierAdd, fheTest: fheTestAddress },
    };
  });

  afterAll(() => {
    result.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULT_JSON), { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  });

  it('setup: the mock runs ACL v0.4.2 with the lifecycle Core and E1', async () => {
    result.setup = {
      aclVersion: await acl.getVersion!(),
      core: await acl.supportsInterface!(CORE_INTERFACE_ID),
      e1: await acl.supportsInterface!(SUCCESSION_INTERFACE_ID),
      successorDelay: String(await acl.successorDelay!()),
    };
    expect(result.setup).toEqual({ aclVersion: 'ACL v0.4.2', core: true, e1: true, successorDelay: String(7n * DAY) });
  });

  it('E1: designate, accept, wait D, confirm; the successor has no right while the account is active', async () => {
    H.OLD = [await encryptAndSet(W.OLD!, 'uint64', 5001n), await encryptAndSet(W.OLD!, 'uint32', 61n)];
    await sendTx(W.OLD!, acl, 'delegateForUserDecryption', [W.DOLD!.address, fheTestAddress, (await latestTs()) + 30n * DAY]);
    const before = await status(W.OLD!.address);

    await sendTx(W.OLD!, acl, 'designateSuccessor', [W.S!.address]);
    await sendTx(W.S!, acl, 'acceptSuccession', [W.OLD!.address]);
    const pending = await status(W.OLD!.address);
    const earlyConfirm = await acl.connect(W.OLD!).getFunction('confirmSuccessor').staticCall().then(() => 'ok', (e) => aclIface.parseError(e?.data ?? '0x')?.name ?? errText(e));

    await provider.send('evm_increaseTime', [Number(7n * DAY)]);
    await provider.send('evm_mine', []);
    await sendTx(W.OLD!, acl, 'confirmSuccessor', []);
    const confirmed = await status(W.OLD!.address);

    const successorWhileActive = await decrypt(W.S!, H.OLD.map((x: any) => x.handle), { delegator: W.OLD!.address });
    const delegateWhileActive = await decrypt(W.DOLD!, [H.OLD[0].handle], { delegator: W.OLD!.address });
    const ownerWhileActive = await decrypt(W.OLD!, [H.OLD[0].handle]);
    result.e1Before = { before, pending, earlyConfirm, confirmed, successorWhileActive, delegateWhileActive, ownerWhileActive };

    expect(before).toEqual({ lifecycle: true, retired: false, successor: null, pendingSuccessor: null });
    expect(pending.pendingSuccessor?.address).toBe(W.S!.address);
    expect(pending.pendingSuccessor?.accepted).toBe(true);
    expect(earlyConfirm).toBe('SuccessorNotYetConfirmable');
    expect(confirmed).toEqual({ lifecycle: true, retired: false, successor: W.S!.address, pendingSuccessor: null });
    expectGenericRefusal(successorWhileActive);
    expect(delegateWhileActive.ok).toBe(true);
    expect(ownerWhileActive).toMatchObject({ ok: true, values: ['5001'] });
  });

  it('E1: after retirement the successor reads, every other party gets the typed refusal', async () => {
    const rc = await sendTx(W.OLD!, acl, 'retireAccount', []);
    const ev = rc.logs.map((l) => { try { return aclIface.parseLog(l); } catch { return null; } }).find((p) => p?.name === 'AccountRetired');
    const after = await status(W.OLD!.address);

    const successor = await decrypt(W.S!, H.OLD.map((x: any) => x.handle), { delegator: W.OLD!.address });
    const otherDelegate = await decrypt(W.DOLD!, [H.OLD[0].handle], { delegator: W.OLD!.address });
    const owner = await decrypt(W.OLD!, [H.OLD[0].handle]);
    result.e1After = { retireGasUsed: rc.gasUsed, event: ev ? ev.args.map(String) : null, after, successor, otherDelegate, owner };

    expect(ev?.args.map(String)).toEqual([W.OLD!.address, W.S!.address]);
    expect(after).toEqual({ lifecycle: true, retired: true, successor: W.S!.address, pendingSuccessor: null });
    expect(successor).toMatchObject({ ok: true, values: ['5001', '61'], relayerCalled: true });
    expectTypedRetired(otherDelegate, W.OLD!.address);
    expectTypedRetired(owner, W.OLD!.address);
  });

  it('E1: a handle granted to the retired account afterwards (a straggler) is readable by the successor only', async () => {
    H.X = await encryptAndSet(W.X!, 'uint64', 777n);
    await sendTx(W.X!, acl, 'allow', [H.X.handle, W.OLD!.address]);
    const views = {
      persistAllowed_OLD: await acl.persistAllowed!(H.X.handle, W.OLD!.address),
      delegated_OLD_S: await acl.isHandleDelegatedForUserDecryption!(W.OLD!.address, W.S!.address, fheTestAddress, H.X.handle),
    };
    const successor = await decrypt(W.S!, [H.X.handle], { delegator: W.OLD!.address });
    const owner = await decrypt(W.OLD!, [H.X.handle]);
    result.e1Straggler = { views, successor, owner };

    expect(views).toEqual({ persistAllowed_OLD: false, delegated_OLD_S: true });
    expect(successor).toMatchObject({ ok: true, values: ['777'] });
    expectTypedRetired(owner, W.OLD!.address);
  });

  it('E1: a pending designation dies with the retirement', async () => {
    H.OLD2 = await encryptAndSet(W.OLD2!, 'uint64', 4242n);
    await sendTx(W.OLD2!, acl, 'designateSuccessor', [W.S2!.address]);
    await sendTx(W.S2!, acl, 'acceptSuccession', [W.OLD2!.address]);
    await sendTx(W.OLD2!, acl, 'retireAccount', []);
    const after = await status(W.OLD2!.address);
    const s2 = await decrypt(W.S2!, [H.OLD2.handle], { delegator: W.OLD2!.address });
    result.e1Pending = { after, s2 };

    expect(after).toEqual({ lifecycle: true, retired: true, successor: null, pendingSuccessor: null });
    expectTypedRetired(s2, W.OLD2!.address);
  });

  it('SDK hygiene: an ordinary refusal stays generic', async () => {
    const r = await decrypt(W.NEW!, [H.X.handle]);
    result.ordinaryRefusal = r;
    expectGenericRefusal(r);
  });

  it('SDK hygiene: one transport key per request, unusable once released, purged on retirement', async () => {
    const ring = createTransportKeyRing(() => decClient.generateTransportKeyPair());
    H.U = await encryptAndSet(W.U!, 'uint64', 9090n);

    const k1 = await ring.issue(W.U!.address);
    const r1 = await decrypt(W.U!, [H.U.handle], { kp: k1 });
    ring.release(k1);
    const k2 = await ring.issue(W.U!.address);
    const r2 = await decrypt(W.U!, [H.U.handle], { kp: k2 });
    ring.release(k2);
    const reuseReleased = await decrypt(W.U!, [H.U.handle], { kp: k1 });

    // A session the app keeps open: a key and its permit, not released.
    const k3 = await ring.issue(W.U!.address);
    ring.keepPermit(W.U!.address, await signPermit(W.U!, k3));
    const whileActive = await purgeIfRetired(decClient, { ring, address: W.U!.address });
    await sendTx(W.U!, acl, 'retireAccount', []);
    const afterRetirement = await purgeIfRetired(decClient, { ring, address: W.U!.address });
    result.transportHygiene = {
      publicKeysDistinct: k1.publicKey !== k2.publicKey,
      r1,
      r2,
      k1Disposed: isTransportKeyPairDisposed(k1),
      reuseReleased,
      whileActive: { retired: whileActive.status.retired, purged: whileActive.purged ?? null },
      afterRetirement: { retired: afterRetirement.status.retired, purged: afterRetirement.purged },
      k3Disposed: isTransportKeyPairDisposed(k3),
      keysLeft: ring.keyCount(W.U!.address),
      permitsLeft: ring.permitsOf(W.U!.address).length,
    };

    expect(k1.publicKey).not.toBe(k2.publicKey);
    expect(r1).toMatchObject({ ok: true, values: ['9090'] });
    expect(r2).toMatchObject({ ok: true, values: ['9090'] });
    expect(isTransportKeyPairDisposed(k1)).toBe(true);
    expect(reuseReleased.ok).toBe(false);
    expect(reuseReleased.error).toMatch(/disposed/);
    expect(reuseReleased.relayerCalled, 'a released key pair is refused before any share request').toBe(false);
    expect(whileActive.purged).toBeUndefined();
    expect(afterRetirement.purged).toEqual({ keys: 1, permits: 1 });
    expect(isTransportKeyPairDisposed(k3)).toBe(true);
    expect(result.transportHygiene.keysLeft).toBe(0);
    expect(result.transportHygiene.permitsLeft).toBe(0);
  });
});
