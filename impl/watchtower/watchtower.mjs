#!/usr/bin/env node
// Watchtower (Decryption Authority Lifecycle, Level 3, E2). A reference script that holds an account's pre-signed
// retirement certificate and relays it to every chain the certificate lists:
//   - `relay`: now, on each listed chain where the account is not retired yet;
//   - `watch`: when a compromise signal appears on any watched chain, then on every listed chain.
// The signals (TARGET_ARCHITECTURE §4.4 (c)) are a grant by the account (`Allowed(caller = account, ...)`), a
// wildcard or non-expiring delegation by the account (`DelegatedForUserDecryption(delegator = account, ...)`), and an
// observer change on a watched ERC-7984 token (`ERC7984ObserverAccessObserverSet(account, ...)`).
//
// A certificate can only trigger the handover to the successor the account confirmed beforehand, so holding it (or
// leaking it) risks an early but planned handover, never a takeover. The watchtower never needs the account's key.
//
// Usage:
//   node watchtower.mjs relay --config <config.json> [--signer impersonate|env]
//   node watchtower.mjs watch --config <config.json> [--signer impersonate|env] [--interval-ms 2000] [--once]
// config.json: { "certificate": { "account", "successor", "chainIds": [..], "signature" },
//                "chains": [ { "name", "rpc", "acl", "tokens"?: [..], "fromBlock"?: n } ],
//                "expectedGrantees"?: [..] }   (grants by the account to these addresses are not signals)
// Signer: `impersonate` sends from the relayer address `relayer` in the config (local anvil with --auto-impersonate);
//         `env` signs with WATCHTOWER_RELAYER_KEY (never printed). Any funded account can relay.
// Library: ethers v6, resolved from WATCHTOWER_ETHERS_FROM (a package.json path) or from the Zama clone next to it.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  process.env.WATCHTOWER_ETHERS_FROM || path.join(here, "..", "fhevm-main", "host-contracts", "package.json"),
);
const { ethers } = require("ethers");

export const CERTIFICATE_INTERFACE_ID = "0x4b9ec076";
export const CERTIFICATE_DOMAIN = { name: "DecryptionAuthorityLifecycle", version: "1" };
export const CERTIFICATE_TYPES = {
  RetireAccount: [
    { name: "account", type: "address" },
    { name: "successor", type: "address" },
    { name: "chainIds", type: "uint256[]" },
  ],
};
const WILDCARD = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";
const UINT64_MAX = (1n << 64n) - 1n;

const ACL_ABI = [
  "event Allowed(address indexed caller, address indexed account, bytes32 handle)",
  "event DelegatedForUserDecryption(address indexed delegator, address indexed delegate, address contractAddress, uint64 delegationCounter, uint64 oldExpirationDate, uint64 newExpirationDate)",
  "event AccountRetired(address indexed account, address indexed successor)",
  "function retireAccountWithSig(address account, address successor, uint256[] chainIds, bytes signature)",
  "function isAccountRetired(address account) view returns (bool)",
  "function successorOf(address account) view returns (address)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "error AccountAlreadyRetired(address account)",
  "error CertificateWrongChain(uint256 chainId)",
  "error CertificateSuccessorMismatch(address confirmed, address certified)",
  "error InvalidRetirementCertificate(address account)",
];
const TOKEN_ABI = ["event ERC7984ObserverAccessObserverSet(address account, address oldObserver, address newObserver)"];

/// The EIP-712 digest a certificate signs (chain-agnostic domain: name and version only).
export function certificateDigest(certificate) {
  return ethers.TypedDataEncoder.hash(CERTIFICATE_DOMAIN, CERTIFICATE_TYPES, {
    account: certificate.account,
    successor: certificate.successor,
    chainIds: certificate.chainIds,
  });
}

/// Signs a certificate with the account's own wallet (done once, in advance, by the account holder).
export async function signCertificate(wallet, certificate) {
  return wallet.signTypedData(CERTIFICATE_DOMAIN, CERTIFICATE_TYPES, {
    account: certificate.account,
    successor: certificate.successor,
    chainIds: certificate.chainIds,
  });
}

function explain(iface, e) {
  const data = e?.data ?? e?.info?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    try {
      const err = iface.parseError(data);
      if (err) return `${err.name}(${err.args.join(", ")})`;
    } catch {}
  }
  return e?.shortMessage ?? e?.message ?? String(e);
}

async function receiptOf(provider, hash, timeoutMs = 120_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await provider.send("eth_getTransactionReceipt", [hash]);
    if (r) return { status: Number(BigInt(r.status)), gasUsed: Number(BigInt(r.gasUsed)), blockNumber: Number(BigInt(r.blockNumber)) };
    if (Date.now() - t0 > timeoutMs) throw new Error(`no receipt for ${hash}`);
    await new Promise((res) => setTimeout(res, 100));
  }
}

