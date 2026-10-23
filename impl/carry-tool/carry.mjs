#!/usr/bin/env node
// Carry tool (Decryption Authority Lifecycle, Level 2 (c)). Before an account OLD retires, it re-grants to a new
// account NEW the handles OLD can still use, then retires OLD. The grants and the retirement go out as caller-preserving
// `multicall` transactions on the registry (the ACL); the last one ends with `retireAccount()`, so OLD retires only if
// every grant before it went through.
//
//   1. enumerate `Allowed(caller, account = OLD, handle)` events on the registry (`account` is indexed);
//   2. keep the handles for which `persistAllowed(h, OLD)` holds. Against spam, keep only handles granted by
//      `--allow-contract` callers; for `--balance-token` callers keep only OLD's current balance handle;
//   3. `--dry-run` prints a per-caller breakdown and the exact list, and sends nothing;
//   4. send `multicall([allow(h_1, NEW), ..., allow(h_k, NEW)])` in chunks; the last chunk ends with `retireAccount()`;
//   5. verify that OLD is retired and that NEW holds `persistAllowed` on every carried handle.
//
// Usage: node carry.mjs --rpc <url> --acl <registry> --old <address> --new <address> [options]
//   --from-block <n>         first block to scan (default 0)
//   --log-range <n>          blocks per eth_getLogs request (default 10000)
//   --allow-contract <addr>  keep only handles granted by these callers (repeatable)
//   --balance-token <addr>   an ERC-7984 token: keep only OLD's current balance handle among its grants (repeatable;
//                            also allowlists the token)
//   --chunk <n>              handles per transaction (default 400)
//   --no-retire              carry only; do not retire OLD
//   --dry-run                print the plan and send nothing
//   --signer <mode>          `impersonate` (default): eth_sendTransaction from OLD, for a local anvil started with
//                            --auto-impersonate; `env`: sign with the key in CARRY_OLD_PRIVATE_KEY (never printed)
//   --json <file>            write the plan and the result as JSON
//
// Library: ethers v6, resolved from CARRY_ETHERS_FROM (a package.json path) or from the Zama clone next to this tool.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  process.env.CARRY_ETHERS_FROM || path.join(here, "..", "fhevm-main", "host-contracts", "package.json"),
);
const { ethers } = require("ethers");

const CORE_INTERFACE_ID = "0x556d2088";
const TX_GAS_CAP = 16_777_216n; // EIP-7825 (Osaka): 2^24 per transaction

const ACL_ABI = [
  "event Allowed(address indexed caller, address indexed account, bytes32 handle)",
  "function allow(bytes32 handle, address account)",
  "function retireAccount()",
  "function multicall(bytes[] data) returns (bytes[] results)",
  "function persistAllowed(bytes32 handle, address account) view returns (bool)",
  "function isAccountRetired(address account) view returns (bool)",
  "function isAccountDenied(address account) view returns (bool)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "error SenderDenied(address sender)",
  "error SenderNotAllowed(address sender)",
  "error SenderRetired(address sender)",
  "error AccountAlreadyRetired(address account)",
  "error EnforcedPause()",
];
const TOKEN_ABI = ["function confidentialBalanceOf(address account) view returns (bytes32)"];

function parseArgs(argv) {
  const o = { allowContract: [], balanceToken: [], fromBlock: 0, logRange: 10_000, chunk: 400, signer: "impersonate" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--rpc") o.rpc = next();
    else if (a === "--acl") o.acl = ethers.getAddress(next());
    else if (a === "--old") o.old = ethers.getAddress(next());
    else if (a === "--new") o.new = ethers.getAddress(next());
    else if (a === "--from-block") o.fromBlock = Number(next());
    else if (a === "--log-range") o.logRange = Number(next());
    else if (a === "--allow-contract") o.allowContract.push(ethers.getAddress(next()));
    else if (a === "--balance-token") o.balanceToken.push(ethers.getAddress(next()));
    else if (a === "--chunk") o.chunk = Number(next());
    else if (a === "--no-retire") o.noRetire = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--signer") o.signer = next();
    else if (a === "--json") o.json = next();
    else throw new Error(`unknown argument ${a}`);
  }
  for (const k of ["rpc", "acl", "old", "new"]) if (!o[k]) throw new Error(`--${k} is required`);
  if (!(o.chunk > 0)) throw new Error("--chunk must be positive");
  if (!["impersonate", "env"].includes(o.signer)) throw new Error("--signer is impersonate or env");
  return o;
}

