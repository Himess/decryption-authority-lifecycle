// =============================================================================
// Level 1, rule H9, on a local EVM: the SDK's precautionary user-decryption signature check
// (verifyErc1271UserDecrypt, branch lifecycle/level1) with and without a Profile H policy, against
// real accounts on anvil (Osaka):
//   - E4's ML-DSA-44 ERC-1271 account (Fireblocks verifier, 2,420-byte signature): refused under
//     today's 250,000 cap, accepted under the Profile H budget (H3);
//   - EIP-7702 accounts whose delegate rejects every signature, or has no isValidSignature: the
//     root key is accepted today (ecrecover first) and refused under `enforce`, except through the
//     narrow shim (H2); `shadow` serves today's verdict and logs the difference (H8);
//   - controls: an EOA, and a regular-code wallet signed by its owner.
//
// The check runs with Zama's own ethers adapter (src/ethers/internal/ethereum.ts) over a JSON-RPC
// provider. Accounts are fresh random keys (never printed); the ML-DSA-44 key is E4's public local
// test seed. Nothing is sent anywhere but RPC_URL on 127.0.0.1.
//
// Env (set by run_sdk_h9.sh): HARNESS_RESULT_JSON, ANVIL_PORT
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Chain helpers from experiments/ (their own ethers copy).
import { ethers as xethers } from '../../../../experiments/node_modules/ethers/lib.esm/index.js';
import { startAnvil, makeProvider, makeAccounts, assertChain } from '../../../../experiments/lib/chain.mjs';
import { deployArtifact } from '../../../../experiments/lib/artifacts.mjs';
import { Recorder } from '../../../../experiments/lib/log.mjs';
import { deployPqStack, mldsa } from '../../../../experiments/E4/pqlib.mjs';
import { delegate7702 } from '../../../../experiments/E5/e5-local.mjs';
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
import type { EthCallParameters, EthereumModule } from '@sdk-src/core/modules/ethereum/types.ts';
import type { RelayerModule } from '@sdk-src/core/modules/relayer/types.ts';
import type { KmsUserDecryptEip712V2 } from '@sdk-src/core/types/kms.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');
const RESULT_JSON = process.env.HARNESS_RESULT_JSON ?? path.join(here, '.build', 'last-result.json');
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 18671);

type Outcome = { accepted: boolean; error?: string; message?: string };
type Row = {
  label: string;
  policy: string;
  outcome: Outcome;
  calls: Array<{ gas?: string; blockNumber?: string; calldataBytes: number }>;
  codeReads: number;
  warnings: string[];
};

const rows: Row[] = [];
let anvil: { url: string; stop: () => Promise<void> };
let sdkProvider: ethers.JsonRpcProvider;
let chainId: bigint;

// Accounts
let eoa: xethers.Wallet;
let ownerKey: xethers.Wallet;
let ownerWallet: string;
let rejectAll7702: xethers.Wallet;
let noErc1271_7702: xethers.Wallet;
let pqAccount: string;
const seedHex = xethers.keccak256(xethers.toUtf8Bytes('fhe-authority-lifecycle/E4/local-test-seed/v1')).slice(2);

