// Level 2 (E1 Successor) transaction-level gas on anvil (receipt gasUsed): every step is its own transaction, so
// storage "original values" and cold access are those of a real transaction (an in-test Foundry measurement is not:
// slots written earlier in the same test transaction are re-priced as dirty).
// Deploys ACL v0.8.0 (Level 0, fixture) and ACL v0.9.0 (Level 2) behind Zama's empty-proxy flow, from Foundry
// artifacts built with Zama's production compile settings (solc 0.8.24, optimizer 800 runs, cancun target).
// anvil runs with --auto-impersonate: no private key is used or printed; anvil's stdout is discarded.
//
// Usage: node anvil_gas_e1.mjs <host-contracts dir> <artifacts dir> <hardfork> <port> <out.json>
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [hostDir, artifactsDir, hardfork, port, outJson] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(hostDir), "package.json"));
const { ethers } = require("ethers");

const RPC = `http://127.0.0.1:${port}`;
const ACL_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const TX_GAS = 30_000_000n;
const DAY = 86_400;
const coder = ethers.AbiCoder.defaultAbiCoder();

function artifact(rel) {
  const j = JSON.parse(readFileSync(path.join(artifactsDir, rel), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
}

const A = {
  empty: artifact("EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json"),
  proxy: artifact("HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json"),
  acl090: artifact("ACL.sol/ACL.json"),
  acl080: artifact("ACL_v0_8_0.sol/ACL.json"),
};
const acl = new ethers.Interface(A.acl090.abi);
const emptyIface = new ethers.Interface(A.empty.abi);

let provider;
const rpc = (method, params) => provider.send(method, params);

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

const addr = (label) => ethers.getAddress(ethers.dataSlice(ethers.id(`level2-gas:${label}`), 12));

async function send(from, to, data, label) {
  await rpc("anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
  const tx = { from, data, gas: ethers.toQuantity(TX_GAS) };
  if (to) tx.to = to;
  const hash = await rpc("eth_sendTransaction", [tx]);
  let r = null;
  for (let i = 0; i < 200 && !r; i++) {
    r = await rpc("eth_getTransactionReceipt", [hash]);
    if (!r) await new Promise((res) => setTimeout(res, 50));
  }
  if (!r || r.status !== "0x1") throw new Error(`tx failed: ${label}: ${JSON.stringify(r)?.slice(0, 300)}`);
  return Number(BigInt(r.gasUsed));
}

async function deploy(art, args, types) {
  const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
  const from = addr("deployer");
  await rpc("anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
  const hash = await rpc("eth_sendTransaction", [{ from, data, gas: ethers.toQuantity(TX_GAS) }]);
  let r = null;
  for (let i = 0; i < 200 && !r; i++) {
    r = await rpc("eth_getTransactionReceipt", [hash]);
    if (!r) await new Promise((res) => setTimeout(res, 50));
  }
  if (!r || r.status !== "0x1") throw new Error("deploy failed");
  return r.contractAddress;
}

async function deployACL(implArtifact, owner) {
  const emptyImpl = await deploy(A.empty);
  const init = emptyIface.encodeFunctionData("initialize", [owner]);
  const proxy = await deploy(A.proxy, [emptyImpl, init], ["address", "bytes"]);
  const impl = await deploy(implArtifact);
  const call = acl.encodeFunctionData("upgradeToAndCall", [impl, acl.encodeFunctionData("initializeFromEmptyProxy", [])]);
  await send(owner, proxy, call, "upgradeToAndCall");
  return proxy;
}

function handle(seed) {
  let h = BigInt(ethers.id(`level2-gas-handle:${seed}`)) & ~((1n << 88n) - 1n);
  h |= 0xffn << 80n;
  h |= 31337n << 16n;
  h |= 5n << 8n;
  return ethers.toBeHex(h, 32);
}

async function persist(proxy, h, account) {
  const inner = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [h, ACL_LOCATION])));
  const slot = ethers.keccak256(coder.encode(["address", "uint256"], [account, inner]));
  await rpc("anvil_setStorageAt", [proxy, slot, ethers.toBeHex(1n, 32)]);
}

async function increaseTime(seconds) {
  await rpc("evm_increaseTime", [seconds]);
  await rpc("evm_mine", []);
}

/// Gas of an eth_call-style view, as eth_estimateGas of a transaction calling it (includes 21,000 + calldata).
async function viewGas(proxy, data) {
  return Number(BigInt(await rpc("eth_estimateGas", [{ from: addr("viewer"), to: proxy, data }])));
}

async function viewBool(proxy, data) {
  return BigInt(await rpc("eth_call", [{ to: proxy, data }, "latest"])) === 1n;
}

const fn = (name, args = []) => acl.encodeFunctionData(name, args);

async function measure() {
  const out = { v0_8_0: {}, v0_9_0: {} };

  // ---------------------------------------------------------------- v0.8.0 (Level 0) reference
  {
    const owner = addr("owner-080");
    const proxy = await deployACL(A.acl080, owner);
    out.v0_8_0.retireAccount = await send(addr("retiree-080"), proxy, fn("retireAccount"), "retire 080");
    const d = addr("delegator-080");
    const dg = addr("delegate-080");
    const c = addr("contract-080");
    const h = handle("080");
    await persist(proxy, h, d);
    await persist(proxy, h, c);
    await send(d, proxy, fn("delegateForUserDecryption", [dg, c, Math.floor(Date.now() / 1000) + 365 * DAY]), "delegate 080");
    out.v0_8_0.view_isHandleDelegated_active = await viewGas(proxy, fn("isHandleDelegatedForUserDecryption", [d, dg, c, h]));
    out.v0_8_0.view_isAllowed_active = await viewGas(proxy, fn("isAllowed", [h, d]));
  }

  // ---------------------------------------------------------------- v0.9.0 (Level 2)
  const owner = addr("owner-090");
  const proxy = await deployACL(A.acl090, owner);
  const o = out.v0_9_0;

  o.retireAccount_noSuccessionRecord = await send(addr("retiree-090"), proxy, fn("retireAccount"), "retire 090");

  const account = addr("account");
  const successor = addr("successor");
  const contract = addr("contract");
  const h = handle("090");
  await persist(proxy, h, account);
  await persist(proxy, h, contract);
  const dg = addr("delegate-090");
  await send(account, proxy, fn("delegateForUserDecryption", [dg, contract, Math.floor(Date.now() / 1000) + 365 * DAY]), "delegate 090");
  o.view_isHandleDelegated_active = await viewGas(proxy, fn("isHandleDelegatedForUserDecryption", [account, dg, contract, h]));
  o.view_isAllowed_active = await viewGas(proxy, fn("isAllowed", [h, account]));

  o.designateSuccessor = await send(account, proxy, fn("designateSuccessor", [successor]), "designate");
  o.acceptSuccession = await send(successor, proxy, fn("acceptSuccession", [account]), "accept");
  await increaseTime(7 * DAY);
  o.confirmSuccessor = await send(account, proxy, fn("confirmSuccessor"), "confirm");
  o.view_isHandleDelegated_active_withConfirmedSuccessor = await viewGas(
    proxy,
    fn("isHandleDelegatedForUserDecryption", [account, dg, contract, h]),
  );
  o.retireAccount_withConfirmedSuccessor = await send(account, proxy, fn("retireAccount"), "retire with successor");
  if (!(await viewBool(proxy, fn("isHandleDelegatedForUserDecryption", [account, successor, contract, h])))) {
    throw new Error("successor path not readable");
  }
  o.view_isHandleDelegated_successorPath = await viewGas(
    proxy,
    fn("isHandleDelegatedForUserDecryption", [account, successor, contract, h]),
  );
  o.view_isHandleDelegated_retiredDelegator_otherDelegate = await viewGas(
    proxy,
    fn("isHandleDelegatedForUserDecryption", [account, dg, contract, h]),
  );
  o.resignSuccession_afterRetirement = await send(successor, proxy, fn("resignSuccession", [account]), "resign");

  // Pending designation replaced, then voided by retirement.
  const b = addr("account-b");
  await send(b, proxy, fn("designateSuccessor", [addr("s1")]), "designate b");
  o.designateSuccessor_replacingPending = await send(b, proxy, fn("designateSuccessor", [addr("s2")]), "re-designate b");
  o.retireAccount_voidingPendingDesignation = await send(b, proxy, fn("retireAccount"), "retire voiding pending");

  // Cancel, raise.
  const c2 = addr("account-c");
  await send(c2, proxy, fn("designateSuccessor", [addr("s3")]), "designate c");
  o.cancelSuccessorDesignation = await send(c2, proxy, fn("cancelSuccessorDesignation"), "cancel");
  o.raiseSuccessorDelay = await send(c2, proxy, fn("raiseSuccessorDelay", [30 * DAY]), "raise");
  return out;
}

const anvil = spawn(
  "anvil",
  ["--hardfork", hardfork, "--port", String(port), "--auto-impersonate", "--chain-id", "31337", "--quiet"],
  { stdio: ["ignore", "ignore", "ignore"] },
);
try {
  await waitForNode();
  const node = await rpc("anvil_nodeInfo", []);
  const result = {
    hardfork,
    anvilNodeInfo: { hardFork: node.hardFork, chainId: node.environment?.chainId },
    note: "receipt gasUsed per transaction (includes 21,000 intrinsic and calldata); view_* = eth_estimateGas of a call to the view",
    ...(await measure()),
  };
  writeFileSync(outJson, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  anvil.kill();
}
