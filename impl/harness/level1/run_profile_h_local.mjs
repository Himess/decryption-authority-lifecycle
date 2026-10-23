// Level 1 (Profile H) evidence on a local anvil: the Level 1 `user-decryption-signature` crate (via udsig-h) against
// real accounts (EOAs, a regular-code wallet, EIP-7702 delegated EOAs with five kinds of delegate, an ERC-7739-like
// wallet, the Fireblocks ML-DSA-44 ERC-1271 account of experiment E4, and a gas-burner budget probe). Every verifier
// RPC goes through a JSON-RPC recorder, so the RPC sequence, the block each read used, and "no RPC before the caps"
// are taken from the wire.
//
// Local only: anvil on 127.0.0.1, fresh random keys (never printed), the public E4 test seed for ML-DSA-44.
// Usage: node run_profile_h_local.mjs <out_dir>
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from '../../../experiments/node_modules/ethers/lib.esm/index.js';
import { startAnvil, makeProvider, makeAccounts, assertChain } from '../../../experiments/lib/chain.mjs';
import { deployArtifact } from '../../../experiments/lib/artifacts.mjs';
import { Recorder } from '../../../experiments/lib/log.mjs';
import { deployPqStack, mldsa, probeIsValidSignature } from '../../../experiments/E4/pqlib.mjs';
import { delegate7702 } from '../../../experiments/E5/e5-local.mjs';
import { hardwareInfo } from '../../../experiments/E4/e4-local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const UDSIG_H = path.join(ROOT, 'impl', '.tools', 'target-udsig-h', 'release', process.platform === 'win32' ? 'udsig-h.exe' : 'udsig-h');
const RECORDER = path.join(ROOT, 'results', 'level0', 'raw', 'vps', 'level0', 'scripts', 'rpc_recorder.py');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'results', 'level1', 'raw'));
const ANVIL_PORT = 18661;
const REC_PORT = 18662;
const REC_URL = `http://127.0.0.1:${REC_PORT}`;
const B_EXEC = 2_000_000;
const LEGACY_CAP = 250_000; // kms-connector config.rs:274 erc1271_gas_limit default @ ed851716c

fs.mkdirSync(OUT, { recursive: true });
const recLog = path.join(OUT, 'L1_profile_h_host_rpc.jsonl');
fs.writeFileSync(recLog, '');

// A recorder for deployments that writes into OUT (not into experiments/).
const rec = Object.create(Recorder.prototype);
Object.assign(rec, { experiment: 'L1', mode: 'local', dir: OUT, file: path.join(OUT, 'L1_profile_h_deploy_records.jsonl'), records: [] });
fs.writeFileSync(rec.file, '');