/// Runs `fn` over `items` with at most `n` calls in flight; keeps the order.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function plan(o, provider) {
  for (const k of ["acl", "old", "new"]) o[k] = ethers.getAddress(o[k]);
  o.allowContract = o.allowContract.map((a) => ethers.getAddress(a));
  o.balanceToken = o.balanceToken.map((a) => ethers.getAddress(a));
  const acl = new ethers.Contract(o.acl, ACL_ABI, provider);
  const checks = {
    core: await acl.supportsInterface(CORE_INTERFACE_ID),
    oldRetired: await acl.isAccountRetired(o.old),
    newRetired: await acl.isAccountRetired(o.new),
    oldDenied: await acl.isAccountDenied(o.old),
  };
  const refuse = [];
  if (!checks.core) refuse.push("the registry does not declare the lifecycle Core (ERC-165 0x556d2088)");
  if (checks.oldRetired) refuse.push("OLD is already retired: it can no longer grant anything");
  if (checks.newRetired) refuse.push("NEW is retired: grants to it would be inert");
  if (checks.oldDenied) refuse.push("OLD is on the deny list: its grants would revert");
  if (o.new === o.old) refuse.push("NEW equals OLD");
  if (o.new === ethers.ZeroAddress) refuse.push("NEW is the zero address");

  // 1. Enumerate the grants to OLD.
  const head = await provider.getBlockNumber();
  const topic0 = acl.interface.getEvent("Allowed").topicHash;
  const topicOld = ethers.zeroPadValue(o.old, 32);
  const grants = [];
  let logRequests = 0;
  for (let from = o.fromBlock; from <= head; from += o.logRange) {
    const to = Math.min(head, from + o.logRange - 1);
    const logs = await provider.getLogs({ address: o.acl, topics: [topic0, null, topicOld], fromBlock: from, toBlock: to });
    logRequests++;
    for (const log of logs) {
      const ev = acl.interface.parseLog(log);
      grants.push({ caller: ethers.getAddress(ev.args.caller), handle: ev.args.handle, block: log.blockNumber });
    }
  }

  // 2. Classify each distinct handle.
  const callersOf = new Map();
  for (const g of grants) {
    if (!callersOf.has(g.handle)) callersOf.set(g.handle, new Set());
    callersOf.get(g.handle).add(g.caller);
  }
  const handles = [...callersOf.keys()];
  const allowlist = new Set([...o.allowContract, ...o.balanceToken]);
  const tokens = new Set(o.balanceToken);
  const current = new Map();
  for (const t of tokens) {
    current.set(t, await new ethers.Contract(t, TOKEN_ABI, provider).confidentialBalanceOf(o.old));
  }
  const usable = await pool(handles, 16, (h) => acl.persistAllowed(h, o.old));
  const atNew = await pool(handles, 16, (h) => acl.persistAllowed(h, o.new));
  const items = handles.map((h, i) => {
    const callers = [...callersOf.get(h)];
    let reason = null;
    if (!usable[i]) reason = "OLD no longer holds it";
    else if (allowlist.size && !callers.some((c) => allowlist.has(c))) reason = "caller not allowlisted";
    else if (allowlist.size && callers.every((c) => !allowlist.has(c) || (tokens.has(c) && current.get(c) !== h)))
      reason = "stale balance handle";
    else if (atNew[i]) reason = "NEW already holds it";
    return { handle: h, callers, keep: reason === null, reason };
  });
  const kept = items.filter((x) => x.keep).map((x) => x.handle);

  // Per-caller breakdown (a handle granted by several callers counts under each).
  const byCaller = {};
  for (const g of grants) {
    byCaller[g.caller] ??= { grants: 0, handles: new Set(), kept: new Set(), skipped: {} };
    byCaller[g.caller].grants++;
    byCaller[g.caller].handles.add(g.handle);
  }
  for (const x of items) {
    for (const c of x.callers) {
      if (x.keep) byCaller[c].kept.add(x.handle);
      else byCaller[c].skipped[x.reason] = (byCaller[c].skipped[x.reason] ?? 0) + 1;
    }
  }
  const breakdown = Object.entries(byCaller).map(([caller, v]) => ({
    caller,
    allowlisted: allowlist.size ? allowlist.has(caller) : null,
    balanceToken: tokens.has(caller),
    grants: v.grants,
    handles: v.handles.size,
    kept: v.kept.size,
    skipped: v.skipped,
  }));

  const chunks = [];
  for (let i = 0; i < kept.length; i += o.chunk) chunks.push(kept.slice(i, i + o.chunk));
  if (!o.noRetire && chunks.length === 0) chunks.push([]);
  return { checks, refuse, head, logRequests, grants: grants.length, handles: handles.length, breakdown, kept, chunks };
}

