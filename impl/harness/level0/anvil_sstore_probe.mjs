// Probe: tx-level gas of one new-slot SSTORE and of a plain transfer on anvil, per hardfork and block gas limit.
// anvil runs with --auto-impersonate and stdout discarded (no keys used or printed).
// Usage: node anvil_sstore_probe.mjs <host-contracts dir> <port> <hardfork> <gasLimit> [<gasLimit>...]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const [hostDir, port0, hardfork, ...limits] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(hostDir), "package.json"));
const { ethers } = require("ethers");

async function call(rpc, method, params) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function receipt(rpc, hash) {
  for (let i = 0; i < 200; i++) {
    const r = await call(rpc, "eth_getTransactionReceipt", [hash]);
    if (r) return r;
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error("no receipt");
}

let port = Number(port0);
const rows = [];
for (const gl of limits) {
  const rpc = `http://127.0.0.1:${port}`;
  const anvil = spawn(
    "anvil",
    ["--hardfork", hardfork, "--port", String(port), "--auto-impersonate", "--gas-limit", gl, "--quiet"],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await call(rpc, "eth_chainId", []);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const from = "0x00000000000000000000000000000000000a11ce";
    await call(rpc, "anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
    const gas = ethers.toQuantity(Math.min(Number(gl), 16_000_000));
    const dep = await receipt(
      rpc,
      await call(rpc, "eth_sendTransaction", [{ from, gas, data: "0x600780600b6000396000f360016000355500" }]),
    );
    const store = dep.contractAddress;
    const r1 = await receipt(rpc, await call(rpc, "eth_sendTransaction", [{ from, gas, to: store, data: ethers.id("a") }]));
    const r2 = await receipt(rpc, await call(rpc, "eth_sendTransaction", [{ from, gas, to: store, data: ethers.id("a") }]));
    const r3 = await receipt(rpc, await call(rpc, "eth_sendTransaction", [{ from, gas, to: from, data: "0x" }]));
    rows.push({
      hardfork,
      blockGasLimit: Number(gl),
      deploy7ByteContract: Number(BigInt(dep.gasUsed)),
      sstoreNewSlot: Number(BigInt(r1.gasUsed)),
      sstoreSameValue: Number(BigInt(r2.gasUsed)),
      plainTransfer: Number(BigInt(r3.gasUsed)),
    });
  } finally {
    anvil.kill();
  }
  port++;
}
console.log(JSON.stringify(rows));