function udsig(args, stdin = '') {
  const r = spawnSync(UDSIG_H, args, { input: stdin, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw new Error(`udsig-h ${args[0]} failed: ${(r.stderr || '').slice(-800)}`);
  return JSON.parse(r.stdout.trim());
}

const results = [];
function verifyH(label, signer, digest, sigHex, { mode = 'enforce', bExec = B_EXEC, fallback = true, attempts = { negatives: 0, last: null }, pkLen = 800, edLen = 33 } = {}) {
  const url = `${REC_URL}/${label}`;
  const out = udsig(['verify-h', url, signer, digest, mode, String(bExec), fallback ? '1' : '0', String(attempts.negatives), attempts.last == null ? '-' : String(attempts.last), String(pkLen), String(edLen)], sigHex);
  results.push({ label, kind: 'verify-h', signer, ...out });
  return out;
}
function verifyLegacy(label, signer, digest, sigHex, gas = LEGACY_CAP) {
  const out = udsig(['verify-legacy', `${REC_URL}/${label}`, signer, digest, String(gas)], sigHex);
  results.push({ label, kind: 'verify-legacy', signer, ...out });
  return out;
}

function ecdsa(wallet, digest) {
  return ethers.Signature.from(wallet.signingKey.sign(digest)).serialized;
}

async function main() {
  const anvil = await startAnvil({ port: ANVIL_PORT, hardfork: 'osaka', gasLimit: 1_000_000_000 });
  const recorder = spawn('python', ['-I', RECORDER, String(REC_PORT), anvil.url, recLog], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let recErr = '';
  recorder.stderr.on('data', (d) => (recErr = (recErr + d.toString()).slice(-4000)));
  try {
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(REC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    fs.writeFileSync(recLog, ''); // drop the readiness probe
    const provider = makeProvider('local', anvil.url);
    const chainId = await assertChain(provider, 'local');
    const { FUNDER } = makeAccounts('local', provider);
    const fresh = async () => {
      const w = ethers.Wallet.createRandom().connect(provider);
      await provider.send('anvil_setBalance', [w.address, ethers.toQuantity(10n ** 20n)]);
      return w;
    };

    // ---------------------------------------------------------------- accounts
    const eoa = await fresh();
    const ownerK = await fresh();
    const ownerWallet = (await deployArtifact(rec, 'L1.1', FUNDER, 'OwnerWallet1271', [ownerK.address])).address;
    const rejectAll = (await deployArtifact(rec, 'L1.1', FUNDER, 'RejectAll1271Wallet')).address;
    const rootKey = (await deployArtifact(rec, 'L1.1', FUNDER, 'RootKey7702Delegate')).address;
    const noErc1271 = (await deployArtifact(rec, 'L1.1', FUNDER, 'NoErc1271')).address;
    const emptyRevert = (await deployArtifact(rec, 'L1.1', FUNDER, 'EmptyRevert1271')).address;
    const reasonRevert = (await deployArtifact(rec, 'L1.1', FUNDER, 'ReasonRevert1271')).address;
    const k7739 = await fresh();
    const w7739 = (await deployArtifact(rec, 'L1.1', FUNDER, 'Erc7739LikeWallet', [k7739.address])).address;
    const burner = (await deployArtifact(rec, 'L1.1', FUNDER, 'GasBurner1271')).address;
    const d7702 = {};
    for (const [name, target] of Object.entries({ rejectAll, rootKey, noErc1271, emptyRevert, reasonRevert })) {
      const w = await fresh();
      const r = await delegate7702(rec, 'L1.2', w, target, { delegateKind: name });
      if (!r.ok) throw new Error(`7702 delegation ${name} not in place`);
      d7702[name] = w;
    }
    const seedHex = ethers.keccak256(ethers.toUtf8Bytes('fhe-authority-lifecycle/E4/local-test-seed/v1')).slice(2);
    const pq = await deployPqStack(rec, 'L1.3', FUNDER, { seedHex });

    // ---------------------------------------------------------------- one unified permit shape per signer
    const permitFor = (user) => ({
      chainId: Number(chainId),
      gateway: '0x000000000000000000000000000000000000dEaD',
      userAddress: user,
      publicKey: '0x' + 'ab'.repeat(800),
      allowedContracts: ['0x1111111111111111111111111111111111111111'],
      startTimestamp: 1_800_000_000,
      durationSeconds: 86_400,
      extraData: '0x01' + '00'.repeat(32),
    });
    const digestOf = (user) => udsig(['digest'], JSON.stringify(permitFor(user))).digest;

    const modes = ['off', 'shadow', 'enforce'];
    const matrix = [];
    const row = (label, signer, sigHex, extra = {}) => {
      const digest = extra.digest ?? digestOf(signer);
      const sig = typeof sigHex === 'function' ? sigHex(digest) : sigHex;
      const r = { label, signer, legacy: verifyLegacy(`${label}.legacy`, signer, digest, sig) };
      for (const m of modes) r[m] = verifyH(`${label}.${m}`, signer, digest, sig, { mode: m, ...extra.opts });
      if (extra.alsoNoFallback) r.enforceNoFallback = verifyH(`${label}.enforce-nofallback`, signer, digest, sig, { mode: 'enforce', fallback: false });
      matrix.push(r);
      return r;
    };

    // ---------------------------------------------------------------- H2 code-first matrix
    row('eoa.valid', eoa.address, (d) => ecdsa(eoa, d));
    row('eoa.wrong-key', eoa.address, (d) => ecdsa(ownerK, d));
    row('regular.owner-wallet', ownerWallet, (d) => ecdsa(ownerK, d));
    row('7702.reject-all.root-key', d7702.rejectAll.address, (d) => ecdsa(d7702.rejectAll, d));
    row('7702.root-key-delegate.root-key', d7702.rootKey.address, (d) => ecdsa(d7702.rootKey, d));
    row('7702.no-erc1271.root-key', d7702.noErc1271.address, (d) => ecdsa(d7702.noErc1271, d), { alsoNoFallback: true });
    row('7702.empty-revert.root-key', d7702.emptyRevert.address, (d) => ecdsa(d7702.emptyRevert, d));
    row('7702.reason-revert.root-key', d7702.reasonRevert.address, (d) => ecdsa(d7702.reasonRevert, d));
    row('7739-like.plain', w7739, (d) => ecdsa(k7739, d));
    row('7739-like.nested', w7739, (d) => {
      const nested = ethers.solidityPackedKeccak256(['bytes4', 'bytes32', 'address'], ['0x7739abcd', d, w7739]);
      return ethers.concat(['0x7739abcd', ecdsa(k7739, nested)]);
    });

    // ---------------------------------------------------------------- H3 budget: ML-DSA-44 and a calldata-heavy probe
    const pqDigest = digestOf(pq.account);
    const { sig: pqSig } = mldsa('sign', { seedHex, msg: pqDigest });
    const pqSigHex = '0x' + pqSig;
    const probe = await probeIsValidSignature(provider, { account: pq.account, meter: pq.meter, digest: pqDigest, sigHex: pqSigHex });
    const pqRow = row('pq.mldsa44', pq.account, pqSigHex, { digest: pqDigest });
    const pqBudget = {};
    for (const b of [1_000_000, 1_200_000, 1_300_000, 1_500_000, 2_000_000]) {
      pqBudget[b] = verifyH(`pq.mldsa44.bexec-${b}`, pq.account, pqDigest, pqSigHex, { mode: 'enforce', bExec: b });
    }
    // Smallest accepting B_exec (binary search, enforce).
    let lo = 1_000_000;
    let hi = 2_000_000;
    while (hi - lo > 1_000) {
      const mid = Math.floor((lo + hi) / 2);
      if (udsig(['verify-h', anvil.url, pq.account, pqDigest, 'enforce', String(mid), '1', '0', '-', '800', '33'], pqSigHex).ok) hi = mid;
      else lo = mid;
    }
    const pqMinBExec = hi;

    const bigLen = 60_000;
    const burnerSig = (gas) => ethers.concat([ethers.toBeHex(gas, 32), '0x' + 'ab'.repeat(bigLen - 32)]);
    const burnerDigest = digestOf(burner);
    const smallSig = (gas) => ethers.toBeHex(gas, 32); // 32-byte signature: calldata allowance negligible
    const budget = {
      calldataBytes: bigLen,
      small_burn_1_9M: verifyH('budget.small.burn-1.9M.profile-h', burner, burnerDigest, smallSig(1_900_000), { mode: 'enforce' }),
      small_burn_2_1M: verifyH('budget.small.burn-2.1M.profile-h', burner, burnerDigest, smallSig(2_100_000), { mode: 'enforce' }),
      profileH_burn_1_9M: verifyH('budget.burn-1.9M.profile-h', burner, burnerDigest, burnerSig(1_900_000), { mode: 'enforce' }),
      profileH_burn_2_1M: verifyH('budget.burn-2.1M.profile-h', burner, burnerDigest, burnerSig(2_100_000), { mode: 'enforce' }),
      profileH_burn_4_5M: verifyH('budget.burn-4.5M.profile-h', burner, burnerDigest, burnerSig(4_500_000), { mode: 'enforce' }),
      legacy_cap_250k: verifyLegacy('budget.burn-1.9M.legacy-250k', burner, burnerDigest, burnerSig(1_900_000), LEGACY_CAP),
      legacy_cap_2_021M: verifyLegacy('budget.burn-1.9M.legacy-2.021M', burner, burnerDigest, burnerSig(1_900_000), B_EXEC + 21_000),
    };

    // ---------------------------------------------------------------- H1 caps: no RPC at all
    const capSig = '0x' + '11'.repeat(65_537);
    const caps = {
      signature_65537: verifyH('caps.signature-65537', ownerWallet, digestOf(ownerWallet), capSig, { mode: 'enforce' }),
      publicKey_4097: verifyH('caps.public-key-4097', ownerWallet, digestOf(ownerWallet), ecdsa(ownerK, digestOf(ownerWallet)), { mode: 'enforce', pkLen: 4_097 }),
      extraData_1025: verifyH('caps.extra-data-1025', ownerWallet, digestOf(ownerWallet), ecdsa(ownerK, digestOf(ownerWallet)), { mode: 'enforce', edLen: 1_025 }),
      signature_65536_passes_caps: verifyH('caps.signature-65536', ownerWallet, digestOf(ownerWallet), '0x' + '11'.repeat(65_536), { mode: 'enforce' }),
    };

    // ---------------------------------------------------------------- H4 attempts, a block apart
    const wrong = (d) => ecdsa(eoa, d); // the owner wallet rejects any key but its owner
    const owd = digestOf(ownerWallet);
    const a1 = verifyH('attempts.1', ownerWallet, owd, wrong(owd), { mode: 'enforce' });
    const a2 = verifyH('attempts.2-same-block', ownerWallet, owd, wrong(owd), { mode: 'enforce', attempts: { negatives: a1.attempts.negatives, last: a1.attempts.last_negative_block } });
    await provider.send('evm_mine', []);
    const a3 = verifyH('attempts.2-next-block', ownerWallet, owd, wrong(owd), { mode: 'enforce', attempts: { negatives: a1.attempts.negatives, last: a1.attempts.last_negative_block } });
    const a4 = verifyH('attempts.3', ownerWallet, owd, wrong(owd), { mode: 'enforce', attempts: { negatives: a3.attempts.negatives, last: a3.attempts.last_negative_block } });

    // ---------------------------------------------------------------- wire analysis
    await new Promise((r) => setTimeout(r, 300));
    const wire = {};
    for (const line of fs.readFileSync(recLog, 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(line);
      const label = (r.path || '/').replace(/^\//, '');
      const q = r.req;
      const blockParam = q.method === 'eth_getCode' ? q.params[1] : q.method === 'eth_call' ? q.params[1] : undefined;
      (wire[label] ??= []).push({ method: q.method, block: blockParam, gas: q.method === 'eth_call' ? q.params[0].gas : undefined, ms: +((r.t - r.t0) * 1000).toFixed(3), result: q.method === 'eth_blockNumber' ? r.resp.result : undefined, error: r.resp.error ? (r.resp.error.message || '').slice(0, 80) : undefined });
    }
    const pinned = {};
    for (const [label, calls] of Object.entries(wire)) {
      const bn = calls.find((c) => c.method === 'eth_blockNumber')?.result;
      const reads = calls.filter((c) => c.method === 'eth_getCode' || c.method === 'eth_call');
      pinned[label] = { calls: calls.map((c) => c.method), blockNumber: bn, readBlocks: [...new Set(reads.map((c) => c.block))], onePinnedBlock: reads.length === 0 || reads.every((c) => c.block === bn) };
    }
    const getCodeMs = Object.values(wire).flat().filter((c) => c.method === 'eth_getCode').map((c) => c.ms).sort((a, b) => a - b);
    const med = (xs) => (xs.length ? xs[Math.floor(xs.length / 2)] : null);

    const summary = {
      env: { hardware: hardwareInfo(), anvil: 'osaka, 127.0.0.1', chainId: chainId.toString(), crate: 'impl/wt-l1-main shared/user-decryption-signature (lifecycle/level1)', harness: 'impl/harness/level1/udsig-h', date: new Date().toISOString() },
      contracts: { ownerWallet, rejectAll, rootKey, noErc1271, emptyRevert, reasonRevert, w7739, burner, pq },
      matrix,
      pq: { probe, row: pqRow, budget: pqBudget, minAcceptingBExec: pqMinBExec, signatureBytes: (pqSigHex.length - 2) / 2 },
      budget,
      caps,
      attempts: { a1, a2_same_block: a2, a3_next_block: a3, a4_exhausted: a4 },
      wire: { pinned, getCodeMs: { n: getCodeMs.length, median: med(getCodeMs), min: getCodeMs[0], max: getCodeMs[getCodeMs.length - 1] } },
    };
    fs.writeFileSync(path.join(OUT, 'L1_profile_h_local.json'), JSON.stringify(summary, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    fs.writeFileSync(path.join(OUT, 'L1_profile_h_wire.json'), JSON.stringify(wire, null, 1));
    console.log('written', path.join(OUT, 'L1_profile_h_local.json'));
  } finally {
    recorder.kill();
    await anvil.stop();
    if (recErr.trim()) fs.writeFileSync(path.join(OUT, 'L1_profile_h_recorder.err'), recErr);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
