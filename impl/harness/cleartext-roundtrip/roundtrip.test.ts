// =============================================================================
// Level-0 baseline B: user and delegated user decryption through Zama's own
// cleartext path, on a local anvil, with fresh local test accounts.
//
// Path under test (unmodified Zama code):
//   SDK decrypt client (sdk/js-sdk/src, cleartext variant)
//     1. client precheck   -> eth_call ACL.persistAllowed / ACL.isHandleDelegatedForUserDecryption
//     2. cleartext relayer -> eth_call KMSVerifier.userDecrypt / delegatedUserDecrypt
//          (CleartextKMSVerifier) -> CleartextACL.plaintextForUserDecryption
//          / plaintextForDelegatedUserDecryption -> persistAllowed /
//          isHandleDelegatedForUserDecryption (internal calls in the ACL)
//
// The test records every eth_call the SDK sends (selector + target) and, for
// the relayer call, asks anvil for a call trace (debug_traceCall/callTracer),
// so the report can show which ACL views the path actually touched.
//
// Env (set by impl/harness/baselineB_cleartext.sh):
//   RPC_URL               anvil endpoint (never port 8545)
//   HARNESS_MNEMONIC      fresh local test mnemonic (from impl/harness/.env)
//   HARNESS_FHEVM_CLONE   fhevm clone (default ../../fhevm-main)
//   HARNESS_PROFILE       cleartext host-contracts profile dir (default v0.13.0)
//   HARNESS_RESULT_JSON   where to write the machine-readable result
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

const here = dirname(fileURLToPath(import.meta.url));
const CLONE = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'fhevm-main'));
const PROFILE_DIR = process.env.HARNESS_PROFILE ?? 'v0.13.0';
const RPC_URL = process.env.RPC_URL ?? '';
const MNEMONIC = process.env.HARNESS_MNEMONIC ?? '';
const RESULT_JSON = process.env.HARNESS_RESULT_JSON ?? join(here, 'last-result.json');

const CLEAR_VALUE = 424242n; // the value Alice encrypts
const FHE_TYPE_UINT64 = 5; // library-solidity/lib/FheType.sol: Bool=0,Uint4=1,Uint8=2,Uint16=3,Uint32=4,Uint64=5