function eip712For(user: string): KmsUserDecryptEip712V2 {
  return {
    domain: {
      name: 'Decryption',
      version: '1',
      chainId: 54321n,
      verifyingContract: ethers.getAddress('0x000000000000000000000000000000000000dead'),
    },
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
}

function digestOf(eip712: KmsUserDecryptEip712V2): string {
  const fields = eip712.types[eip712.primaryType];
  return ethers.TypedDataEncoder.hash(
    eip712.domain as unknown as ethers.TypedDataDomain,
    { [eip712.primaryType]: [...fields] },
    eip712.message as unknown as Record<string, unknown>,
  );
}

function ecdsa(wallet: xethers.Wallet, digest: string): string {
  return xethers.Signature.from(wallet.signingKey.sign(digest)).serialized;
}

/** Runs the SDK check once, with Zama's ethers adapter wrapped to record what it sends. */
async function check(label: string, user: string, sign: (digest: string) => string, policy?: UserDecryptSignaturePolicy) {
  const base = ethereumModule().ethereum;
  const calls: Row['calls'] = [];
  let codeReads = 0;
  const ethereum: EthereumModule = {
    ...base,
    call: async (client, p: EthCallParameters) => {
      calls.push({
        gas: p.gas?.toString(),
        blockNumber: p.blockNumber?.toString(),
        calldataBytes: (p.data.length - 2) / 2,
      });
      return base.call(client, p);
    },
    getCode: async (client, p) => {
      codeReads += 1;
      return base.getCode!(client, p);
    },
  };
  const warnings: string[] = [];
  const runtime = createFhevmRuntime(PRIVATE_ETHERS_TOKEN, {
    ethereum,
    relayer: {} as RelayerModule,
    config: { logger: { debug: undefined, warn: (m: string) => warnings.push(m), error: undefined } },
  });
  const context = createCoreFhevm(PRIVATE_ETHERS_TOKEN, { chain: sepolia, client: sdkProvider, runtime });
  const eip712 = eip712For(user);
  const signature = sign(digestOf(eip712));
  let outcome: Outcome;
  try {
    await verifyErc1271UserDecrypt(context, {
      userAddress: ethers.getAddress(user) as never,
      eip712,
      signature: signature as never,
      policy,
    });
    outcome = { accepted: true };
  } catch (err) {
    outcome = { accepted: false, error: (err as Error).constructor.name, message: (err as Error).message.slice(0, 300) };
  }
  const row: Row = { label, policy: policy?.codeFirstMode ?? 'none (250,000 cap)', outcome, calls, codeReads, warnings };
  rows.push(row);
  return row;
}

const policy = (codeFirstMode: UserDecryptSignaturePolicy['codeFirstMode'], eip7702Fallback = true) => ({
  ...PROFILE_H_DEFAULT_SIGNATURE_POLICY,
  codeFirstMode,
  eip7702Fallback,
});

beforeAll(async () => {
  anvil = await startAnvil({ port: ANVIL_PORT, hardfork: 'osaka', gasLimit: 1_000_000_000 });
  const provider = makeProvider('local', anvil.url);
  chainId = await assertChain(provider, 'local');
  const { FUNDER } = makeAccounts('local', provider);
  sdkProvider = new ethers.JsonRpcProvider(anvil.url, ethers.Network.from(Number(chainId)), {
    staticNetwork: true,
    cacheTimeout: -1,
  });
  const out = path.dirname(RESULT_JSON);
  fs.mkdirSync(out, { recursive: true });
  const rec = Object.create(Recorder.prototype);
  Object.assign(rec, { experiment: 'L1H9', mode: 'local', dir: out, file: path.join(out, 'L1_h9_sdk_deploy_records.jsonl'), records: [] });
  fs.writeFileSync(rec.file, '');
  const fresh = async () => {
    const w = xethers.Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [w.address, xethers.toQuantity(10n ** 20n)]);
    return w;
  };

  eoa = await fresh();
  ownerKey = await fresh();
  ownerWallet = (await deployArtifact(rec, 'L1H9.1', FUNDER, 'OwnerWallet1271', [ownerKey.address])).address;
  const rejectAll = (await deployArtifact(rec, 'L1H9.1', FUNDER, 'RejectAll1271Wallet')).address;
  const noErc1271 = (await deployArtifact(rec, 'L1H9.1', FUNDER, 'NoErc1271')).address;
  rejectAll7702 = await fresh();
  noErc1271_7702 = await fresh();
  for (const [w, target, kind] of [
    [rejectAll7702, rejectAll, 'rejectAll'],
    [noErc1271_7702, noErc1271, 'noErc1271'],
  ] as const) {
    const r = await delegate7702(rec, 'L1H9.2', w, target, { delegateKind: kind });
    if (!r.ok) throw new Error(`7702 delegation ${kind} not in place`);
  }
  pqAccount = (await deployPqStack(rec, 'L1H9.3', FUNDER, { seedHex })).account;
});