export function createWatchtower(config, options = {}) {
  const cert = config.certificate;
  const acl = new ethers.Interface(ACL_ABI);
  const token = new ethers.Interface(TOKEN_ABI);
  const chains = config.chains.map((c) => ({ ...c, provider: new ethers.JsonRpcProvider(c.rpc, undefined, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 }) }));
  const expected = new Set((config.expectedGrantees ?? []).map((a) => a.toLowerCase()));
  const log = options.log ?? ((line) => console.log(line));
  const cursors = new Map();

  async function relayOn(c) {
    const chainId = Number((await c.provider.getNetwork()).chainId);
    const read = (fn, args) => c.provider.call({ to: c.acl, data: acl.encodeFunctionData(fn, args) }).then((r) => acl.decodeFunctionResult(fn, r)[0]);
    if (!cert.chainIds.map(Number).includes(chainId)) return { chain: c.name, chainId, skipped: "not listed in the certificate" };
    if (!(await read("supportsInterface", [CERTIFICATE_INTERFACE_ID]))) return { chain: c.name, chainId, skipped: "registry has no E2" };
    if (await read("isAccountRetired", [cert.account])) return { chain: c.name, chainId, skipped: "already retired" };
    const data = acl.encodeFunctionData("retireAccountWithSig", [cert.account, cert.successor, cert.chainIds, cert.signature]);
    try {
      await c.provider.call({ to: c.acl, data, from: config.relayer });
    } catch (e) {
      return { chain: c.name, chainId, refused: explain(acl, e) };
    }
    let hash;
    if (options.signer === "env") {
      const w = new ethers.Wallet(process.env.WATCHTOWER_RELAYER_KEY ?? "", c.provider);
      hash = (await w.sendTransaction({ to: c.acl, data })).hash;
    } else {
      hash = await c.provider.send("eth_sendTransaction", [{ from: config.relayer, to: c.acl, data }]);
    }
    const r = await receiptOf(c.provider, hash);
    return { chain: c.name, chainId, tx: hash, status: r.status, gasUsed: r.gasUsed, block: r.blockNumber, calldataBytes: (data.length - 2) / 2 };
  }

  async function relayAll(reason) {
    const results = [];
    for (const c of chains) results.push(await relayOn(c));
    for (const r of results) log(`relay [${reason}] ${JSON.stringify(r)}`);
    return results;
  }

  /// One polling pass over every chain: returns the signals found since the last pass.
  async function scan() {
    const signals = [];
    const topicAccount = ethers.zeroPadValue(cert.account, 32);
    for (const c of chains) {
      const head = await c.provider.getBlockNumber();
      const from = cursors.has(c.name) ? cursors.get(c.name) + 1 : (c.fromBlock ?? head);
      if (from > head) continue;
      const allowed = await c.provider.getLogs({ address: c.acl, topics: [acl.getEvent("Allowed").topicHash, topicAccount], fromBlock: from, toBlock: head });
      for (const l of allowed) {
        const ev = acl.parseLog(l);
        if (!expected.has(ev.args.account.toLowerCase())) {
          signals.push({ chain: c.name, block: l.blockNumber, kind: "grant by the account", to: ev.args.account, handle: ev.args.handle });
        }
      }
      const delegated = await c.provider.getLogs({ address: c.acl, topics: [acl.getEvent("DelegatedForUserDecryption").topicHash, topicAccount], fromBlock: from, toBlock: head });
      for (const l of delegated) {
        const ev = acl.parseLog(l);
        const wildcard = ev.args.contractAddress.toLowerCase() === WILDCARD.toLowerCase();
        const forever = BigInt(ev.args.newExpirationDate) === UINT64_MAX;
        if (wildcard || forever) {
          signals.push({ chain: c.name, block: l.blockNumber, kind: wildcard ? "wildcard delegation" : "non-expiring delegation", delegate: ev.args.delegate });
        }
      }
      for (const t of c.tokens ?? []) {
        const obs = await c.provider.getLogs({ address: t, topics: [token.getEvent("ERC7984ObserverAccessObserverSet").topicHash], fromBlock: from, toBlock: head });
        for (const l of obs) {
          const ev = token.parseLog(l);
          if (ev.args.account.toLowerCase() === cert.account.toLowerCase()) {
            signals.push({ chain: c.name, block: l.blockNumber, kind: "observer change", token: t, observer: ev.args.newObserver });
          }
        }
      }
      cursors.set(c.name, head);
    }
    return signals;
  }

  /// Polls until a signal appears (or `once`), then relays the certificate everywhere.
  async function watch({ intervalMs = 2000, once = false, maxPasses = Infinity } = {}) {
    for (let pass = 0; pass < maxPasses; pass++) {
      const signals = await scan();
      if (signals.length) {
        for (const s of signals) log(`signal ${JSON.stringify(s)}`);
        return { signals, relays: await relayAll(signals[0].kind) };
      }
      if (once) return { signals, relays: [] };
      await new Promise((res) => setTimeout(res, intervalMs));
    }
    return { signals: [], relays: [] };
  }

  return { relayAll, scan, watch, chains };
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (name, def) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : def;
  };
  if (!["relay", "watch"].includes(mode)) throw new Error("usage: watchtower.mjs relay|watch --config <file>");
  const config = JSON.parse(readFileSync(arg("--config"), "utf8"));
  const wt = createWatchtower(config, { signer: arg("--signer", "impersonate") });
  if (mode === "relay") {
    const r = await wt.relayAll("manual");
    if (r.some((x) => x.status === 0 || x.refused)) process.exitCode = 1;
  } else {
    await wt.watch({ intervalMs: Number(arg("--interval-ms", "2000")), once: rest.includes("--once") });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`watchtower: ${e.message}`);
    process.exitCode = 1;
  });
}