// ---------------------------------------------------------------------------
// Addresses come from the clone's own files, so a Level-0 variant of the stack
// (different ACL, same deployer) is picked up without editing this file.
// ---------------------------------------------------------------------------
function readHostAddresses(): Record<string, string> {
  const f = join(CLONE, 'sdk/js-sdk/contracts/src', PROFILE_DIR, 'host-contracts/addresses/FHEVMHostAddresses.sol');
  const out: Record<string, string> = {};
  for (const m of readFileSync(f, 'utf8').matchAll(/address constant (\w+) = address\((0x[0-9a-fA-F]{40})\)/g)) {
    out[m[1]!] = ethers.getAddress(m[2]!);
  }
  return out;
}
function readDeployConstants(): { gatewayChainId: number; decryption: string; inputVerification: string } {
  // sdk/js-sdk/contracts/scripts/fhevm-deploy.sh: chain_id_gateway, decryption_address, input_verification_address
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

// ---------------------------------------------------------------------------
// RPC recorder: logs every eth_call the SDK makes (target + selector + data).
// ---------------------------------------------------------------------------
type RecordedCall = { to: string; selector: string; data: string; from?: string };
class RecordingProvider extends ethers.JsonRpcProvider {
  calls: RecordedCall[] = [];
  methods: string[] = [];
  override async _send(payload: ethers.JsonRpcPayload | Array<ethers.JsonRpcPayload>) {
    for (const p of Array.isArray(payload) ? payload : [payload]) {
      this.methods.push(p.method);
      if (p.method === 'eth_call') {
        const tx = (p.params as any[])[0] ?? {};
        const data: string = tx.data ?? tx.input ?? '0x';
        this.calls.push({ to: String(tx.to).toLowerCase(), selector: data.slice(0, 10), data, from: tx.from });
      }
    }
    return super._send(payload);
  }
}

const SIG = {
  persistAllowed: 'persistAllowed(bytes32,address)',
  isAllowed: 'isAllowed(bytes32,address)',
  isHandleDelegatedForUserDecryption: 'isHandleDelegatedForUserDecryption(address,address,address,bytes32)',
  userDecrypt: 'userDecrypt((bytes32,address)[],address,bytes,address[],uint256,uint256,bytes)',
  delegatedUserDecrypt: 'delegatedUserDecrypt((bytes32,address)[],address,address,bytes,address[],uint256,uint256,bytes)',
  plaintextForUserDecryption: 'plaintextForUserDecryption((bytes32,address)[],address)',
  plaintextForDelegatedUserDecryption: 'plaintextForDelegatedUserDecryption((bytes32,address)[],address,address)',
  plaintexts: 'plaintexts(bytes32)',
} as const;
const SEL: Record<keyof typeof SIG, string> = Object.fromEntries(
  Object.entries(SIG).map(([k, v]) => [k, ethers.id(v).slice(0, 10)]),
) as any;
const selName = (sel: string) => (Object.entries(SEL).find(([, s]) => s === sel)?.[0] ?? sel);

// Walk a callTracer tree and collect (to, selector) of every frame.
type Frame = { to?: string; input?: string; type?: string; calls?: Frame[]; error?: string };
function flatten(frame: Frame, depth = 0, out: Array<{ depth: number; type: string; to: string; fn: string }> = []) {
  out.push({ depth, type: frame.type ?? '?', to: (frame.to ?? '').toLowerCase(), fn: selName((frame.input ?? '').slice(0, 10)) });
  for (const c of frame.calls ?? []) flatten(c, depth + 1, out);
  return out;
}

const ACL_ABI = [
  'function persistAllowed(bytes32,address) view returns (bool)',
  'function isAllowed(bytes32,address) view returns (bool)',
  'function isHandleDelegatedForUserDecryption(address,address,address,bytes32) view returns (bool)',
  'function delegateForUserDecryption(address,address,uint64)',
  'function getUserDecryptionDelegationExpirationDate(address,address,address) view returns (uint64)',
  'function getVersion() view returns (string)',
  'function getFHEVMExecutorAddress() view returns (address)',
  'error UserNotAuthorizedForDecrypt(bytes32 handle, address userAddress)',
  'error ContractNotAuthorizedForDecrypt(bytes32 handle, address contractAddress)',
  'error HandleNotDelegatedForUserDecryption(bytes32 handle, address contractAddress, address delegator, address delegate)',
  'error UserAddressEqualsContractAddress()',
];
const KMSV_ABI = [
  `function ${SIG.userDecrypt.replace('(bytes32,address)[]', 'tuple(bytes32 handle,address contractAddress)[]')} view returns (bytes,address[],uint256,bytes)`,
  `function ${SIG.delegatedUserDecrypt.replace('(bytes32,address)[]', 'tuple(bytes32 handle,address contractAddress)[]')} view returns (bytes,address[],uint256,bytes)`,
  'function getKmsSigners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'error InvalidUserDecryptSignature()',
  'error ContractAddressNotAuthorized(address contractAddress)',
  // errors raised by CleartextACL inside the call:
  'error UserNotAuthorizedForDecrypt(bytes32 handle, address userAddress)',
  'error ContractNotAuthorizedForDecrypt(bytes32 handle, address contractAddress)',
  'error HandleNotDelegatedForUserDecryption(bytes32 handle, address contractAddress, address delegator, address delegate)',
];
const FHETEST_ABI = [
  'function CONTRACT_NAME() view returns (string)',
  'function getCoprocessorConfig() view returns (tuple(address ACLAddress, address CoprocessorAddress, address KMSVerifierAddress))',
  'function setEuint64(bytes32 inputEuint64, bytes inputProof, uint64 clearValue, bool makePublic) returns (bytes32)',
  'function getHandleOf(address account, uint8 fheType) view returns (bytes32)',
  'function hasHandleOf(address account, uint8 fheType) view returns (bool)',
];

function decodeRevert(iface: ethers.Interface, e: any): string {
  const data: string | undefined = e?.data ?? e?.info?.error?.data ?? e?.error?.data;
  if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) return `${parsed.name}(${parsed.args.map((a: unknown) => String(a)).join(', ')})`;
    } catch {
      /* fallthrough */
    }
    return `raw revert data ${data.slice(0, 10)}`;
  }
  return String(e?.shortMessage ?? e?.message ?? e);
}

// ---------------------------------------------------------------------------
const result: Record<string, unknown> = { startedAt: new Date().toISOString() };

