// Level 3 (E2): the watchtower end to end on three local anvil chains. ACL v0.10.0 behind Zama's empty-proxy flow,
// from the production artifacts (solc 0.8.24, 800 runs, cancun), on chains 31337 and 31338 (listed in the
// certificate) and 31339 (not listed). The account confirms a successor on all three, signs one certificate for the
// two listed chains, and hands it to the watchtower. A thief with the account's key then makes a wildcard,
// non-expiring delegation on 31338; the watchtower detects it and relays the certificate to both listed chains.
// Also cross-checks the ERC's published certificate vector in ethers. The account's key lives in memory only and is
// never printed; the vector key is index 0 of the public test mnemonic. anvil's stdout is discarded.
//
// Usage: node watchtower_e2e.mjs <ACL artifacts dir> <first port> <out.json>
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWatchtower, signCertificate, certificateDigest } from "../../watchtower/watchtower.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "..", "fhevm-main", "host-contracts", "package.json"));
const { ethers } = require("ethers");

const [artifactsDir, firstPort, outJson] = process.argv.slice(2);
const ACL_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const coder = ethers.AbiCoder.defaultAbiCoder();
const DAY = 86_400;
const WILDCARD = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";

const artifact = (rel) => {
  const j = JSON.parse(readFileSync(path.join(artifactsDir, rel), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
};
const A = {
  empty: artifact("EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json"),
  proxy: artifact("HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json"),
  acl: artifact("ACL.sol/ACL.json"),
};
const aclI = new ethers.Interface(A.acl.abi);
const emptyI = new ethers.Interface(A.empty.abi);
const addr = (label) => ethers.getAddress(ethers.dataSlice(ethers.id(`level3-watchtower:${label}`), 12));

class Chain {
  constructor(name, port, chainId) {
    Object.assign(this, { name, port, chainId, rpc: `http://127.0.0.1:${port}` });
  }
  start() {
    this.proc = spawn("anvil", ["--host", "127.0.0.1", "--port", String(this.port), "--chain-id", String(this.chainId), "--auto-impersonate", "--silent"], { stdio: "ignore" });
  }
  async ready() {
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch(this.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
        if (res.ok) {
          this.provider = new ethers.JsonRpcProvider(this.rpc, this.chainId, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`${this.name} did not start`);
  }
  rpcCall(m, p) {
    return this.provider.send(m, p);
  }
  async receipt(hash) {
    for (let i = 0; i < 400; i++) {
      const r = await this.rpcCall("eth_getTransactionReceipt", [hash]);
      if (r) return r;
      await new Promise((res) => setTimeout(res, 25));
    }
    throw new Error("no receipt");
  }
  async send(from, to, data, label) {
    await this.rpcCall("anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
    const tx = { from, data, gas: ethers.toQuantity(10_000_000n) };
    if (to) tx.to = to;
    const r = await this.receipt(await this.rpcCall("eth_sendTransaction", [tx]));
    if (r.status !== "0x1") throw new Error(`${this.name}: tx failed: ${label}`);
    return r;
  }
  /// A transaction signed with an in-memory wallet (the account's own key, or the thief holding it).
  async sendSigned(wallet, to, data, label) {
    await this.rpcCall("anvil_setBalance", [wallet.address, ethers.toQuantity(10n ** 21n)]);
    const w = wallet.connect(this.provider);
    const nonce = Number(BigInt(await this.rpcCall("eth_getTransactionCount", [wallet.address, "pending"])));
    const tx = await w.sendTransaction({ to, data, gasLimit: 1_000_000n, nonce });
    const r = await this.receipt(tx.hash);
    if (r.status !== "0x1") throw new Error(`${this.name}: signed tx failed: ${label}`);
    return r;
  }
  async deployACL(owner) {
    const deploy = async (art, args, types) => {
      const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
      return ethers.getAddress((await this.send(addr("deployer"), null, data, "deploy")).contractAddress);
    };
    const emptyImpl = await deploy(A.empty);
    const proxy = await deploy(A.proxy, [emptyImpl, emptyI.encodeFunctionData("initialize", [owner])], ["address", "bytes"]);
    const impl = await deploy(A.acl);
    await this.send(owner, proxy, aclI.encodeFunctionData("upgradeToAndCall", [impl, aclI.encodeFunctionData("initializeFromEmptyProxy", [])]), "upgrade");
    this.acl = proxy;
    return proxy;
  }
  async view(fn, args) {
    return aclI.decodeFunctionResult(fn, await this.rpcCall("eth_call", [{ to: this.acl, data: aclI.encodeFunctionData(fn, args) }, "latest"]))[0];
  }
  /// [h][account] persisted directly (the same shortcut as the Level 2 harnesses).
  async persist(h, account) {
    const inner = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [h, ACL_LOCATION])));
    await this.rpcCall("anvil_setStorageAt", [this.acl, ethers.keccak256(coder.encode(["address", "uint256"], [account, inner])), ethers.toBeHex(1n, 32)]);
  }
}

async function main() {
  const p = Number(firstPort);
  const chains = [new Chain("A", p, 31337), new Chain("B", p + 1, 31338), new Chain("C", p + 2, 31339)];
  const out = { chains: {}, steps: {} };
  try {
    for (const c of chains) c.start();
    for (const c of chains) await c.ready();
    const owner = addr("owner");
    const wallet = ethers.Wallet.createRandom(); // the account; key in memory only
    const successor = addr("successor");
    const thief = addr("thief");
    const app = addr("app");
    const h = ethers.id("level3-watchtower-handle");

    // 0. ERC vector, recomputed in ethers.
    const vectorWallet = ethers.HDNodeWallet.fromPhrase("test test test test test test test test test test test junk", undefined, "m/44'/60'/0'/0/0");
    const vectorCert = { account: vectorWallet.address, successor: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", chainIds: [1, 11155111] };
    const vectorSig = await signCertificate(vectorWallet, vectorCert);
    out.steps.ercVector = {
      digest: certificateDigest(vectorCert),
      digestMatchesErc: certificateDigest(vectorCert) === "0xca933c116695438e119a68f3f457dac8b4b9050e77210d19cdaa2be05106e98a",
      signatureMatchesErc:
        vectorSig ===
        "0x2f2daa5d31e68624bed89cefce723bc9f21b880ea92b4f49f50d80ca00af115253f9db3981e50d97405d417aaf1992826d1e4d65cfe26881c2550ca600a55c371c",
    };

    // 1. ACL v0.10.0 on three chains; the account confirms the same successor on each.
    for (const c of chains) {
      await c.deployACL(owner);
      await c.persist(h, wallet.address);
      await c.persist(h, app);
      await c.sendSigned(wallet, c.acl, aclI.encodeFunctionData("designateSuccessor", [successor]), "designate");
      await c.send(successor, c.acl, aclI.encodeFunctionData("acceptSuccession", [wallet.address]), "accept");
      await c.rpcCall("evm_increaseTime", [7 * DAY]);
      await c.rpcCall("evm_mine", []);
      await c.sendSigned(wallet, c.acl, aclI.encodeFunctionData("confirmSuccessor", []), "confirm");
      out.chains[c.name] = {
        chainId: c.chainId,
        acl: c.acl,
        client: await c.rpcCall("web3_clientVersion", []),
        version: await c.view("getVersion", []),
        e2: await c.view("supportsInterface", ["0x4b9ec076"]),
        successorOf: await c.view("successorOf", [wallet.address]),
      };
    }

    // 2. One certificate for chains 31337 and 31338, signed once and handed to the watchtower.
    const certificate = { account: wallet.address, successor, chainIds: [31337, 31338] };
    certificate.signature = await signCertificate(wallet, certificate);
    out.steps.certificate = {
      account: certificate.account,
      successor,
      chainIds: certificate.chainIds,
      signatureBytes: (certificate.signature.length - 2) / 2,
      digest: certificateDigest(certificate),
    };
    // The relayer is any funded account; the watchtower never needs the account's key.
    for (const c of chains) await c.rpcCall("anvil_setBalance", [addr("relayer"), ethers.toQuantity(10n ** 21n)]);
    const config = {
      certificate,
      relayer: addr("relayer"),
      chains: chains.map((c) => ({ name: c.name, rpc: c.rpc, acl: c.acl })),
    };
    const logs = [];
    const wt = createWatchtower(config, { log: (l) => logs.push(l) });
    out.steps.quietPass = await wt.watch({ once: true }); // no signal yet: nothing relayed

    // 3. Compromise on chain B: the thief, holding the key, delegates everything to itself, forever.
    const B = chains[1];
    const thiefTx = await B.sendSigned(wallet, B.acl, aclI.encodeFunctionData("delegateForUserDecryption", [thief, WILDCARD, (1n << 64n) - 1n]), "thief delegation");
    const thiefBlock = Number(BigInt(thiefTx.blockNumber));
    out.steps.thiefDelegationActiveBefore = await B.view("isHandleDelegatedForUserDecryption", [wallet.address, thief, app, h]);
    const t0 = performance.now();
    const watched = await wt.watch({ intervalMs: 200, maxPasses: 50 });
    out.steps.watch = { signals: watched.signals, relays: watched.relays, detectAndRelayMs: Math.round(performance.now() - t0), thiefBlock };

    // 4. The outcome on each chain.
    for (const c of chains) {
      out.chains[c.name].after = {
        retired: await c.view("isAccountRetired", [wallet.address]),
        successorOf: await c.view("successorOf", [wallet.address]),
        successorReads: await c.view("isHandleDelegatedForUserDecryption", [wallet.address, successor, app, h]),
        thiefReads: await c.view("isHandleDelegatedForUserDecryption", [wallet.address, thief, app, h]),
        accountUsable: await c.view("persistAllowed", [h, wallet.address]),
      };
    }

    // 5. Relaying again changes nothing; the command line works on a second account.
    out.steps.relayAgain = await wt.relayAll("again");
    const second = ethers.Wallet.createRandom();
    for (const c of chains.slice(0, 2)) {
      await c.sendSigned(second, c.acl, aclI.encodeFunctionData("designateSuccessor", [successor]), "designate 2");
      await c.send(successor, c.acl, aclI.encodeFunctionData("acceptSuccession", [second.address]), "accept 2");
      await c.rpcCall("evm_increaseTime", [7 * DAY]);
      await c.rpcCall("evm_mine", []);
      await c.sendSigned(second, c.acl, aclI.encodeFunctionData("confirmSuccessor", []), "confirm 2");
    }
    const cert2 = { account: second.address, successor, chainIds: [31337, 31338] };
    cert2.signature = await signCertificate(second, cert2);
    const cfg2 = path.join(here, ".watchtower-config-2.json");
    writeFileSync(cfg2, JSON.stringify({ ...config, certificate: cert2 }));
    const cli = spawnSync(process.execPath, [path.join(here, "..", "..", "watchtower", "watchtower.mjs"), "relay", "--config", cfg2], { encoding: "utf8" });
    rmSync(cfg2);
    out.steps.cli = {
      exit: cli.status,
      lines: cli.stdout.trim().split(/\r?\n/).map((l) => l.replace(/"tx":"0x[0-9a-f]+",/, "")),
      retiredA: await chains[0].view("isAccountRetired", [second.address]),
      retiredB: await chains[1].view("isAccountRetired", [second.address]),
      retiredC: await chains[2].view("isAccountRetired", [second.address]),
    };
    out.watchtowerLog = logs;
  } finally {
    for (const c of chains) c.proc?.kill();
  }
  writeFileSync(outJson, JSON.stringify(out, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log(JSON.stringify({ steps: out.steps, after: Object.fromEntries(Object.entries(out.chains).map(([k, v]) => [k, v.after])) }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