/// Polls the receipt with raw RPC calls. (`waitForTransaction` waits for a block event; on a node that mines only on
/// demand, with a cached block number, that event may never come.)
async function receiptOf(provider, hash, timeoutMs = 600_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await provider.send("eth_getTransactionReceipt", [hash]);
    if (r) return { status: Number(BigInt(r.status)), gasUsed: BigInt(r.gasUsed) };
    if (Date.now() - t0 > timeoutMs) throw new Error(`no receipt for ${hash} after ${timeoutMs / 1000} s`);
    await new Promise((res) => setTimeout(res, 250));
  }
}

/// Names the registry's custom error when the node returned revert data.
function explain(acl, e) {
  const data = e?.data ?? e?.info?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    try {
      const err = acl.interface.parseError(data);
      if (err) return `${err.name}(${err.args.join(", ")})`;
    } catch {}
  }
  return e?.shortMessage ?? e?.message ?? String(e);
}

function chunkCalldata(acl, o, chunk, last) {
  const calls = chunk.map((h) => acl.interface.encodeFunctionData("allow", [h, o.new]));
  if (last && !o.noRetire) calls.push(acl.interface.encodeFunctionData("retireAccount", []));
  return acl.interface.encodeFunctionData("multicall", [calls]);
}

/// `hooks.beforeChunk(i)` runs before chunk `i` is estimated and sent (progress reporting; the harness uses it to
/// inject a failure). Any failure stops the run before the next chunk, so OLD retires only if every chunk went through.
/// A rerun resumes: the handles NEW already holds are skipped.
export async function execute(o, provider, p, hooks = {}) {
  const acl = new ethers.Contract(o.acl, ACL_ABI, provider);
  const wallet = o.signer === "env" ? new ethers.Wallet(process.env.CARRY_OLD_PRIVATE_KEY ?? "", provider) : null;
  if (wallet && wallet.address !== o.old) throw new Error("CARRY_OLD_PRIVATE_KEY does not belong to OLD");
  const sent = [];
  for (let i = 0; i < p.chunks.length; i++) {
    const last = i === p.chunks.length - 1;
    const data = chunkCalldata(acl, o, p.chunks[i], last);
    try {
      await hooks.beforeChunk?.(i);
      const estimate = BigInt(await provider.send("eth_estimateGas", [{ from: o.old, to: o.acl, data }]));
      if (estimate > TX_GAS_CAP) throw new Error(`it needs ${estimate} gas, above the 2^24 cap: lower --chunk`);
      const gas = (estimate * 12n) / 10n > TX_GAS_CAP ? TX_GAS_CAP : (estimate * 12n) / 10n;
      let hash;
      if (wallet) hash = (await wallet.sendTransaction({ to: o.acl, data, gasLimit: gas })).hash;
      else hash = await provider.send("eth_sendTransaction", [{ from: o.old, to: o.acl, data, gas: ethers.toQuantity(gas) }]);
      const receipt = await receiptOf(provider, hash);
      sent.push({ chunk: i, handles: p.chunks[i].length, retires: last && !o.noRetire, tx: hash, status: receipt.status, gasUsed: Number(receipt.gasUsed), calldataBytes: (data.length - 2) / 2 });
      if (receipt.status !== 1) throw new Error("the transaction reverted");
    } catch (e) {
      return { sent, stopped: `chunk ${i} failed (${explain(acl, e)}); OLD is not retired by this run`, verified: null };
    }
  }

  // 5. Verify.
  const carried = p.chunks.flat();
  const atNew = await pool(carried, 16, (h) => acl.persistAllowed(h, o.new));
  const atOld = await pool(carried, 16, (h) => acl.persistAllowed(h, o.old));
  const verified = {
    oldRetired: await acl.isAccountRetired(o.old),
    carried: carried.length,
    newHoldsAll: atNew.every(Boolean),
    newMissing: carried.filter((_, i) => !atNew[i]),
    oldStillUsable: carried.filter((_, i) => atOld[i]).length,
  };
  verified.ok = verified.newHoldsAll && (o.noRetire || (verified.oldRetired && verified.oldStillUsable === 0));
  return { sent, stopped: null, verified };
}