describe('Baseline B: cleartext user + delegated decryption (unmodified stack)', () => {
  let provider: RecordingProvider;
  let chain: ReturnType<typeof defineFhevmChain>;
  let addrs: Record<string, string>;
  let fheTestAddress: string;
  let alice: ethers.HDNodeWallet, bob: ethers.HDNodeWallet, carol: ethers.HDNodeWallet;
  let acl: ethers.Contract, kmsv: ethers.Contract, fheTest: ethers.Contract;
  let handle: string;

  beforeAll(async () => {
    expect(RPC_URL, 'RPC_URL must be set').not.toBe('');
    expect(new URL(RPC_URL).port, 'port 8545 is reserved on this machine').not.toBe('8545');
    expect(MNEMONIC.split(' ').length, 'HARNESS_MNEMONIC must be set (impl/harness/.env)').toBeGreaterThanOrEqual(12);

    addrs = readHostAddresses();
    const dc = readDeployConstants();
    fheTestAddress = readFheTestAddress();
    chain = defineFhevmChain({
      id: 31_337,
      fhevm: {
        contracts: {
          acl: { address: addrs.aclAdd as `0x${string}` },
          inputVerifier: { address: addrs.inputVerifierAdd as `0x${string}` },
          kmsVerifier: { address: addrs.kmsVerifierAdd as `0x${string}` },
          protocolConfig: { address: addrs.protocolConfigAdd as `0x${string}` },
        },
        // The cleartext relayer module never performs HTTP requests (it answers from
        // eth_calls); port 9 (discard) makes sure nothing could reach a real service.
        relayerUrl: 'http://127.0.0.1:9',
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
    const mn = ethers.Mnemonic.fromPhrase(MNEMONIC);
    const derive = (i: number) => ethers.HDNodeWallet.fromMnemonic(mn, `m/44'/60'/0'/0/${i}`).connect(provider);
    [alice, bob, carol] = [derive(0), derive(1), derive(2)];
    for (const w of [alice, bob, carol]) {
      await provider.send('anvil_setBalance', [w.address, ethers.toQuantity(ethers.parseEther('100'))]);
    }

    acl = new ethers.Contract(addrs.aclAdd!, ACL_ABI, provider);
    kmsv = new ethers.Contract(addrs.kmsVerifierAdd!, KMSV_ABI, provider);
    fheTest = new ethers.Contract(fheTestAddress, FHETEST_ABI, provider);

    const kmsSigners: string[] = await kmsv.getKmsSigners!();
    const cfg = await fheTest.getCoprocessorConfig!();
    Object.assign(result, {
      rpcUrl: RPC_URL,
      chainId: Number((await provider.getNetwork()).chainId),
      clientVersion: await provider.send('web3_clientVersion', []),
      clone: CLONE,
      profileDir: PROFILE_DIR,
      addresses: { ...addrs, fheTest: fheTestAddress, ...dc },
      aclVersion: await acl.getVersion!(),
      kmsSignerCount: kmsSigners.length,
      // forgeFhevmV1.ts:42-54 takes the off-chain "Option B" path only for exactly one
      // forge-fhevm v1 KMS signer; with 4 signers the relayer uses the on-chain view.
      relayerPathExpected: kmsSigners.length === 1 ? 'off-chain (forge-fhevm v1)' : 'on-chain (CleartextKMSVerifier view)',
      accounts: { alice: alice.address, bob: bob.address, carol: carol.address },
      fheTestCoprocessorConfig: cfg.map((x: string) => x),
    });
    expect(await provider.getCode(fheTestAddress)).not.toBe('0x');

    setFhevmRuntimeConfig({ auth: { type: 'ApiKeyHeader', value: 'local-harness-not-a-key' } });
  });

  afterAll(() => {
    result.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULT_JSON), { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  });

  it('Alice encrypts a uint64 with the SDK and stores it in FHETest (grant to Alice + FHETest)', async () => {
    const enc = createFhevmCleartextEncryptClient({ chain, provider });
    await enc.ready;
    const r = await enc.encryptValues({
      contractAddress: fheTestAddress as `0x${string}`,
      userAddress: alice.address as `0x${string}`,
      values: [{ type: 'uint64', value: CLEAR_VALUE }] as any,
    });
    const tx = await (fheTest.connect(alice) as ethers.Contract).setEuint64!(r.encryptedValues[0], r.inputProof, CLEAR_VALUE, false);
    const rc = await tx.wait();
    expect(rc?.status).toBe(1);
    handle = await fheTest.getHandleOf!(alice.address, FHE_TYPE_UINT64);
    const views = {
      persistAllowed_alice: await acl.persistAllowed!(handle, alice.address),
      persistAllowed_fheTest: await acl.persistAllowed!(handle, fheTestAddress),
      persistAllowed_bob: await acl.persistAllowed!(handle, bob.address),
      persistAllowed_carol: await acl.persistAllowed!(handle, carol.address),
    };
    result.encrypt = { inputHandle: r.encryptedValues[0], storedHandle: handle, setEuint64Tx: rc?.hash, gasUsed: rc?.gasUsed, views };
    expect(views.persistAllowed_alice).toBe(true);
    expect(views.persistAllowed_fheTest).toBe(true);
    expect(views.persistAllowed_bob).toBe(false);
  });

  it('(a) user decryption: never-retired Alice decrypts through the SDK cleartext path', async () => {
    const client = createFhevmCleartextDecryptClient({ chain, provider });
    await client.ready;
    const kp = await client.generateTransportKeyPair();
    const permit = await client.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [fheTestAddress as `0x${string}`],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: alice.address as `0x${string}`,
      signer: alice,
    });
    provider.calls = [];
    const out = await client.decryptValue({
      encryptedValue: asEncryptedValue(handle),
      contractAddress: fheTestAddress as `0x${string}`,
      signedPermit: permit,
      transportKeyPair: kp,
    });
    const calls = provider.calls.map((c) => ({ to: c.to, fn: selName(c.selector) }));
    const relayerCall = provider.calls.find((c) => c.selector === SEL.userDecrypt);
    let trace: unknown = 'not available';
    if (relayerCall) {
      try {
        const t: Frame = await provider.send('debug_traceCall', [
          { to: relayerCall.to, data: relayerCall.data },
          'latest',
          { tracer: 'callTracer' },
        ]);
        trace = flatten(t);
      } catch (e) {
        trace = `debug_traceCall failed: ${String((e as Error).message)}`;
      }
    }
    result.userDecrypt = { value: out.value, type: out.type, ethCalls: calls, relayerCallTrace: trace, permitPrimaryType: permit.eip712.primaryType };
    expect(BigInt(out.value as bigint)).toBe(CLEAR_VALUE);
    // Client precheck hit ACL.persistAllowed; the cleartext relayer hit KMSVerifier.userDecrypt.
    expect(provider.calls.some((c) => c.selector === SEL.persistAllowed && c.to === addrs.aclAdd!.toLowerCase())).toBe(true);
    expect(relayerCall?.to).toBe(addrs.kmsVerifierAdd!.toLowerCase());
    if (Array.isArray(trace)) {
      expect(trace.some((f) => f.to === addrs.aclAdd!.toLowerCase() && f.fn === 'plaintextForUserDecryption')).toBe(true);
    }
  });

  it('(b) delegated user decryption: Alice delegates to Bob, Bob decrypts', async () => {
    const latest = await provider.getBlock('latest');
    const expiration = BigInt(latest!.timestamp) + 24n * 3600n;
    const tx = await (acl.connect(alice) as ethers.Contract).delegateForUserDecryption!(bob.address, fheTestAddress, expiration);
    const rc = await tx.wait();
    expect(rc?.status).toBe(1);
    const viewDelegated = await acl.isHandleDelegatedForUserDecryption!(alice.address, bob.address, fheTestAddress, handle);
    expect(viewDelegated).toBe(true);

    const client = createFhevmCleartextDecryptClient({ chain, provider });
    await client.ready;
    const kp = await client.generateTransportKeyPair();
    const permit = await client.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [fheTestAddress as `0x${string}`],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: bob.address as `0x${string}`,
      signer: bob,
      delegatorAddress: alice.address as `0x${string}`,
    });
    provider.calls = [];
    const out = await client.decryptValue({
      encryptedValue: asEncryptedValue(handle),
      contractAddress: fheTestAddress as `0x${string}`,
      signedPermit: permit,
      transportKeyPair: kp,
    });
    const calls = provider.calls.map((c) => ({ to: c.to, fn: selName(c.selector) }));
    const relayerCall = provider.calls.find((c) => c.selector === SEL.delegatedUserDecrypt);
    let trace: unknown = 'not available';
    if (relayerCall) {
      try {
        const t: Frame = await provider.send('debug_traceCall', [
          { to: relayerCall.to, data: relayerCall.data },
          'latest',
          { tracer: 'callTracer' },
        ]);
        trace = flatten(t);
      } catch (e) {
        trace = `debug_traceCall failed: ${String((e as Error).message)}`;
      }
    }
    result.delegatedDecrypt = {
      delegateTx: rc?.hash,
      delegateGasUsed: rc?.gasUsed,
      expiration,
      value: out.value,
      type: out.type,
      ethCalls: calls,
      relayerCallTrace: trace,
      permitPrimaryType: permit.eip712.primaryType,
    };
    expect(BigInt(out.value as bigint)).toBe(CLEAR_VALUE);
    expect(
      provider.calls.some((c) => c.selector === SEL.isHandleDelegatedForUserDecryption && c.to === addrs.aclAdd!.toLowerCase()),
    ).toBe(true);
    expect(relayerCall?.to).toBe(addrs.kmsVerifierAdd!.toLowerCase());
    if (Array.isArray(trace)) {
      expect(trace.some((f) => f.to === addrs.aclAdd!.toLowerCase() && f.fn === 'plaintextForDelegatedUserDecryption')).toBe(true);
    }
  });

  it('control: Carol (never granted) is refused by the SDK precheck AND by the on-chain mock view', async () => {
    const client = createFhevmCleartextDecryptClient({ chain, provider });
    await client.ready;
    const kp = await client.generateTransportKeyPair();
    const permit = await client.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [fheTestAddress as `0x${string}`],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: carol.address as `0x${string}`,
      signer: carol,
    });
    let sdkError = '';
    try {
      await client.decryptValue({
        encryptedValue: asEncryptedValue(handle),
        contractAddress: fheTestAddress as `0x${string}`,
        signedPermit: permit,
        transportKeyPair: kp,
      });
    } catch (e) {
      sdkError = `${(e as Error).name}: ${(e as Error).message}`;
    }
    expect(sdkError).not.toBe('');

    // Bypass the SDK precheck: call the cleartext relayer's on-chain view directly.
    const m = permit.eip712.message as any;
    let onchain = '';
    try {
      await kmsv.userDecrypt!(
        [{ handle, contractAddress: fheTestAddress }],
        carol.address,
        m.publicKey,
        m.contractAddresses,
        BigInt(m.startTimestamp),
        BigInt(m.durationDays),
        permit.signature,
      );
      onchain = 'NO REVERT';
    } catch (e) {
      onchain = decodeRevert(kmsv.interface, e);
    }
    result.controlUnauthorizedUser = { sdkError, onchainRevert: onchain };
    expect(onchain.startsWith('UserNotAuthorizedForDecrypt(')).toBe(true);
  });

  it('control: Carol as an undelegated delegate of Alice is refused (SDK precheck and on-chain view)', async () => {
    const client = createFhevmCleartextDecryptClient({ chain, provider });
    await client.ready;
    const kp = await client.generateTransportKeyPair();
    const permit = await client.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [fheTestAddress as `0x${string}`],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: carol.address as `0x${string}`,
      signer: carol,
      delegatorAddress: alice.address as `0x${string}`,
    });
    let sdkError = '';
    try {
      await client.decryptValue({
        encryptedValue: asEncryptedValue(handle),
        contractAddress: fheTestAddress as `0x${string}`,
        signedPermit: permit,
        transportKeyPair: kp,
      });
    } catch (e) {
      sdkError = `${(e as Error).name}: ${(e as Error).message}`;
    }
    expect(sdkError).not.toBe('');
    const m = permit.eip712.message as any;
    let onchain = '';
    try {
      await kmsv.delegatedUserDecrypt!(
        [{ handle, contractAddress: fheTestAddress }],
        alice.address,
        carol.address,
        m.publicKey,
        m.contractAddresses,
        BigInt(m.startTimestamp),
        BigInt(m.durationDays),
        permit.signature,
      );
      onchain = 'NO REVERT';
    } catch (e) {
      onchain = decodeRevert(kmsv.interface, e);
    }
    result.controlUndelegatedDelegate = { sdkError, onchainRevert: onchain };
    expect(onchain.startsWith('HandleNotDelegatedForUserDecryption(')).toBe(true);
  });
});