afterAll(async () => {
  fs.writeFileSync(
    RESULT_JSON,
    JSON.stringify(
      {
        label: 'proven on a local EVM (anvil, Osaka): the SDK precautionary check, rule H9',
        sdk: 'impl/wt-l1-h9 sdk/js-sdk (branch lifecycle/level1), ethers adapter',
        chainId: chainId?.toString(),
        date: new Date().toISOString(),
        rows,
      },
      null,
      1,
    ),
  );
  await anvil?.stop();
});

describe('SDK precheck, H9, on a local EVM', () => {
  it('ML-DSA-44 ERC-1271 account: refused at 250,000, accepted under the Profile H budget', async () => {
    const sign = (d: string) => '0x' + mldsa('sign', { seedHex, msg: d }).sig;
    const today = await check('pq.mldsa44', pqAccount, sign);
    expect(today.outcome.accepted).toBe(false);
    expect(today.calls[0]?.gas).toBe('250000');

    const off = await check('pq.mldsa44', pqAccount, sign, policy('off'));
    expect(off.outcome).toEqual({ accepted: true });
    // B_exec + 21,000 + 64 × 2,532 calldata bytes (selector, digest, offset, length, 2,420 bytes padded to 2,432)
    expect(off.calls[0]?.calldataBytes).toBe(2_532);
    expect(off.calls[0]?.gas).toBe((2_000_000 + 21_000 + 64 * 2_532).toString());

    const enforce = await check('pq.mldsa44', pqAccount, sign, policy('enforce'));
    expect(enforce.outcome).toEqual({ accepted: true });
    expect(enforce.codeReads).toBe(1);
    expect(enforce.calls[0]?.blockNumber).toBeDefined();
  });

  it('EIP-7702 account whose delegate rejects everything: root key accepted today, refused under enforce', async () => {
    const sign = (d: string) => ecdsa(rejectAll7702, d);
    expect((await check('7702.reject-all.root-key', rejectAll7702.address, sign)).outcome).toEqual({ accepted: true });
    expect((await check('7702.reject-all.root-key', rejectAll7702.address, sign, policy('off'))).outcome).toEqual({
      accepted: true,
    });
    const shadow = await check('7702.reject-all.root-key', rejectAll7702.address, sign, policy('shadow'));
    expect(shadow.outcome).toEqual({ accepted: true });
    expect(shadow.warnings.some((w) => w.includes('PROFILE-H-SHADOW'))).toBe(true);
    const enforce = await check('7702.reject-all.root-key', rejectAll7702.address, sign, policy('enforce'));
    expect(enforce.outcome.accepted).toBe(false);
    expect(enforce.outcome.error).toBe('Erc1271WrongMagicError');
  });

  it('EIP-7702 account whose delegate has no isValidSignature: the narrow shim, and Profile Q without it', async () => {
    const sign = (d: string) => ecdsa(noErc1271_7702, d);
    expect((await check('7702.no-erc1271.root-key', noErc1271_7702.address, sign, policy('enforce'))).outcome).toEqual({
      accepted: true,
    });
    const noShim = await check('7702.no-erc1271.root-key', noErc1271_7702.address, sign, policy('enforce', false));
    expect(noShim.outcome.accepted).toBe(false);
    expect(noShim.outcome.error).toBe('Erc1271RejectedError');
  });

  it('controls: an EOA and a regular-code wallet', async () => {
    const eoaOff = await check('eoa.valid', eoa.address, (d) => ecdsa(eoa, d), policy('off'));
    expect(eoaOff.outcome).toEqual({ accepted: true });
    expect(eoaOff.calls.length + eoaOff.codeReads).toBe(0);
    const eoaEnforce = await check('eoa.valid', eoa.address, (d) => ecdsa(eoa, d), policy('enforce'));
    expect(eoaEnforce.outcome).toEqual({ accepted: true });
    expect(eoaEnforce.codeReads).toBe(1);
    expect(eoaEnforce.calls.length).toBe(0);
    const wrongKey = await check('eoa.wrong-key', eoa.address, (d) => ecdsa(ownerKey, d), policy('enforce'));
    expect(wrongKey.outcome.error).toBe('Erc1271EoaMismatchNoCodeError');
    const wallet = await check('regular.owner-wallet', ownerWallet, (d) => ecdsa(ownerKey, d), policy('enforce'));
    expect(wallet.outcome).toEqual({ accepted: true });
  });
});
