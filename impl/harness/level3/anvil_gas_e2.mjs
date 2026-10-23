// Level 3 (E2) transaction-level gas on anvil (receipt gasUsed, 21,000 and calldata included): every step is its
// own transaction. ACL v0.10.0 behind Zama's empty-proxy flow, from the production artifacts (solc 0.8.24, 800 runs,
// cancun). Measures retireAccount (no successor, and with a confirmed successor) and retireAccountWithSig for an EOA
// with 1, 2 and 5 listed chains and for an ERC-1271 wallet. Keys are created in memory and never printed; anvil runs
// with --auto-impersonate for every other sender, and its stdout is discarded.
//
// Usage: node anvil_gas_e2.mjs <artifacts dir> <hardfork> <port> <out.json>
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signCertificate } from "../../watchtower/watchtower.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "..", "fhevm-main", "host-contracts", "package.json"));
const { ethers } = require("ethers");

const [artifactsDir, hardfork, port, outJson] = process.argv.slice(2);
const RPC = `http://127.0.0.1:${port}`;
const coder = ethers.AbiCoder.defaultAbiCoder();
const artifact = (rel) => {
  const j = JSON.parse(readFileSync(path.join(artifactsDir, rel), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
};
const A = {
  empty: artifact("EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json"),
  proxy: artifact("HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json"),
  acl: artifact("ACL.sol/ACL.json"),
  wallet: artifact("CertificateMocks.sol/CertificateWallet1271.json"),
};
const aclI = new ethers.Interface(A.acl.abi);
const walletI = new ethers.Interface(A.wallet.abi);
const emptyI = new ethers.Interface(A.empty.abi);
const addr = (label) => ethers.getAddress(ethers.dataSlice(ethers.id(`level3-gas:${label}`), 12));
// Phase 4 (P2.4) overrides, all unset by default (Phase 3's runs used none): extra anvil arguments, the gas of
// deployment transactions and of the signed E1 transactions. Under Amsterdam the ACL's deployment needs more than 10M gas.
const P24 = {
  anvilArgs: (process.env.P24_ANVIL_ARGS || "").split(" ").filter(Boolean),
  deployGas: BigInt(process.env.P24_DEPLOY_GAS || 10_000_000),
  signedGas: BigInt(process.env.P24_SIGNED_GAS || 1_000_000),
};

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
  const tx = { from, data, gas: ethers.toQuantity(label === "deploy" ? P24.deployGas : 10_000_000n) };
  if (to) tx.to = to;
  const r = await receipt(await rpc("eth_sendTransaction", [tx]));
  if (r.status !== "0x1") throw new Error(`tx failed: ${label}`);
  return { gasUsed: Number(BigInt(r.gasUsed)), calldataBytes: (data.length - 2) / 2, contractAddress: r.contractAddress };
}
async function sendSigned(wallet, to, data, label) {
  await rpc("anvil_setBalance", [wallet.address, ethers.toQuantity(10n ** 21n)]);
  const nonce = Number(BigInt(await rpc("eth_getTransactionCount", [wallet.address, "pending"])));
  const tx = await wallet.connect(provider).sendTransaction({ to, data, gasLimit: P24.signedGas, nonce });
  const r = await receipt(tx.hash);
  if (r.status !== "0x1") throw new Error(`signed tx failed: ${label}`);
}
async function deploy(art, args, types) {
  const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
  return ethers.getAddress((await send(addr("deployer"), null, data, "deploy")).contractAddress);
}

async function main() {
  const anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", port, "--hardfork", hardfork, "--auto-impersonate", "--silent", ...P24.anvilArgs], { stdio: "ignore" });
  const out = { hardfork, gas: {} };
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
    await send(owner, acl, aclI.encodeFunctionData("upgradeToAndCall", [impl, aclI.encodeFunctionData("initializeFromEmptyProxy", [])]), "upgrade");
    const version = aclI.decodeFunctionResult("getVersion", await rpc("eth_call", [{ to: acl, data: aclI.encodeFunctionData("getVersion", []) }, "latest"]))[0];
    out.version = version;
    const g = out.gas;
    const successor = addr("successor");
    const confirm = async (account, viaWallet) => {
      const call = (data) => (viaWallet ? send(viaWallet.owner, viaWallet.address, walletI.encodeFunctionData("execute", [acl, data]), "execute") : sendSigned(account, acl, data, "e1"));
      await call(aclI.encodeFunctionData("designateSuccessor", [successor]));
      await send(successor, acl, aclI.encodeFunctionData("acceptSuccession", [viaWallet ? viaWallet.address : account.address]), "accept");
      await rpc("evm_increaseTime", [7 * 86_400]);
      await rpc("evm_mine", []);
      await call(aclI.encodeFunctionData("confirmSuccessor", []));
    };

    g.retireAccount_noSuccessionRecord = await send(addr("plain"), acl, aclI.encodeFunctionData("retireAccount", []), "retire");
    const withSucc = ethers.Wallet.createRandom();
    await confirm(withSucc);
    await rpc("anvil_setBalance", [withSucc.address, ethers.toQuantity(10n ** 21n)]);
    g.retireAccount_withConfirmedSuccessor = await send(withSucc.address, acl, aclI.encodeFunctionData("retireAccount", []), "retire succ");

    for (const n of [1, 2, 5]) {
      const account = ethers.Wallet.createRandom();
      await confirm(account);
      const chainIds = [31337, ...Array.from({ length: n - 1 }, (_, i) => 1000 + i)];
      const cert = { account: account.address, successor, chainIds };
      const signature = await signCertificate(account, cert);
      g[`retireAccountWithSig_eoa_${n}chain`] = await send(addr(`relayer-${n}`), acl, aclI.encodeFunctionData("retireAccountWithSig", [account.address, successor, chainIds, signature]), `cert ${n}`);
    }

    const walletOwner = ethers.Wallet.createRandom();
    const wallet = await deploy(A.wallet, [walletOwner.address], ["address"]);
    await confirm(null, { owner: walletOwner.address, address: wallet });
    const wcert = { account: wallet, successor, chainIds: [31337] };
    const wsig = await signCertificate(walletOwner, wcert);
    g.retireAccountWithSig_erc1271_1chain = await send(addr("relayer-w"), acl, aclI.encodeFunctionData("retireAccountWithSig", [wallet, successor, [31337], wsig]), "cert 1271");
  } finally {
    anvil.kill();
  }
  writeFileSync(outJson, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
