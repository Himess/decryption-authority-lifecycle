// Level 0 transaction-level gas on anvil (receipt gasUsed), per hardfork.
// Deploys ACL v0.7.0 (baseline fixture) and ACL v0.8.0 (Level 0) behind Zama's empty-proxy flow, from Foundry
// artifacts built with Zama's production compile settings (solc 0.8.24, optimizer 800 runs, cancun target).
// anvil runs with --auto-impersonate, so every transaction is sent from an impersonated address: no private key
// is used or printed. anvil's stdout (which lists its default dev keys) is discarded.
//
// Usage: node anvil_gas.mjs <host-contracts dir> <artifacts dir> <hardfork> <port> <out.json>
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [hostDir, artifactsDir, hardfork, port, outJson] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(hostDir), "package.json"));
const { ethers } = require("ethers");

const RPC = `http://127.0.0.1:${port}`;
const ACL_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const TX_GAS = 1_000_000_000n;
const coder = ethers.AbiCoder.defaultAbiCoder();

function artifact(rel) {
  const j = JSON.parse(readFileSync(path.join(artifactsDir, rel), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
}

const A = {
  empty: artifact("EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json"),
  proxy: artifact("HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json"),
  acl080: artifact("ACL.sol/ACL.json"),
  acl070: artifact("ACL_v0_7_0.sol/ACL.json"),
};
const aclIface = new ethers.Interface(A.acl080.abi);
const emptyIface = new ethers.Interface(A.empty.abi);

let provider;
async function rpc(method, params) {
  return provider.send(method, params);
}

async function waitForNode() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) {
        provider = new ethers.JsonRpcProvider(RPC, 31337, { staticNetwork: true });
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("anvil did not start");
}

function addr(label) {
  return ethers.getAddress(ethers.dataSlice(ethers.id(`level0-gas:${label}`), 12));
}

async function fund(a) {
  await rpc("anvil_setBalance", [a, ethers.toQuantity(10n ** 24n)]);
}

async function send(from, to, data, label) {
  await fund(from);
  const tx = { from, data, gas: ethers.toQuantity(TX_GAS) };
  if (to) tx.to = to;
  const hash = await rpc("eth_sendTransaction", [tx]);
  let r = null;
  for (let i = 0; i < 200 && !r; i++) {
    r = await rpc("eth_getTransactionReceipt", [hash]);
    if (!r) await new Promise((res) => setTimeout(res, 50));
  }
  if (!r || r.status !== "0x1") throw new Error(`tx failed: ${label}: ${JSON.stringify(r)?.slice(0, 300)}`);
  return { gasUsed: Number(BigInt(r.gasUsed)), contractAddress: r.contractAddress, calldataBytes: (data.length - 2) / 2 };
}

async function deploy(art, args, types) {
  const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
  const r = await send(addr("deployer"), null, data, "deploy");
  return r.contractAddress;
}

async function deployACL(implArtifact, owner) {
  const emptyImpl = await deploy(A.empty);
  const init = emptyIface.encodeFunctionData("initialize", [owner]);
  const proxy = await deploy(A.proxy, [emptyImpl, init], ["address", "bytes"]);
  const impl = await deploy(implArtifact);
  const call = aclIface.encodeFunctionData("upgradeToAndCall", [
    impl,
    aclIface.encodeFunctionData("initializeFromEmptyProxy", []),
  ]);
  await send(owner, proxy, call, "upgradeToAndCall");
  return proxy;
}

function handle(seed) {
  let h = BigInt(ethers.id(`level0-gas-handle:${seed}`)) & ~((1n << 88n) - 1n);
  h |= 0xffn << 80n;
  h |= 31337n << 16n;
  h |= 5n << 8n; // FheType.Uint64
  return ethers.toBeHex(h, 32);
}

async function persist(proxy, h, account) {
  const inner = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [h, ACL_LOCATION])));
  const slot = ethers.keccak256(coder.encode(["address", "uint256"], [account, inner]));
  await rpc("anvil_setStorageAt", [proxy, slot, ethers.toBeHex(1n, 32)]);
}

async function measureVariant(name, implArtifact, level0) {
  const owner = addr(`owner-${name}`);
  const proxy = await deployACL(implArtifact, owner);
  const out = {};
  // allow: new pair, then the same pair again (no new state)
  const old = addr(`old-${name}`);
  const h = handle(`${name}-single`);
  await persist(proxy, h, old);
  const allowData = aclIface.encodeFunctionData("allow", [h, addr(`new-${name}`)]);
  out.allow_new_pair = await send(old, proxy, allowData, "allow");
  out.allow_existing_pair = await send(old, proxy, allowData, "allow again");
  if (level0) {
    out.retireAccount = await send(addr(`retiree-${name}`), proxy, aclIface.encodeFunctionData("retireAccount", []), "retire");
  }
  for (const n of [1, 10, 100, 500]) {
    const o = addr(`carry-old-${name}-${n}`);
    const nw = addr(`carry-new-${name}-${n}`);
    const calls = [];
    for (let i = 0; i < n; i++) {
      const hi = handle(`${name}-carry-${n}-${i}`);
      await persist(proxy, hi, o);
      calls.push(aclIface.encodeFunctionData("allow", [hi, nw]));
    }
    if (level0) calls.push(aclIface.encodeFunctionData("retireAccount", []));
    const data = aclIface.encodeFunctionData("multicall", [calls]);
    out[`carry_n${n}`] = await send(o, proxy, data, `carry ${n}`);
  }
  return out;
}

async function calibration() {
  const out = {};
  const a = addr("calib-a");
  const b = addr("calib-b");
  out.eth_transfer_no_data = await send(a, b, "0x", "transfer");
  out.calldata_1000_zero_bytes = await send(a, b, "0x" + "00".repeat(1000), "zero calldata");
  out.calldata_1000_nonzero_bytes = await send(a, b, "0x" + "ff".repeat(1000), "nonzero calldata");
  // Minimal contract: SSTORE(calldataload(0), 1); STOP.
  const store = await deploy({ bytecode: "0x600780600b6000396000f3" + "60016000355500" });
  const slot = ethers.id("calibration-slot");
  out.sstore_new_slot = await send(a, store, slot, "sstore new");
  out.sstore_same_value_again = await send(a, store, slot, "sstore again");
  return out;
}

const anvil = spawn(
  "anvil",
  ["--hardfork", hardfork, "--port", String(port), "--auto-impersonate", "--gas-limit", "2000000000", "--chain-id", "31337", "--quiet"],
  { stdio: ["ignore", "ignore", "ignore"] },
);
try {
  await waitForNode();
  const node = await rpc("anvil_nodeInfo", []);
  const result = {
    hardfork,
    anvilNodeInfo: { hardFork: node.hardFork, chainId: node.environment?.chainId, gasLimit: node.environment?.gasLimit },
    calibration: await calibration(),
    v0_7_0: await measureVariant("v070", A.acl070, false),
    v0_8_0: await measureVariant("v080", A.acl080, true),
  };
  writeFileSync(outJson, JSON.stringify(result, null, 2));
  console.log(`${hardfork}: written ${outJson}`);
} finally {
  anvil.kill();
}
