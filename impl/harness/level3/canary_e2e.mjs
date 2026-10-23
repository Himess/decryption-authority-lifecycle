// Level 3 (governance): the operator canary end to end on a local anvil. ACL v0.10.0 behind Zama's empty-proxy flow,
// from the production artifacts (solc 0.8.24, 800 runs, cancun). A canary account holds a handle, delegates it, and
// retires. The canary script then runs after each upgrade: an honest redeploy the operators did not ratify, the same
// release once ratified, the Core-less liar (passes the guard, stops enforcing retirement), and a backdoored release
// (spares the canary).
// Upgrades are sent by the registry owner directly; the timelock path is covered by ACLGovernance.t.sol.
// anvil runs with --auto-impersonate; its stdout is discarded.
//
// Usage: node canary_e2e.mjs <artifacts dir> <port> <out.json>
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCanary, upgradesSince } from "../../canary/canary.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "..", "fhevm-main", "host-contracts", "package.json"));
const { ethers } = require("ethers");

const [artifactsDir, port, outJson] = process.argv.slice(2);
const RPC = `http://127.0.0.1:${port}`;
const ACL_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const artifact = (rel) => {
  const j = JSON.parse(readFileSync(path.join(artifactsDir, rel), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
};
const A = {
  empty: artifact("EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json"),
  proxy: artifact("HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json"),
  acl: artifact("ACL.sol/ACL.json"),
  liar: artifact("GovernanceMocks.sol/ACLLyingCoreless.json"),
  backdoored: artifact("GovernanceMocks.sol/ACLBackdoored.json"),
};
const aclI = new ethers.Interface(A.acl.abi);
const emptyI = new ethers.Interface(A.empty.abi);
const addr = (label) => ethers.getAddress(ethers.dataSlice(ethers.id(`level3-canary:${label}`), 12));

let provider;
const rpc = (m, p) => provider.send(m, p);
async function receipt(hash) {
  for (let i = 0; i < 400; i++) {
    const r = await rpc("eth_getTransactionReceipt", [hash]);
    if (r) return r;
    await new Promise((res) => setTimeout(res, 25));
  }
  throw new Error("no receipt");
}
async function send(from, to, data, label) {
  await rpc("anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
  const tx = { from, data, gas: ethers.toQuantity(15_000_000n) };
  if (to) tx.to = to;
  const r = await receipt(await rpc("eth_sendTransaction", [tx]));
  if (r.status !== "0x1") throw new Error(`tx failed: ${label}`);
  return r;
}
async function deploy(art, args, types) {
  const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
  return ethers.getAddress((await send(addr("deployer"), null, data, "deploy")).contractAddress);
}

async function main() {
  const anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", port, "--auto-impersonate", "--silent"], { stdio: "ignore" });
  const out = { runs: [] };
  try {
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
        if (res.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    provider = new ethers.JsonRpcProvider(RPC, 31337, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
    out.client = await rpc("web3_clientVersion", []);
    const owner = addr("owner");
    const emptyImpl = await deploy(A.empty);
    const acl = await deploy(A.proxy, [emptyImpl, emptyI.encodeFunctionData("initialize", [owner])], ["address", "bytes"]);
    const impl = await deploy(A.acl);
    await send(owner, acl, aclI.encodeFunctionData("upgradeToAndCall", [impl, aclI.encodeFunctionData("initializeFromEmptyProxy", [])]), "init");

    // The canary: holds a handle, delegates it for a decade, retires.
    const canary = addr("canary");
    const delegate = addr("delegate");
    const app = addr("app");
    const attacker = addr("attacker");
    const handle = ethers.id("level3-canary-handle");
    for (const holder of [canary, app]) {
      const inner = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [handle, ACL_LOCATION])));
      await rpc("anvil_setStorageAt", [acl, ethers.keccak256(coder.encode(["address", "uint256"], [holder, inner])), ethers.toBeHex(1n, 32)]);
    }
    const latest = await provider.getBlock("latest");
    await send(canary, acl, aclI.encodeFunctionData("delegateForUserDecryption", [delegate, app, BigInt(latest.timestamp) + 3650n * 86400n]), "delegate");
    await send(canary, acl, aclI.encodeFunctionData("retireAccount", []), "retire");

    const codeHash = async (a) => ethers.keccak256(await rpc("eth_getCode", [a, "latest"]));
    const cfg = { rpc: RPC, acl, canary, handle, app, delegate, pinned: [{ address: impl, codeHash: await codeHash(impl) }] };
    const ratify = async (a) => cfg.pinned.push({ address: a, codeHash: await codeHash(a) });
    let next = Number(await provider.getBlockNumber()) + 1;
    const step = async (label, implementation) => {
      if (implementation) await send(owner, acl, aclI.encodeFunctionData("upgradeToAndCall", [implementation, "0x"]), label);
      const u = await upgradesSince(provider, cfg, next);
      next = u.next;
      const r = await runCanary(provider, cfg);
      const backdoorReads = BigInt(await rpc("eth_call", [{ to: acl, data: aclI.encodeFunctionData("persistAllowed", [handle, attacker]) }, "latest"])) === 1n;
      out.runs.push({ step: label, upgradesSeen: u.upgrades.length, ...r, backdoorReads });
    };

    await step("baseline (no upgrade)");
    const honest = await deploy(A.acl);
    out.sameSourceDifferentCodeHash = (await codeHash(honest)) !== (await codeHash(impl));
    await step("honest redeploy, not ratified", honest);
    await ratify(honest);
    await step("the same release, ratified");
    await step("Core-less liar", await deploy(A.liar));
    await step("the ratified release again", honest);
    await step("backdoored release", await deploy(A.backdoored, [attacker], ["address"]));
  } finally {
    anvil.kill();
  }
  writeFileSync(outJson, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out.runs.map(({ step, ok, halt, rpcCalls, viewCalls, upgradesSeen, backdoorReads }) => ({ step, ok, halt, rpcCalls, viewCalls, upgradesSeen, backdoorReads })), null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
