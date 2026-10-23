// =============================================================================
// Level 0, gate G2-mock (part 1): the Decryption Authority Lifecycle Core end to end
// in Zama's own cleartext mock, on a local anvil.
//
//   Stack:   sdk/js-sdk/contracts v0.13.0 cleartext host stack, deployed by Zama's own
//            script (fhevm-deploy.sh -> DeployCleartextFHEVMHost.s.sol), with CleartextACL
//            re-pointed at the ACL v0.4.1 backport (branch lifecycle/level0-mock).
//   Signers: Zama's default 4-signer KMS set (non-forge), so the cleartext relayer takes
//            the on-chain CleartextKMSVerifier.userDecrypt / delegatedUserDecrypt path.
//   SDK:     the clone's SDK source, unmodified (cleartext decrypt client + relayer).
//
// LABEL: proven in mock: persistAllowed + delegated view + flow; plaintext is public in the mock.
//
// Refusals are attributed per layer:
//   L1  SDK client precheck   client.decryptValues(...)  -> ACL.persistAllowed / isHandleDelegated... eth_calls
//   L2  SDK cleartext relayer with the precheck skipped (runtime.relayer.fetch[Delegated]UserDecrypt)
//   L3a CleartextKMSVerifier.userDecrypt / delegatedUserDecrypt, direct eth_call, valid signature
//   L3b CleartextACL.plaintextForUserDecryption / plaintextForDelegatedUserDecryption, direct eth_call
// and the L3a revert is tied to CleartextACL.sol:<line>: the last CleartextACL.sol statement
// executed in the ACL frame before REVERT (opcode trace + the build's source map) must equal
// the error's unique revert statement in the compiled AST (analyze_build.mjs).
//
// No expiry second is pinned: expiries are set relative to the latest block and only
// compared with ">" or "== 0" (gated getter).
//
// Accounts are fresh random wallets created in memory for this run; only addresses are
// recorded. Nothing is sent anywhere but RPC_URL (127.0.0.1, never port 8545).
//
// Env (set by run_mock_e2e.sh): RPC_URL, HARNESS_FHEVM_CLONE, HARNESS_RESULT_JSON,
//      HARNESS_BUNDLE (analysis-bundle.json), HARNESS_VAULT_ARTIFACT (RetirableVault.json)
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
// SDK internals (same module instances as the client's): two for layer L2, and the
// precheck's error class (FhevmErrorBase overwrites .name for every SDK error, so the
// type is checked with instanceof; sdk/js-sdk/src/core/errors/FhevmErrorBase.ts:42-45).
import { toFhevmHandle } from '@sdk-src/core/handle/FhevmHandle.ts';
import { initPublicAction } from '@sdk-src/core/runtime/CoreFhevm-p.ts';
import { AclUserDecryptionError } from '@sdk-src/core/errors/AclError.ts';

const LABEL = 'proven in mock: persistAllowed + delegated view + flow; plaintext is public in the mock';

const here = dirname(fileURLToPath(import.meta.url));
const CLONE = resolve(process.env.HARNESS_FHEVM_CLONE ?? join(here, '..', '..', 'fhevm-v0.13.8'));
const RPC_URL = process.env.RPC_URL ?? '';
const RESULT_JSON = process.env.HARNESS_RESULT_JSON ?? join(here, '.build', 'last-result.json');
const BUNDLE = JSON.parse(readFileSync(process.env.HARNESS_BUNDLE ?? join(here, '.build', 'analysis-bundle.json'), 'utf8'));
const VAULT = JSON.parse(
  readFileSync(process.env.HARNESS_VAULT_ARTIFACT ?? join(here, '.build', 'vault-out', 'RetirableVault.sol', 'RetirableVault.json'), 'utf8'),
);

// ERC-1967 implementation slot; ACL storage namespaces (ACL.sol:207, :210-211)
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ACL_STORAGE_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const ACL_RETIREMENT_STORAGE_LOCATION = '0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200';
const DAL_CORE_INTERFACE_ID = '0x556d2088';
const FORGE_FHEVM_V1_KMS_SIGNER = '0x0971c80ff03b428fd2094dd5354600ab103201c5'; // signers.ts:30-33 (address only)
const FHE_TYPE = { bool: 0, uint8: 2, uint32: 4, uint64: 5 } as const; // library-solidity/lib/FheType.sol
const DAY = 24n * 3600n;

// ---------------------------------------------------------------------------
// Addresses come from the clone's own files (same as the baseline harness).
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
    numKmsNodes: Number(g(/^num_kms_nodes=(\d+)/m)),
  };
}
function readFheTestAddress(): string {
  const j = JSON.parse(readFileSync(join(CLONE, 'sdk/js-sdk/test/chains/chain-defaults.json'), 'utf8'));
  return ethers.getAddress(j.localcleartext.fheTestAddress);
}

// ---------------------------------------------------------------------------
// RPC recorder (as in the baseline): every eth_call the SDK makes.
// ---------------------------------------------------------------------------
type RecordedCall = { to: string; selector: string; data: string };
class RecordingProvider extends ethers.JsonRpcProvider {
  calls: RecordedCall[] = [];
  override async _send(payload: ethers.JsonRpcPayload | Array<ethers.JsonRpcPayload>) {
    for (const p of Array.isArray(payload) ? payload : [payload]) {
      if (p.method === 'eth_call') {
        const tx = (p.params as any[])[0] ?? {};
        const data: string = tx.data ?? tx.input ?? '0x';
        this.calls.push({ to: String(tx.to).toLowerCase(), selector: data.slice(0, 10), data });
      }
    }
    return super._send(payload);
  }
}

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const ACL_ERRORS = [
  'error UserNotAuthorizedForDecrypt(bytes32 handle, address userAddress)',
  'error ContractNotAuthorizedForDecrypt(bytes32 handle, address contractAddress)',
  'error HandleNotDelegatedForUserDecryption(bytes32 handle, address contractAddress, address delegator, address delegate)',
  'error UserAddressEqualsContractAddress()',
  'error SenderRetired(address sender)',
  'error AccountAlreadyRetired(address account)',
  'error SenderNotAllowed(address sender)',
  'error SenderDenied(address sender)',
  'error CleartextACLTransientNotSet(bytes32 handle)',
  'error CleartextACLCleartextNotSaved(bytes32 handle)',
  'error EnforcedPause()',
];
const ACL_ABI = [
  ...ACL_ERRORS,
  'function persistAllowed(bytes32,address) view returns (bool)',
  'function isAllowed(bytes32,address) view returns (bool)',
  'function isHandleDelegatedForUserDecryption(address,address,address,bytes32) view returns (bool)',
  'function getUserDecryptionDelegationExpirationDate(address,address,address) view returns (uint64)',
  'function delegateForUserDecryption(address,address,uint64)',
  'function allow(bytes32,address)',
  'function multicall(bytes[]) returns (bytes[])',
  'function retireAccount()',
  'function isAccountRetired(address) view returns (bool)',
  'function supportsInterface(bytes4) view returns (bool)',
  'function retirementStorageLocation() pure returns (bytes32)',
  'function getVersion() view returns (string)',
  'function getFHEVMExecutorAddress() view returns (address)',
  'function plaintext(bytes32) view returns (uint256)',
  'function plaintextForUserDecryption((bytes32 handle,address contractAddress)[],address) view returns (uint256[])',
  'function plaintextForDelegatedUserDecryption((bytes32 handle,address contractAddress)[],address,address) view returns (uint256[])',
  'event Allowed(address indexed caller, address indexed account, bytes32 handle)',
  'event AccountRetired(address indexed account, address indexed successor)',
  'event DelegatedForUserDecryption(address indexed delegator, address indexed delegate, address contractAddress, uint64 delegationCounter, uint64 oldExpirationDate, uint64 newExpirationDate)',
];
const KMSV_ABI = [
  ...ACL_ERRORS,
  'error InvalidUserDecryptSignature()',
  'error ContractAddressNotAuthorized(address contractAddress)',
  'function userDecrypt((bytes32 handle,address contractAddress)[],address,bytes,address[],uint256,uint256,bytes) view returns (bytes,address[],uint256,bytes)',
  'function delegatedUserDecrypt((bytes32 handle,address contractAddress)[],address,address,bytes,address[],uint256,uint256,bytes) view returns (bytes,address[],uint256,bytes)',
  'function getKmsSigners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
];
const FHETEST_ABI = [
  'function getCoprocessorConfig() view returns (tuple(address ACLAddress, address CoprocessorAddress, address KMSVerifierAddress))',
  'function setEuint64(bytes32,bytes,uint64,bool) returns (bytes32)',
  'function setEuint32(bytes32,bytes,uint32,bool) returns (bytes32)',
  'function setEuint8(bytes32,bytes,uint8,bool) returns (bytes32)',
  'function setEbool(bytes32,bytes,bool,bool) returns (bytes32)',
  'function getHandleOf(address account, uint8 fheType) view returns (bytes32)',
];
const EXECUTOR_PLAINTEXTS_ABI = ['function plaintexts(bytes32) view returns (uint256)'];
const aclIface = new ethers.Interface(ACL_ABI);
const kmsvIface = new ethers.Interface(KMSV_ABI);
const vaultIface = new ethers.Interface([...VAULT.abi, ...ACL_ERRORS]);
const SEL_NAMES: Record<string, string> = {};
for (const iface of [aclIface, kmsvIface]) iface.forEachFunction((f) => (SEL_NAMES[f.selector] = f.name));
const selName = (sel: string) => SEL_NAMES[sel] ?? sel;
const ACL_ERROR_BY_SELECTOR = new Map<string, string>();
aclIface.forEachError((e) => ACL_ERROR_BY_SELECTOR.set(e.selector.slice(2), e.name));