function printPlan(o, p) {
  console.log(`carry plan: OLD ${o.old} -> NEW ${o.new} on registry ${o.acl} (blocks ${o.fromBlock}..${p.head}, ${p.logRequests} log requests)`);
  console.log(`  ${p.grants} grants to OLD, ${p.handles} distinct handles, ${p.kept.length} to carry in ${p.chunks.length} transaction(s)${o.noRetire ? "" : ", the last one retiring OLD"}`);
  console.log("  caller                                       allowlisted  grants  handles  kept  skipped");
  for (const b of p.breakdown) {
    const al = b.allowlisted === null ? "(no list)" : b.balanceToken ? "token" : b.allowlisted ? "yes" : "no";
    const sk = Object.entries(b.skipped).map(([k, v]) => `${v} ${k}`).join("; ") || "-";
    console.log(`  ${b.caller}  ${al.padEnd(11)}  ${String(b.grants).padStart(6)}  ${String(b.handles).padStart(7)}  ${String(b.kept).padStart(4)}  ${sk}`);
  }
  console.log("  handles to carry:");
  for (const h of p.kept) console.log(`    ${h}`);
  for (const r of p.refuse) console.log(`  REFUSED: ${r}`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const provider = new ethers.JsonRpcProvider(o.rpc, undefined, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
  const p = await plan(o, provider);
  printPlan(o, p);
  let result = null;
  if (p.refuse.length) process.exitCode = 2;
  else if (!o.dryRun) {
    result = await execute(o, provider, p);
    for (const s of result.sent) console.log(`  tx ${s.chunk}: ${s.handles} handles${s.retires ? " + retireAccount()" : ""}, status ${s.status}, gasUsed ${s.gasUsed}, calldata ${s.calldataBytes} B`);
    if (result.stopped) {
      console.log(`  STOPPED: ${result.stopped}`);
      process.exitCode = 1;
    } else {
      const v = result.verified;
      console.log(`  verified: OLD retired ${v.oldRetired}; NEW holds ${v.carried - v.newMissing.length}/${v.carried}; OLD still usable on ${v.oldStillUsable}; ${v.ok ? "OK" : "FAILED"}`);
      if (!v.ok) process.exitCode = 1;
    }
  }
  if (o.json) {
    writeFileSync(o.json, JSON.stringify({ options: { ...o }, plan: p, result }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`carry: ${e.message}`);
    process.exitCode = 1;
  });
}
