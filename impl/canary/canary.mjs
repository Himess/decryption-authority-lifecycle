#!/usr/bin/env node
// Operator canary (Decryption Authority Lifecycle, Level 3, governance profile). Run on every `Upgraded` event of
// the registry proxy and periodically. It checks a known retired account (the canary) and a handle it held:
//   1. isAccountRetired(canary) is true;
//   2. isAllowed(handle, canary) is false;
//   3. persistAllowed(handle, canary) is false;
//   4. the delegated view is false for a delegation the canary made before retiring;
// then pinning: the implementation behind the proxy must be one the operators ratified, by address and runtime code
// hash. Any failure means the operator halts user decryption for this chain. The canary catches an upgrade that stops enforcing retirement;
// pinning catches one that spares the canary (TARGET_ARCHITECTURE §4.4 (d)). The restriction is effective at n-t
// operators.
//
// Pinning is by deployed implementation, not by bytecode alone: a UUPS implementation embeds its own address (the
// `__self` immutable), so every deployment of the same source has a different runtime code hash. Operators ratify
// the announced implementation (address and code hash) during the timelock delay, before the upgrade executes.
//
// Usage: node canary.mjs --config <canary.json> [--watch] [--interval-ms 5000]
// canary.json: { "rpc", "acl", "canary", "handle", "app", "delegate",
//                "pinned": [{ "address": "0x<implementation>", "codeHash": "0x<runtime code hash>" }, ...] }
// Library: ethers v6, resolved from CANARY_ETHERS_FROM (a package.json path) or from the Zama clone next to it.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  process.env.CANARY_ETHERS_FROM || path.join(here, "..", "fhevm-main", "host-contracts", "package.json"),
);
const { ethers } = require("ethers");

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ACL_ABI = [
  "function isAccountRetired(address account) view returns (bool)",
  "function isAllowed(bytes32 handle, address account) view returns (bool)",
  "function persistAllowed(bytes32 handle, address account) view returns (bool)",
  "function isHandleDelegatedForUserDecryption(address delegator, address delegate, address contractAddress, bytes32 handle) view returns (bool)",
  "event Upgraded(address indexed implementation)",
];

/// One canary run. `provider.send` is counted, so the result reports the RPC cost.
export async function runCanary(provider, cfg) {
  const iface = new ethers.Interface(ACL_ABI);
  let rpcCalls = 0;
  const send = (m, p) => {
    rpcCalls++;
    return provider.send(m, p);
  };
  const view = async (fn, args) => {
    try {
      return { value: iface.decodeFunctionResult(fn, await send("eth_call", [{ to: cfg.acl, data: iface.encodeFunctionData(fn, args) }, "latest"]))[0] };
    } catch (e) {
      return { error: (e?.shortMessage ?? e?.message ?? String(e)).slice(0, 120) };
    }
  };
  const halt = [];
  const expect = (name, r, want) => {
    if (r.error !== undefined) halt.push(`${name} reverts`);
    else if (r.value !== want) halt.push(`${name} is ${r.value}`);
  };
  expect("isAccountRetired(canary)", await view("isAccountRetired", [cfg.canary]), true);
  expect("isAllowed(handle, canary)", await view("isAllowed", [cfg.handle, cfg.canary]), false);
  expect("persistAllowed(handle, canary)", await view("persistAllowed", [cfg.handle, cfg.canary]), false);
  expect("delegated view from the canary", await view("isHandleDelegatedForUserDecryption", [cfg.canary, cfg.delegate, cfg.app, cfg.handle]), false);
  const viewCalls = rpcCalls;

  const implementation = ethers.getAddress(ethers.dataSlice(await send("eth_getStorageAt", [cfg.acl, IMPLEMENTATION_SLOT, "latest"]), 12));
  const codeHash = ethers.keccak256(await send("eth_getCode", [implementation, "latest"]));
  const ratified = cfg.pinned.find((p) => p.address.toLowerCase() === implementation.toLowerCase());
  if (!ratified) halt.push("the implementation is not pinned");
  else if (ratified.codeHash.toLowerCase() !== codeHash.toLowerCase()) halt.push("the pinned implementation's code changed");
  return { ok: halt.length === 0, halt, implementation, codeHash, rpcCalls, viewCalls };
}

/// New `Upgraded` events since `fromBlock` (inclusive); returns them and the next block to scan.
export async function upgradesSince(provider, cfg, fromBlock) {
  const iface = new ethers.Interface(ACL_ABI);
  const head = await provider.getBlockNumber();
  if (fromBlock > head) return { upgrades: [], next: fromBlock };
  const logs = await provider.getLogs({ address: cfg.acl, topics: [iface.getEvent("Upgraded").topicHash], fromBlock, toBlock: head });
  return { upgrades: logs.map((l) => ({ block: l.blockNumber, implementation: ethers.getAddress(ethers.dataSlice(l.topics[1], 12)) })), next: head + 1 };
}

async function main() {
  const args = process.argv.slice(2);
  const cfg = JSON.parse(readFileSync(args[args.indexOf("--config") + 1], "utf8"));
  const provider = new ethers.JsonRpcProvider(cfg.rpc, undefined, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
  const report = (why, r) => console.log(`${new Date().toISOString()} ${why}: ${r.ok ? "OK" : `HALT (${r.halt.join("; ")})`} impl=${r.implementation} rpc=${r.rpcCalls}`);
  let r = await runCanary(provider, cfg);
  report("start", r);
  if (!args.includes("--watch")) {
    process.exitCode = r.ok ? 0 : 3;
    return;
  }
  const i = args.indexOf("--interval-ms");
  const interval = i >= 0 ? Number(args[i + 1]) : 5000;
  let next = (await provider.getBlockNumber()) + 1;
  for (;;) {
    await new Promise((res) => setTimeout(res, interval));
    const u = await upgradesSince(provider, cfg, next);
    next = u.next;
    r = await runCanary(provider, cfg);
    report(u.upgrades.length ? `upgrade to ${u.upgrades.at(-1).implementation}` : "periodic", r);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`canary: ${e.message}`);
    process.exitCode = 1;
  });
}