// ---------------------------------------------------------------------------
// Revert decoding (errors bubble through ethers / SDK wrappers)
// ---------------------------------------------------------------------------
function collectHex(e: any, seen = new Set<any>(), depth = 0): string[] {
  const out: string[] = [];
  if (!e || typeof e !== 'object' || seen.has(e) || depth > 8) return out;
  seen.add(e);
  for (const k of Object.getOwnPropertyNames(e)) {
    let v: any;
    try {
      v = e[k];
    } catch {
      continue;
    }
    if (typeof v === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(v) && v.length % 2 === 0) out.push(v);
    else if (v && typeof v === 'object') out.push(...collectHex(v, seen, depth + 1));
  }
  return out;
}
type Revert = { name: string; args: string[]; text: string; data: string };
function decodeRevert(e: any): Revert | undefined {
  for (const d of collectHex(e)) {
    for (const iface of [aclIface, kmsvIface, vaultIface]) {
      try {
        const p = iface.parseError(d);
        if (p) return { name: p.name, args: p.args.map(String), text: `${p.name}(${p.args.map(String).join(', ')})`, data: d };
      } catch {
        /* not this one */
      }
    }
  }
  return undefined;
}
const errText = (e: any) => `${e?.name ?? 'Error'}: ${String(e?.shortMessage ?? e?.message ?? e).split('\n')[0]!.slice(0, 400)}`;

// ---------------------------------------------------------------------------
// Source map: runtime pc -> file:line, from the analysis build (analyze_build.mjs)
// ---------------------------------------------------------------------------
type SmEntry = { s: number; l: number; f: number; j: string };
class SrcMapper {
  private idx = new Map<number, number>();
  private sm: SmEntry[] = [];
  private lineStarts = new Map<string, number[]>();
  private texts = new Map<string, string[]>();
  constructor(private b: { deployedBytecode: string; sourceMap: string; sourceIdToPath: Record<string, string> }) {
    const code = ethers.getBytes(b.deployedBytecode);
    for (let pc = 0, i = 0; pc < code.length; i++) {
      this.idx.set(pc, i);
      const op = code[pc]!;
      pc += op >= 0x60 && op <= 0x7f ? op - 0x5e : 1;
    }
    let prev: SmEntry = { s: -1, l: -1, f: -1, j: '-' };
    for (const item of b.sourceMap.split(';')) {
      const p = item.split(':');
      const cur = { ...prev };
      if (p[0]) cur.s = Number(p[0]);
      if (p[1]) cur.l = Number(p[1]);
      if (p[2]) cur.f = Number(p[2]);
      if (p[3]) cur.j = p[3];
      this.sm.push(cur);
      prev = cur;
    }
  }
  private load(path: string) {
    if (!this.lineStarts.has(path)) {
      const bytes = readFileSync(join(BUNDLE.contractsRoot, path));
      const starts = [0];
      for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x0a) starts.push(i + 1);
      this.lineStarts.set(path, starts);
      this.texts.set(path, bytes.toString('utf8').split('\n'));
    }
  }
  at(pc: number): { file: string; line: number; text: string } | undefined {
    const i = this.idx.get(pc);
    if (i === undefined) return undefined;
    const e = this.sm[i];
    if (!e || e.f < 0) return undefined;
    const path = this.b.sourceIdToPath[String(e.f)];
    if (!path) return undefined; // compiler-generated (yul utility) code
    this.load(path);
    const starts = this.lineStarts.get(path)!;
    let lo = 0,
      hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= e.s) lo = mid;
      else hi = mid - 1;
    }
    return { file: path, line: lo + 1, text: (this.texts.get(path)![lo] ?? '').trim() };
  }
}
const short = (p: string) => p.split('/').pop()!;

// ---------------------------------------------------------------------------
const result: Record<string, any> = {
  label: LABEL,
  startedAt: new Date().toISOString(),
  refusals: [] as any[],
  writeRefusals: [] as any[],
  gas: {} as Record<string, any>,
};

describe('Level 0 Core in the Zama cleartext mock (G2-mock part 1)', () => {
  let provider: RecordingProvider;
  let chain: ReturnType<typeof defineFhevmChain>;
  let addrs: Record<string, string>;
  let fheTestAddress: string;
  let acl: ethers.Contract, kmsv: ethers.Contract, fheTest: ethers.Contract;
  let aclImpl: string, kmsvImpl: string;
  let aclCode: Uint8Array; // deployed CleartextACL implementation runtime code
  let encClient: any, decClient: any;
  const mappers: Record<string, SrcMapper> = {};
  const W: Record<string, ethers.HDNodeWallet> = {};
  const H: Record<string, any> = {}; // handles and values per role

  // ------------------------------------------------------------------ helpers
  const latestTs = async () => BigInt((await provider.getBlock('latest'))!.timestamp);
  const sendTx = async (w: ethers.Signer, c: ethers.Contract, fn: string, args: unknown[]) => {
    const tx = await (c.connect(w) as ethers.Contract)[fn]!(...args);
    const rc = await tx.wait();
    expect(rc?.status, `${fn} must succeed`).toBe(1);
    return rc as ethers.TransactionReceipt;
  };

  async function encryptAndSet(owner: ethers.HDNodeWallet, kind: keyof typeof FHE_TYPE, value: bigint | boolean) {
    const r = await encClient.encryptValues({
      contractAddress: fheTestAddress,
      userAddress: owner.address,
      values: [{ type: kind, value }],
    });
    const fn = { uint64: 'setEuint64', uint32: 'setEuint32', uint8: 'setEuint8', bool: 'setEbool' }[kind];
    const rc = await sendTx(owner, fheTest, fn, [r.encryptedValues[0], r.inputProof, value, false]);
    const handle: string = await fheTest.getHandleOf!(owner.address, FHE_TYPE[kind]);
    return { handle, value, kind, gasUsed: rc.gasUsed };
  }

  async function signPermit(signer: ethers.HDNodeWallet, contract: string, delegator?: string) {
    const kp = await decClient.generateTransportKeyPair();
    const permit = await decClient.signLegacyDecryptionPermit({
      transportKeyPair: kp,
      contractAddresses: [contract],
      durationSeconds: 24 * 3600,
      startTimestamp: Math.floor(Date.now() / 1000) - 5,
      signerAddress: signer.address,
      signer,
      ...(delegator ? { delegatorAddress: delegator } : {}),
    });
    return { kp, permit };
  }

  // L1: SDK client (precheck, then cleartext relayer)
  async function layerSdk(req: Req) {
    provider.calls = [];
    try {
      const vals = await decClient.decryptValues({
        encryptedValues: req.handles.map((h) => asEncryptedValue(h)),
        contractAddress: req.contract,
        signedPermit: req.permit,
        transportKeyPair: req.kp,
      });
      return { ok: true, values: vals.map((v: any) => String(v.value)), ethCalls: callSummary() };
    } catch (e: any) {
      return {
        ok: false,
        errorClass: e?.constructor?.name,
        isAclUserDecryptionError: e instanceof AclUserDecryptionError,
        errorName: e?.name,
        error: errText(e),
        ethCalls: callSummary(),
      };
    }
  }
  const callSummary = () => provider.calls.map((c) => `${selName(c.selector)}@${c.to}`);
  const relayerCalled = (ethCalls: string[]) => ethCalls.some((c) => c.startsWith('userDecrypt@') || c.startsWith('delegatedUserDecrypt@'));

  // L2: the SDK's own cleartext relayer module, client precheck skipped
  async function layerRelayerNoPrecheck(req: Req) {
    const fhevmContext = await initPublicAction(decClient);
    const payload = {
      handleContractPairs: req.handles.map((h) => ({ handle: toFhevmHandle(h), contractAddress: ethers.getAddress(req.contract) })),
      kmsDecryptEip712Signer: req.permit.signerAddress,
      kmsDecryptEip712Message: req.permit.eip712.message,
      kmsDecryptEip712Signature: req.permit.signature,
    };
    const relayer = decClient.runtime.relayer;
    provider.calls = [];
    try {
      const shares = req.delegated
        ? await relayer.fetchDelegatedUserDecrypt(decClient, { version: 1, payload, fhevmContext, options: {} })
        : await relayer.fetchUserDecrypt(decClient, { version: 1, payload, fhevmContext, options: {} });
      return { ok: true, shares: Array.isArray(shares) ? shares.length : 'returned', ethCalls: callSummary() };
    } catch (e: any) {
      return { ok: false, revert: decodeRevert(e)?.text, revertName: decodeRevert(e)?.name, error: errText(e), ethCalls: callSummary() };
    }
  }

  // L3a / L3b call data
  function kmsvCallData(req: Req) {
    const m = req.permit.eip712.message;
    const pairs = req.handles.map((h) => ({ handle: h, contractAddress: req.contract }));
    return req.delegated
      ? kmsvIface.encodeFunctionData('delegatedUserDecrypt', [
          pairs, m.delegatorAddress, req.permit.signerAddress, m.publicKey, m.contractAddresses,
          BigInt(m.startTimestamp), BigInt(m.durationDays), req.permit.signature,
        ])
      : kmsvIface.encodeFunctionData('userDecrypt', [
          pairs, req.permit.signerAddress, m.publicKey, m.contractAddresses,
          BigInt(m.startTimestamp), BigInt(m.durationDays), req.permit.signature,
        ]);
  }
  function aclCallData(req: Req) {
    const pairs = req.handles.map((h) => ({ handle: h, contractAddress: req.contract }));
    return req.delegated
      ? aclIface.encodeFunctionData('plaintextForDelegatedUserDecryption', [pairs, req.permit.eip712.message.delegatorAddress, req.permit.signerAddress])
      : aclIface.encodeFunctionData('plaintextForUserDecryption', [pairs, req.permit.signerAddress]);
  }
  async function rawCall(to: string, data: string) {
    try {
      return { ok: true, ret: await provider.call({ to, data }) };
    } catch (e: any) {
      return { ok: false, revert: decodeRevert(e), error: errText(e) };
    }
  }

  // callTracer frames + opcode trace mapped to source lines (KMSVerifier impl and ACL impl frames)
  async function traceOnChain(to: string, data: string) {
    const ct: any = await provider.send('debug_traceCall', [{ to, data }, 'latest', { tracer: 'callTracer' }]);
    const frames: any[] = [];
    const walk = (f: any, depth: number) => {
      frames.push({
        depth,
        type: f.type,
        to: String(f.to ?? '').toLowerCase(),
        fn: selName(String(f.input ?? '').slice(0, 10)),
        ...(f.error ? { error: f.error } : {}),
        ...(f.error && f.output ? { revert: decodeRevert({ data: f.output })?.text ?? String(f.output).slice(0, 10) } : {}),
      });
      for (const c of f.calls ?? []) walk(c, depth + 1);
    };
    walk(ct, 0);

    const sl: any = await provider.send('debug_traceCall', [
      { to, data },
      'latest',
      { disableStorage: true, disableStack: false, enableMemory: false, enableReturnData: false },
    ]);
    const logs: any[] = sl.structLogs ?? [];
    const base: number = logs[0]?.depth ?? 1; // geth-style traces start at depth 1
    const codeAt: string[] = [to.toLowerCase()];
    const path: string[] = [];
    const aclSteps: Array<{ pc: number; op: string; loc?: { file: string; line: number; text: string } }> = [];
    const enteredAcl: string[] = [];
    for (let i = 0; i < logs.length; i++) {
      const st = logs[i];
      const d: number = st.depth - base + 1;
      codeAt.length = d;
      const code = codeAt[d - 1];
      const mapper = code ? mappers[code] : undefined;
      if (mapper) {
        const loc = mapper.at(st.pc);
        if (loc && /CleartextKMSVerifier\.sol|CleartextACL\.sol|contracts\/ACL\.sol/.test(loc.file)) {
          const key = `${short(loc.file)}:${loc.line}`;
          if (path[path.length - 1] !== key) path.push(key);
        }
        if (code === aclImpl) aclSteps.push({ pc: st.pc, op: st.op, loc });
      }
      if (['CALL', 'STATICCALL', 'DELEGATECALL', 'CALLCODE'].includes(st.op)) {
        const next = logs[i + 1];
        if (next && next.depth - base + 1 === d + 1) {
          const stack: string[] = st.stack;
          const word = String(stack[stack.length - 2]!); // stack top is last: [.., addr, gas]
          const target = ethers.toBeHex(BigInt(word.startsWith('0x') ? word : `0x${word}`) & ((1n << 160n) - 1n), 20).toLowerCase();
          codeAt[d] = target;
          if (target === aclImpl) enteredAcl.push(`${st.op} -> ACL impl at depth ${d + 1}`);
        }
      }
    }
    // keep the tail that starts at the KMSVerifier -> ACL handoff
    const firstAcl = path.findIndex((p) => p.startsWith('CleartextACL.sol:'));
    const tail = firstAcl > 0 ? path.slice(Math.max(0, firstAcl - 2)) : path.slice(-30);

    // Revert site inside the ACL implementation frame. With the optimizer on, the final
    // REVERT opcode sits in a deduplicated tail shared by several revert statements, and the
    // source map attributes that tail to one of them; so the site is taken as (a) the last
    // CleartextACL.sol statement executed before the REVERT, cross-checked by (b) the
    // instruction that pushed the error's selector (unique per error).
    const loc2s = (l?: { file: string; line: number; text: string }) => (l ? `${l.file}:${l.line}` : '(compiler-generated)');
    const revertIdx = aclSteps.findIndex((s) => s.op === 'REVERT');
    let revertStatement: any, revertOpcodeMappedTo: string | undefined;
    if (revertIdx >= 0) {
      revertOpcodeMappedTo = loc2s(aclSteps[revertIdx]!.loc);
      for (let j = revertIdx; j >= 0; j--) {
        const l = aclSteps[j]!.loc;
        if (l && /cleartext\/CleartextACL\.sol$/.test(l.file)) {
          revertStatement = l;
          break;
        }
      }
    }
    const selectorPushes: Array<{ error: string; at: string; text?: string }> = [];
    for (const s of aclSteps.slice(0, revertIdx >= 0 ? revertIdx + 1 : undefined)) {
      const m = /^PUSH(\d+)$/.exec(s.op);
      if (!m || Number(m[1]) < 4) continue;
      const n = Number(m[1]);
      const imm = ethers.hexlify(aclCode.slice(s.pc + 1, s.pc + 1 + n)).slice(2);
      const sel = n === 4 ? imm : /^0+$/.test(imm.slice(8)) ? imm.slice(0, 8) : undefined;
      const err = sel ? ACL_ERROR_BY_SELECTOR.get(sel) : undefined;
      if (err) selectorPushes.push({ error: err, at: loc2s(s.loc), text: s.loc?.text });
    }
    const aclGateLines = [...new Set(aclSteps.map((s) => s.loc).filter((l) => l && /host-contracts\/contracts\/ACL\.sol$/.test(l.file)).map((l) => l!.line))];
    return {
      callFrames: frames,
      linePath: tail.slice(0, 60),
      steps: logs.length,
      enteredAcl,
      acl: {
        revertStatement: revertStatement ? { at: loc2s(revertStatement), text: revertStatement.text } : undefined,
        selectorPushes,
        revertOpcodeMappedTo,
        aclSolLinesVisited: aclGateLines,
      },
    };
  }

  async function views(o: { subject: string; handle?: string; delegator?: string; delegate?: string; contract?: string; rawPairOf?: string[] }) {
    const r: any = { isAccountRetired_subject: await acl.isAccountRetired!(o.subject) };
    r.rawRetiredBit_subject = BigInt(await provider.getStorage(acl.target as string, rawRetiredSlot(o.subject))).toString();
    if (o.handle && !o.delegator) {
      for (const a of o.rawPairOf ?? []) {
        r[`persistAllowed(h,${a.slice(0, 8)})`] = await acl.persistAllowed!(o.handle, a);
        r[`rawPersistedPair(h,${a.slice(0, 8)})`] = BigInt(await provider.getStorage(acl.target as string, rawPairSlot(o.handle, a))).toString();
      }
    }
    if (o.handle && o.delegator && o.delegate && o.contract) {
      r.isHandleDelegatedForUserDecryption = await acl.isHandleDelegatedForUserDecryption!(o.delegator, o.delegate, o.contract, o.handle);
      r.getUserDecryptionDelegationExpirationDate = String(await acl.getUserDecryptionDelegationExpirationDate!(o.delegator, o.delegate, o.contract));
      const raw = BigInt(await provider.getStorage(acl.target as string, rawDelegationSlot(o.delegator, o.delegate, o.contract)));
      r.rawDelegationExpiry_isInFuture = (raw & ((1n << 64n) - 1n)) > (await latestTs());
      for (const a of o.rawPairOf ?? []) {
        r[`rawPersistedPair(h,${a.slice(0, 8)})`] = BigInt(await provider.getStorage(acl.target as string, rawPairSlot(o.handle, a))).toString();
      }
    }
    return r;
  }

  type Req = { requester: ethers.HDNodeWallet; delegated: boolean; delegator?: string; handles: string[]; contract: string; permit: any; kp: any };
  async function makeReq(requester: ethers.HDNodeWallet, handles: string[], contract: string, delegator?: string): Promise<Req> {
    const { kp, permit } = await signPermit(requester, contract, delegator);
    return { requester, delegated: !!delegator, delegator, handles, contract, permit, kp };
  }

  // A refusal, attributed per layer; every layer must refuse.
  async function refusal(c: {
    id: string;
    scenario: string;
    role: string;
    subject: string;
    req: Req;
    expectedError: 'UserNotAuthorizedForDecrypt' | 'ContractNotAuthorizedForDecrypt' | 'HandleNotDelegatedForUserDecryption';
    checkLine: number; // CleartextACL.sol line of the failing check
    precheckView: 'persistAllowed' | 'isHandleDelegatedForUserDecryption';
    precheckMessage: RegExp; // checkPersistAllowed.ts:102 / :111, checkDelegation.ts:125
    viewArgs: Parameters<typeof views>[0];
  }) {
    const L1 = await layerSdk(c.req);
    const L2 = await layerRelayerNoPrecheck(c.req);
    const dK = kmsvCallData(c.req);
    const L3a = await rawCall(kmsv.target as string, dK);
    const trace = await traceOnChain(kmsv.target as string, dK);
    const L3b = await rawCall(acl.target as string, aclCallData(c.req));
    const v = await views(c.viewArgs);
    const rec = {
      id: c.id,
      scenario: c.scenario,
      role: c.role,
      subject: c.subject,
      handles: c.req.handles,
      contract: c.req.contract,
      layers: {
        L1_sdk_precheck: { ...L1, relayerCalled: relayerCalled(L1.ethCalls ?? []) },
        L2_sdk_relayer_precheck_skipped: L2,
        L3a_kmsVerifier_direct: { ok: L3a.ok, revert: (L3a as any).revert?.text, error: (L3a as any).error },
        L3b_cleartextAcl_direct: { ok: L3b.ok, revert: (L3b as any).revert?.text, error: (L3b as any).error },
      },
      refusedBy: [] as string[],
      onchainRevertStatement: trace.acl.revertStatement,
      onchainRevertStatementIsUniqueAstRaiseSite: BUNDLE.raiseSites?.[c.expectedError],
      onchainSelectorPushesSeen_informational: trace.acl.selectorPushes, // solc's constant optimiser may not materialise a selector as a PUSH immediate
      onchainRevertOpcodeMappedTo: `${trace.acl.revertOpcodeMappedTo} (optimizer-shared revert tail)`,
      aclSolLinesVisited: trace.acl.aclSolLinesVisited,
      onchainLinePath: trace.linePath,
      callFrames: trace.callFrames,
      views: v,
    };
    // attribution
    if (!L1.ok && (L1 as any).isAclUserDecryptionError && !rec.layers.L1_sdk_precheck.relayerCalled)
      rec.refusedBy.push('L1 SDK precheck (AclUserDecryptionError; relayer never called)');
    if (!L2.ok && (L2 as any).revertName === c.expectedError) rec.refusedBy.push(`L2 on-chain mock via SDK relayer: ${(L2 as any).revert}`);
    if (!L3a.ok && (L3a as any).revert?.name === c.expectedError) rec.refusedBy.push(`L3a CleartextKMSVerifier: ${(L3a as any).revert.text}`);
    if (!L3b.ok && (L3b as any).revert?.name === c.expectedError) rec.refusedBy.push(`L3b CleartextACL: ${(L3b as any).revert.text}`);
    result.refusals.push(rec);

    expect(L1.ok, `${c.id}: SDK must refuse`).toBe(false);
    expect((L1 as any).isAclUserDecryptionError, `${c.id}: ${(L1 as any).error}`).toBe(true);
    expect((L1 as any).errorClass).toBe('AclUserDecryptionError');
    expect((L1 as any).error).toMatch(c.precheckMessage);
    expect(rec.layers.L1_sdk_precheck.relayerCalled, `${c.id}: precheck must refuse before the relayer`).toBe(false);
    expect((L1.ethCalls ?? []).some((x: string) => x.startsWith(`${c.precheckView}@`))).toBe(true);
    expect(L2.ok, `${c.id}: relayer path must refuse`).toBe(false);
    expect((L2 as any).revertName).toBe(c.expectedError);
    expect(L3a.ok, `${c.id}: CleartextKMSVerifier must refuse`).toBe(false);
    expect((L3a as any).revert?.name).toBe(c.expectedError);
    expect(L3b.ok, `${c.id}: CleartextACL must refuse`).toBe(false);
    expect((L3b as any).revert?.name).toBe(c.expectedError);
    const revertAt = `src/v0.13.0/cleartext/CleartextACL.sol:${c.checkLine + 1}`;
    expect(trace.linePath, `${c.id}: check line executed`).toContain(`CleartextACL.sol:${c.checkLine}`);
    expect(trace.acl.revertStatement?.at, `${c.id}: revert statement`).toBe(revertAt);
    // the error (identified by the revert data's selector) has exactly one revert statement in the AST: the same line
    expect(BUNDLE.raiseSites[c.expectedError], `${c.id}: unique AST raise site`).toEqual([revertAt]);
    expect(v.isAccountRetired_subject).toBe(true);
    expect(v.rawRetiredBit_subject).toBe('1');
    return rec;
  }

  // A positive control through the SDK; also records the on-chain path taken.
  async function allowed(id: string, req: Req, expected: string[]) {
    const L1 = await layerSdk(req);
    const trace = await traceOnChain(kmsv.target as string, kmsvCallData(req));
    const rec = {
      id,
      ok: L1.ok,
      values: (L1 as any).values,
      error: (L1 as any).error,
      ethCalls: L1.ethCalls,
      relayerCalled: relayerCalled(L1.ethCalls ?? []),
      onchainLinePath: trace.linePath,
      aclFrame: trace.callFrames.find((f: any) => f.fn === 'plaintextForUserDecryption' || f.fn === 'plaintextForDelegatedUserDecryption'),
    };
    expect(L1.ok, `${id}: ${(L1 as any).error}`).toBe(true);
    expect((L1 as any).values).toEqual(expected);
    expect(rec.relayerCalled, `${id}: on-chain relayer path`).toBe(true);
    expect(rec.aclFrame && !rec.aclFrame.error).toBe(true);
    return rec;
  }

  // Write path that must revert: static call for the typed error, then a mined tx (status 0) with explicit gas.
  async function writeRefusal(id: string, w: ethers.HDNodeWallet, to: string, data: string, expected: string, stateCheck: () => Promise<any>) {
    let staticRevert: Revert | undefined;
    try {
      await provider.call({ from: w.address, to, data });
    } catch (e: any) {
      staticRevert = decodeRevert(e);
    }
    const tx = await w.sendTransaction({ to, data, gasLimit: 1_000_000n });
    let rc: ethers.TransactionReceipt | null = null;
    try {
      rc = await tx.wait();
    } catch (e: any) {
      rc = e?.receipt ?? (await provider.getTransactionReceipt(tx.hash));
    }
    const rec = { id, from: w.address, to, staticRevert: staticRevert?.text, minedStatus: rc?.status, minedGasUsed: rc?.gasUsed?.toString(), after: await stateCheck() };
    result.writeRefusals.push(rec);
    expect(staticRevert?.name, `${id}`).toBe(expected);
    expect(rc?.status, `${id}: mined tx must fail`).toBe(0);
    return rec;
  }

  // raw storage slots (ACL.sol:156-164 layout; :171-174)
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const mslot = (k: string, kt: 'address' | 'bytes32', p: bigint | string) => ethers.keccak256(coder.encode([kt, 'uint256'], [k, p]));
  const rawPairSlot = (h: string, a: string) => mslot(a, 'address', mslot(h, 'bytes32', ACL_STORAGE_LOCATION));
  const rawRetiredSlot = (a: string) => mslot(a, 'address', ACL_RETIREMENT_STORAGE_LOCATION);
  const rawDelegationSlot = (dr: string, de: string, c: string) =>
    mslot(c, 'address', mslot(de, 'address', mslot(dr, 'address', ACL_STORAGE_LOCATION + 2n)));

  // ------------------------------------------------------------------ setup
  beforeAll(async () => {
    expect(RPC_URL, 'RPC_URL must be set').not.toBe('');
    expect(['127.0.0.1', 'localhost']).toContain(new URL(RPC_URL).hostname);
    expect(new URL(RPC_URL).port, 'port 8545 is reserved on this machine').not.toBe('8545');

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
    kmsv = new ethers.Contract(addrs.kmsVerifierAdd!, KMSV_ABI, provider);
    fheTest = new ethers.Contract(fheTestAddress, FHETEST_ABI, provider);

    // fresh local test accounts (in memory only; addresses recorded, keys never)
    for (const role of ['U', 'D', 'OLD', 'NEW', 'DOLD', 'X', 'Z', 'VOWNER', 'WU', 'WD', 'R', 'OLD1', 'OLD10']) {
      W[role] = ethers.Wallet.createRandom().connect(provider);
      await provider.send('anvil_setBalance', [W[role]!.address, ethers.toQuantity(ethers.parseEther('100'))]);
    }
    result.accounts = Object.fromEntries(Object.entries(W).map(([k, w]) => [k, w.address]));

    setFhevmRuntimeConfig({ auth: { type: 'ApiKeyHeader', value: 'local-harness-not-a-key' } });
    encClient = createFhevmCleartextEncryptClient({ chain, provider });
    decClient = createFhevmCleartextDecryptClient({ chain, provider });
    await encClient.ready;
    await decClient.ready;

    aclImpl = ('0x' + (await provider.getStorage(addrs.aclAdd!, IMPL_SLOT)).slice(26)).toLowerCase();
    kmsvImpl = ('0x' + (await provider.getStorage(addrs.kmsVerifierAdd!, IMPL_SLOT)).slice(26)).toLowerCase();
    mappers[aclImpl] = new SrcMapper(BUNDLE.CleartextACL);
    mappers[kmsvImpl] = new SrcMapper(BUNDLE.CleartextKMSVerifier);
    aclCode = ethers.getBytes(await provider.getCode(aclImpl));

    const node: any = await provider.send('anvil_nodeInfo', []);
    result.env = {
      rpcUrl: RPC_URL,
      chainId: Number((await provider.getNetwork()).chainId),
      clientVersion: await provider.send('web3_clientVersion', []),
      hardFork: node?.hardFork,
      blockGasLimit: node?.environment?.gasLimit,
      clone: CLONE,
      solcOfAnalysisBuild: BUNDLE.solc,
      addresses: { ...addrs, fheTest: fheTestAddress, aclImplementation: aclImpl, kmsVerifierImplementation: kmsvImpl },
    };
  });

  afterAll(() => {
    result.finishedAt = new Date().toISOString();
    mkdirSync(dirname(RESULT_JSON), { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  });

  // ------------------------------------------------------------------ tests
  it('setup: the deployed mock IS the re-pointed build (ACL v0.4.1), with a non-forge 4-signer KMS set', async () => {
    const mask = (hex: string, refs: Record<string, Array<{ start: number; length: number }>>) => {
      const b = ethers.getBytes(hex);
      for (const list of Object.values(refs)) for (const r of list) b.fill(0, r.start, r.start + r.length);
      return ethers.hexlify(b);
    };
    const aclCode = await provider.getCode(aclImpl);
    const kmsvCode = await provider.getCode(kmsvImpl);
    const signers: string[] = (await kmsv.getKmsSigners!()).map((s: string) => s.toLowerCase());
    const setup = {
      aclVersion: await acl.getVersion!(),
      supportsCoreInterface_0x556d2088: await acl.supportsInterface!(DAL_CORE_INTERFACE_ID),
      retirementStorageLocation: await acl.retirementStorageLocation!(),
      aclImplementationMatchesAnalysisBuild:
        mask(aclCode, BUNDLE.CleartextACL.immutableReferences) === mask(BUNDLE.CleartextACL.deployedBytecode, BUNDLE.CleartextACL.immutableReferences),
      aclImplementationRuntimeBytes: ethers.getBytes(aclCode).length,
      kmsVerifierImplementationMatchesAnalysisBuild:
        mask(kmsvCode, BUNDLE.CleartextKMSVerifier.immutableReferences) ===
        mask(BUNDLE.CleartextKMSVerifier.deployedBytecode, BUNDLE.CleartextKMSVerifier.immutableReferences),
      kmsSigners: signers,
      kmsSignerCount: signers.length,
      kmsThreshold: String(await kmsv.getThreshold!()),
      forgeFhevmV1SignerPresent: signers.includes(FORGE_FHEVM_V1_KMS_SIGNER),
      relayerPath: signers.length === 1 && signers[0] === FORGE_FHEVM_V1_KMS_SIGNER ? 'off-chain (forge-fhevm v1)' : 'on-chain (CleartextKMSVerifier view)',
      overrideCheckFromAst: BUNDLE.overrideCheck,
      fheTestCoprocessorConfig: (await fheTest.getCoprocessorConfig!()).map((x: string) => x),
    };
    result.setup = setup;
    expect(setup.aclVersion).toBe('ACL v0.4.1');
    expect(setup.supportsCoreInterface_0x556d2088).toBe(true);
    expect(setup.retirementStorageLocation).toBe(ACL_RETIREMENT_STORAGE_LOCATION);
    expect(setup.aclImplementationMatchesAnalysisBuild).toBe(true);
    expect(setup.kmsVerifierImplementationMatchesAnalysisBuild).toBe(true);
    expect(setup.kmsSignerCount).toBe(4);
    expect(setup.forgeFhevmV1SignerPresent).toBe(false);
    expect(BUNDLE.overrideCheck.violations).toEqual([]);
    for (const w of Object.values(W)) expect(await acl.isAccountRetired!(w.address)).toBe(false);
  });

  it('S1 control: never-retired U decrypts its handle; delegated U -> D decrypts', async () => {
    H.U = await encryptAndSet(W.U!, 'uint64', 424242n);
    const ownReq = await makeReq(W.U!, [H.U.handle], fheTestAddress);
    const own = await allowed('S1.user', ownReq, ['424242']);

    const exp = (await latestTs()) + DAY;
    const rcDel = await sendTx(W.U!, acl, 'delegateForUserDecryption', [W.D!.address, fheTestAddress, exp]);
    const delReq = await makeReq(W.D!, [H.U.handle], fheTestAddress, W.U!.address);
    const del = await allowed('S1.delegated', delReq, ['424242']);
    result.s1 = {
      handle: H.U.handle,
      setEuint64GasUsed: H.U.gasUsed,
      user: own,
      delegateTxGasUsed: rcDel.gasUsed,
      delegated: del,
      views: {
        persistAllowed_U: await acl.persistAllowed!(H.U.handle, W.U!.address),
        isHandleDelegated_U_D: await acl.isHandleDelegatedForUserDecryption!(W.U!.address, W.D!.address, fheTestAddress, H.U.handle),
        isAccountRetired_U: await acl.isAccountRetired!(W.U!.address),
      },
    };
    expect(own.onchainLinePath).toContain('ACL.sol:599'); // persistAllowed gate evaluated, passed
    expect(del.onchainLinePath).toContain('ACL.sol:578'); // delegated-view gate evaluated, passed
  });

  it('S2/S3 preparation: OLD history, delegations from and to OLD, positive controls before retirement', async () => {
    // OLD's history in Zama's FHETest: two successive euint64 values plus three other types
    H.OLD = [
      await encryptAndSet(W.OLD!, 'uint64', 1001n),
      await encryptAndSet(W.OLD!, 'uint64', 1002n),
      await encryptAndSet(W.OLD!, 'uint32', 77n),
      await encryptAndSet(W.OLD!, 'uint8', 42n),
      await encryptAndSet(W.OLD!, 'bool', true),
    ];
    H.X = await encryptAndSet(W.X!, 'uint64', 31337n);
    const exp = (await latestTs()) + DAY;
    await sendTx(W.OLD!, acl, 'delegateForUserDecryption', [W.DOLD!.address, fheTestAddress, exp]); // OLD as delegator
    await sendTx(W.X!, acl, 'delegateForUserDecryption', [W.OLD!.address, fheTestAddress, exp]); // OLD as delegate

    const oldHandles = H.OLD.map((x: any) => x.handle);
    result.s2prep = {
      oldHistory: H.OLD.map((x: any) => ({ handle: x.handle, kind: x.kind, value: String(x.value) })),
      xHandle: H.X.handle,
      before: {
        OLD_decrypts_own_history: await allowed('S2.before.OLD', await makeReq(W.OLD!, oldHandles, fheTestAddress), ['1001', '1002', '77', '42', 'true']),
        DOLD_decrypts_OLD_handle_as_delegate: await allowed('S3.before.fromOLD', await makeReq(W.DOLD!, [oldHandles[0]], fheTestAddress, W.OLD!.address), ['1001']),
        OLD_decrypts_X_handle_as_delegate: await allowed('S3.before.toOLD', await makeReq(W.OLD!, [H.X.handle], fheTestAddress, W.X!.address), ['31337']),
        NEW_has_no_access: await layerSdk(await makeReq(W.NEW!, [oldHandles[0]], fheTestAddress)),
      },
    };
    expect(result.s2prep.before.NEW_has_no_access.ok).toBe(false);
  });

  it('S2: the reverse multicall order [retireAccount(), allow(h, NEW)] reverts and changes nothing', async () => {
    const h0 = H.OLD[0].handle;
    const data = aclIface.encodeFunctionData('multicall', [
      [aclIface.encodeFunctionData('retireAccount'), aclIface.encodeFunctionData('allow', [h0, W.NEW!.address])],
    ]);
    const rec = await writeRefusal('S2.reverseOrder', W.OLD!, acl.target as string, data, 'SenderRetired', async () => ({
      isAccountRetired_OLD: await acl.isAccountRetired!(W.OLD!.address),
      persistAllowed_h0_NEW: await acl.persistAllowed!(h0, W.NEW!.address),
      persistAllowed_h0_OLD: await acl.persistAllowed!(h0, W.OLD!.address),
    }));
    expect(rec.after).toEqual({ isAccountRetired_OLD: false, persistAllowed_h0_NEW: false, persistAllowed_h0_OLD: true });
  });

  it('S2: carry and retire, OLD runs ACL.multicall([allow(h_i, NEW) x5, retireAccount()])', async () => {
    const hs: string[] = H.OLD.map((x: any) => x.handle);
    const calls = [...hs.map((h) => aclIface.encodeFunctionData('allow', [h, W.NEW!.address])), aclIface.encodeFunctionData('retireAccount')];
    const rc = await sendTx(W.OLD!, acl, 'multicall', [calls]);
    const events = rc.logs
      .filter((l) => l.address.toLowerCase() === (acl.target as string).toLowerCase())
      .map((l) => aclIface.parseLog(l))
      .filter(Boolean)
      .map((p) => ({ name: p!.name, args: p!.args.map(String) }));
    result.s2 = {
      carryTx: rc.hash,
      carryGasUsed: rc.gasUsed,
      carriedHandles: hs.length,
      events,
      isAccountRetired_OLD: await acl.isAccountRetired!(W.OLD!.address),
      persistAllowed_NEW: await Promise.all(hs.map((h) => acl.persistAllowed!(h, W.NEW!.address))),
      persistAllowed_OLD: await Promise.all(hs.map((h) => acl.persistAllowed!(h, W.OLD!.address))),
    };
    result.gas.carry_n5 = rc.gasUsed;
    expect(result.s2.isAccountRetired_OLD).toBe(true);
    expect(result.s2.persistAllowed_NEW).toEqual([true, true, true, true, true]);
    expect(result.s2.persistAllowed_OLD).toEqual([false, false, false, false, false]);
    expect(events.filter((e) => e.name === 'Allowed').length).toBe(5);
    expect(events.filter((e) => e.name === 'AccountRetired')).toEqual([
      { name: 'AccountRetired', args: [W.OLD!.address, ethers.ZeroAddress] },
    ]);
  });

  it('S2: NEW user-decrypts the carried history through the SDK', async () => {
    const hs: string[] = H.OLD.map((x: any) => x.handle);
    result.s2.NEW_decrypts_history = await allowed('S2.NEW', await makeReq(W.NEW!, hs, fheTestAddress), ['1001', '1002', '77', '42', 'true']);
  });

  it('S2 + S5: OLD (retired, user role) is refused at every layer', async () => {
    const hs: string[] = H.OLD.map((x: any) => x.handle);
    await refusal({
      id: 'R1.OLD.user',
      scenario: 'S2',
      role: 'user (direct path)',
      subject: W.OLD!.address,
      req: await makeReq(W.OLD!, hs, fheTestAddress),
      expectedError: 'UserNotAuthorizedForDecrypt',
      checkLine: 236,
      precheckView: 'persistAllowed',
      precheckMessage: /User 0x[0-9a-fA-F]{40} is not authorized to decrypt handle 0x[0-9a-f]{64}!/,
      viewArgs: { subject: W.OLD!.address, handle: hs[0], rawPairOf: [W.OLD!.address, W.NEW!.address] },
    });
    const v = result.refusals.at(-1).views;
    expect(v[`rawPersistedPair(h,${W.OLD!.address.slice(0, 8)})`]).toBe('1'); // the grant itself is untouched...
    expect(v[`persistAllowed(h,${W.OLD!.address.slice(0, 8)})`]).toBe(false); // ...only the retirement gate refuses
  });

  it('S3 + S5: delegation FROM OLD (OLD delegator, created before retirement) is refused at every layer', async () => {
    const h0 = H.OLD[0].handle;
    await refusal({
      id: 'R2.fromOLD.delegator',
      scenario: 'S3',
      role: 'delegator (delegated path)',
      subject: W.OLD!.address,
      req: await makeReq(W.DOLD!, [h0], fheTestAddress, W.OLD!.address),
      expectedError: 'HandleNotDelegatedForUserDecryption',
      checkLine: 257,
      precheckView: 'isHandleDelegatedForUserDecryption',
      precheckMessage: /Delegate 0x[0-9a-fA-F]{40} is not delegated by 0x[0-9a-fA-F]{40} to user decrypt handle 0x[0-9a-f]{64} on contract 0x[0-9a-fA-F]{40}!/,
      viewArgs: { subject: W.OLD!.address, handle: h0, delegator: W.OLD!.address, delegate: W.DOLD!.address, contract: fheTestAddress, rawPairOf: [W.OLD!.address, fheTestAddress] },
    });
    const v = result.refusals.at(-1).views;
    expect(v.isHandleDelegatedForUserDecryption).toBe(false);
    expect(v.getUserDecryptionDelegationExpirationDate).toBe('0'); // gated getter
    expect(v.rawDelegationExpiry_isInFuture).toBe(true); // the delegation itself was never revoked
  });

  it('S3 + S5: delegation TO OLD (OLD delegate of X, created before retirement; then re-delegated after it) is refused at every layer', async () => {
    const args = { subject: W.OLD!.address, handle: H.X.handle, delegator: W.X!.address, delegate: W.OLD!.address, contract: fheTestAddress, rawPairOf: [W.X!.address, fheTestAddress] };
    await refusal({
      id: 'R3.toOLD.delegate',
      scenario: 'S3',
      role: 'delegate (delegated path)',
      subject: W.OLD!.address,
      req: await makeReq(W.OLD!, [H.X.handle], fheTestAddress, W.X!.address),
      expectedError: 'HandleNotDelegatedForUserDecryption',
      checkLine: 257,
      precheckView: 'isHandleDelegatedForUserDecryption',
      precheckMessage: /Delegate 0x[0-9a-fA-F]{40} is not delegated by 0x[0-9a-fA-F]{40} to user decrypt handle 0x[0-9a-f]{64} on contract 0x[0-9a-fA-F]{40}!/,
      viewArgs: args,
    });
    // R8: a fresh delegation TO the retired account is accepted (inert) and still refused
    const exp2 = (await latestTs()) + 2n * DAY;
    const rc = await sendTx(W.X!, acl, 'delegateForUserDecryption', [W.OLD!.address, fheTestAddress, exp2]);
    result.s3 = { redelegateToRetiredOLD: { status: rc.status, gasUsed: rc.gasUsed } };
    await refusal({
      id: 'R3b.toOLD.delegate.afterRedelegation',
      scenario: 'S3',
      role: 'delegate (delegated path), delegation renewed after retirement',
      subject: W.OLD!.address,
      req: await makeReq(W.OLD!, [H.X.handle], fheTestAddress, W.X!.address),
      expectedError: 'HandleNotDelegatedForUserDecryption',
      checkLine: 257,
      precheckView: 'isHandleDelegatedForUserDecryption',
      precheckMessage: /Delegate 0x[0-9a-fA-F]{40} is not delegated by 0x[0-9a-fA-F]{40} to user decrypt handle 0x[0-9a-f]{64} on contract 0x[0-9a-fA-F]{40}!/,
      viewArgs: args,
    });
    // control: X itself is unaffected
    result.s3.X_still_decrypts = await allowed('S3.X.control', await makeReq(W.X!, [H.X.handle], fheTestAddress), ['31337']);
  });

  it('S3: OLD cannot create a new delegation (SenderRetired); its other grant paths are closed too', async () => {
    const exp = (await latestTs()) + DAY;
    const h0 = H.OLD[0].handle;
    await writeRefusal(
      'W1.OLD.delegateForUserDecryption',
      W.OLD!,
      acl.target as string,
      aclIface.encodeFunctionData('delegateForUserDecryption', [W.Z!.address, fheTestAddress, exp]),
      'SenderRetired',
      async () => ({
        expiryGetter_OLD_Z: String(await acl.getUserDecryptionDelegationExpirationDate!(W.OLD!.address, W.Z!.address, fheTestAddress)),
        rawDelegationSlot_OLD_Z: BigInt(await provider.getStorage(acl.target as string, rawDelegationSlot(W.OLD!.address, W.Z!.address, fheTestAddress))).toString(),
      }),
    );
    expect(result.writeRefusals.at(-1).after).toEqual({ expiryGetter_OLD_Z: '0', rawDelegationSlot_OLD_Z: '0' });
    await writeRefusal('W2.OLD.allow', W.OLD!, acl.target as string, aclIface.encodeFunctionData('allow', [h0, W.Z!.address]), 'SenderRetired', async () => ({
      rawPersistedPair_h0_Z: BigInt(await provider.getStorage(acl.target as string, rawPairSlot(h0, W.Z!.address))).toString(),
    }));
    await writeRefusal('W3.OLD.retireAgain', W.OLD!, acl.target as string, aclIface.encodeFunctionData('retireAccount'), 'AccountAlreadyRetired', async () => ({
      isAccountRetired_OLD: await acl.isAccountRetired!(W.OLD!.address),
    }));
  });

  it('S4: a contract that holds handles (RetirableVault): setup and positive controls before it retires', async () => {
    const factory = new ethers.ContractFactory(VAULT.abi, VAULT.bytecode.object, W.VOWNER!);
    const vault = await factory.deploy([addrs.aclAdd, addrs.fhevmExecutorAdd, addrs.kmsVerifierAdd]);
    await vault.waitForDeployment();
    H.vault = { address: ethers.getAddress(await vault.getAddress()), contract: vault };
    const enc = await encClient.encryptValues({ contractAddress: H.vault.address, userAddress: W.WU!.address, values: [{ type: 'uint64', value: 5000n }] });
    const rcDep = await sendTx(W.WU!, vault as ethers.Contract, 'deposit', [enc.encryptedValues[0], enc.inputProof]);
    H.vault.handle = await (vault as ethers.Contract).balanceOf!(W.WU!.address);
    const exp = (await latestTs()) + DAY;
    await sendTx(W.WU!, acl, 'delegateForUserDecryption', [W.WD!.address, H.vault.address, exp]);
    H.WUfhe = await encryptAndSet(W.WU!, 'uint64', 777n); // WU's FHETest handle (control)
    result.s4 = {
      vault: H.vault.address,
      vaultHandle: H.vault.handle,
      depositGasUsed: rcDep.gasUsed,
      views: {
        persistAllowed_h_vault: await acl.persistAllowed!(H.vault.handle, H.vault.address),
        persistAllowed_h_WU: await acl.persistAllowed!(H.vault.handle, W.WU!.address),
        isHandleDelegated_WU_WD_vault: await acl.isHandleDelegatedForUserDecryption!(W.WU!.address, W.WD!.address, H.vault.address, H.vault.handle),
      },
      before: {
        direct: await allowed('S4.before.direct', await makeReq(W.WU!, [H.vault.handle], H.vault.address), ['5000']),
        delegated: await allowed('S4.before.delegated', await makeReq(W.WD!, [H.vault.handle], H.vault.address, W.WU!.address), ['5000']),
      },
    };
    expect(result.s4.views.persistAllowed_h_vault).toBe(true);
  });

  it('S4 + S5: the contract retires through its helper; its handles are refused on the direct path (contract role)', async () => {
    const vault = H.vault.contract as ethers.Contract;
    const rc = await sendTx(W.VOWNER!, vault, 'retire', []);
    const ev = rc.logs.filter((l) => l.address.toLowerCase() === (acl.target as string).toLowerCase()).map((l) => aclIface.parseLog(l)!);
    result.s4.retireViaHelper = { tx: rc.hash, gasUsed: rc.gasUsed, events: ev.map((p) => ({ name: p.name, args: p.args.map(String) })) };
    result.gas.retireAccount_contract_via_helper = rc.gasUsed;
    expect(await acl.isAccountRetired!(H.vault.address)).toBe(true);
    expect(result.s4.retireViaHelper.events).toEqual([{ name: 'AccountRetired', args: [H.vault.address, ethers.ZeroAddress] }]);

    await refusal({
      id: 'R4.contract.direct',
      scenario: 'S4',
      role: 'contract (direct path)',
      subject: H.vault.address,
      req: await makeReq(W.WU!, [H.vault.handle], H.vault.address),
      expectedError: 'ContractNotAuthorizedForDecrypt',
      checkLine: 239,
      precheckView: 'persistAllowed',
      precheckMessage: /Dapp contract 0x[0-9a-fA-F]{40} is not authorized to user decrypt handle 0x[0-9a-f]{64}!/,
      viewArgs: { subject: H.vault.address, handle: H.vault.handle, rawPairOf: [H.vault.address, W.WU!.address] },
    });
    const v = result.refusals.at(-1).views;
    expect(v[`persistAllowed(h,${W.WU!.address.slice(0, 8)})`]).toBe(true); // the user itself is not retired
    expect(v[`persistAllowed(h,${H.vault.address.slice(0, 8)})`]).toBe(false);
    expect(v[`rawPersistedPair(h,${H.vault.address.slice(0, 8)})`]).toBe('1');
  });

  it('S4 + S5: ...and on the delegated path (contract role)', async () => {
    await refusal({
      id: 'R5.contract.delegated',
      scenario: 'S4',
      role: 'contract (delegated path)',
      subject: H.vault.address,
      req: await makeReq(W.WD!, [H.vault.handle], H.vault.address, W.WU!.address),
      expectedError: 'HandleNotDelegatedForUserDecryption',
      checkLine: 257,
      precheckView: 'isHandleDelegatedForUserDecryption',
      precheckMessage: /Delegate 0x[0-9a-fA-F]{40} is not delegated by 0x[0-9a-fA-F]{40} to user decrypt handle 0x[0-9a-f]{64} on contract 0x[0-9a-fA-F]{40}!/,
      viewArgs: { subject: H.vault.address, handle: H.vault.handle, delegator: W.WU!.address, delegate: W.WD!.address, contract: H.vault.address, rawPairOf: [W.WU!.address, H.vault.address] },
    });
    const v = result.refusals.at(-1).views;
    expect(v.getUserDecryptionDelegationExpirationDate).toBe('0');
    expect(v.rawDelegationExpiry_isInFuture).toBe(true);
    // the retired contract's own grant path is closed; the user's other handles are unaffected
    await writeRefusal('W4.vault.shareBalance', W.WU!, H.vault.address, vaultIface.encodeFunctionData('shareBalance', [W.Z!.address]), 'SenderRetired', async () => ({
      rawPersistedPair_h_Z: BigInt(await provider.getStorage(acl.target as string, rawPairSlot(H.vault.handle, W.Z!.address))).toString(),
    }));
    result.s4.WU_fhetest_handle_still_decrypts = await allowed('S4.control.WU.FHETest', await makeReq(W.WU!, [H.WUfhe.handle], fheTestAddress), ['777']);
  });

  it('mock limit: plaintext is public in the mock (no ACL on the cleartext getters)', async () => {
    const h0 = H.OLD[0].handle;
    const anyone = new ethers.Contract(addrs.aclAdd!, ACL_ABI, provider);
    const viaAcl = String(await anyone.plaintext!(h0));
    let viaExecutor: string;
    try {
      viaExecutor = String(await new ethers.Contract(addrs.fhevmExecutorAdd!, EXECUTOR_PLAINTEXTS_ABI, provider).plaintexts!(h0));
    } catch (e: any) {
      viaExecutor = `not available on this executor (${errText(e).slice(0, 80)})`;
    }
    result.mockLimits = {
      note: 'CleartextACL.plaintext(bytes32) is a public view with no ACL check; the mock proves the ACL flow, not confidentiality',
      retiredOldHandle: h0,
      CleartextACL_plaintext_by_unrelated_caller: viaAcl,
      CleartextFHEVMExecutor_plaintexts: viaExecutor,
    };
    expect(viaAcl).toBe('1001');
  });

  it('gas: retireAccount (EOA; contract helper above) and the carry multicall at n = 1, 5 (above), 10', async () => {
    // standalone EOA retirement
    const rcR = await sendTx(W.R!, acl, 'retireAccount', []);
    result.gas.retireAccount_eoa = rcR.gasUsed;
    // carry sweep: fresh accounts with 1 and 10 FHETest handles
    for (const [role, n] of [['OLD1', 1], ['OLD10', 10]] as const) {
      const hs: string[] = [];
      for (let i = 0; i < n; i++) hs.push((await encryptAndSet(W[role]!, 'uint64', BigInt(5000 + i))).handle);
      const calls = [...hs.map((h) => aclIface.encodeFunctionData('allow', [h, W.NEW!.address])), aclIface.encodeFunctionData('retireAccount')];
      const rc = await sendTx(W[role]!, acl, 'multicall', [calls]);
      result.gas[`carry_n${n}`] = rc.gasUsed;
      expect(await acl.isAccountRetired!(W[role]!.address)).toBe(true);
      expect((await Promise.all(hs.map((h) => acl.persistAllowed!(h, W.NEW!.address)))).every(Boolean)).toBe(true);
    }
    const g1 = BigInt(result.gas.carry_n1),
      g10 = BigInt(result.gas.carry_n10);
    result.gas.carry_perHandle_derived = ((g10 - g1) / 9n).toString();
    result.gas.carry_fixed_derived = (g1 - (g10 - g1) / 9n).toString();
    result.gas.note =
      'transaction gasUsed from anvil receipts (includes intrinsic and calldata gas); CleartextACL.allow adds a handleSaved read before ACL.allow';
  });
});
