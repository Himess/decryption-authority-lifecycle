// Level 2 (c): the carry tool end to end on a local anvil. ACL v0.9.0 behind Zama's empty-proxy flow, from the
// production artifacts (solc 0.8.24, 800 runs, cancun), and three test apps (CarryMockApp): an allowlisted app, an
// ERC-7984-like token whose earlier balance handles go stale, and a spammer. Runs the tool's plan and execute steps
// in-process: the dry run, the refusals, an injected failure in the middle of a carry and the resume, then full
// carries of 1 to 400 handles for gas per transaction.
// anvil runs with --auto-impersonate: no private key is used or printed; anvil's stdout is discarded. Apps hold their
// handles through the ACL's persisted pair, written with anvil_setStorageAt (the same shortcut as anvil_gas_e1.mjs).
//
// Usage: node carry_e2e.mjs <ACL artifacts dir> <carry mock out dir> <hardfork> <port> <out.json>
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { plan, execute } from "../../carry-tool/carry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "..", "fhevm-main", "host-contracts", "package.json"));
const { ethers } = require("ethers");

const [artifactsDir, mockOut, hardfork, port, outJson] = process.argv.slice(2);
const RPC = `http://127.0.0.1:${port}`;
const ACL_LOCATION = 0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00n;
const TX_GAS = 16_000_000n;
// Phase 4 (P2.4) overrides, all unset by default (Phase 3's runs used none): extra anvil arguments, the gas of
// deployment transactions, the gas stage's chunk and fit points, and a direct check of the largest single-transaction
// carry under the 2^24 cap. Under Amsterdam the ACL's deployment needs more than 16M gas.
const P24 = {
  anvilArgs: (process.env.P24_ANVIL_ARGS || "").split(" ").filter(Boolean),
  deployGas: process.env.P24_DEPLOY_GAS ? BigInt(process.env.P24_DEPLOY_GAS) : TX_GAS,
  chunk: Number(process.env.P24_CARRY_CHUNK || 1000),
  fitLo: Number(process.env.P24_FIT_LO || 100),
  fitHi: Number(process.env.P24_FIT_HI || 400),
  verifyCap: process.env.P24_VERIFY_CAP === "1",
};
const coder = ethers.AbiCoder.defaultAbiCoder();

const artifact = (file) => {
  const j = JSON.parse(readFileSync(file, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
};
const A = {
  empty: artifact(path.join(artifactsDir, "EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json")),
  proxy: artifact(path.join(artifactsDir, "HostContractsDeployerTestUtils.sol/DeployableERC1967Proxy.json")),
  acl: artifact(path.join(artifactsDir, "ACL.sol/ACL.json")),
  app: artifact(path.join(mockOut, "CarryMockApp.sol/CarryMockApp.json")),
};
const aclI = new ethers.Interface(A.acl.abi);
const appI = new ethers.Interface(A.app.abi);
const emptyI = new ethers.Interface(A.empty.abi);

let provider;
const rpc = (m, p) => provider.send(m, p);
const addr = (label) => ethers.getAddress(ethers.dataSlice(ethers.id(`level2-carry:${label}`), 12));

async function waitForNode() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) {
        provider = new ethers.JsonRpcProvider(RPC, 31337, { staticNetwork: true, batchMaxCount: 1, pollingInterval: 50, cacheTimeout: -1 });
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("anvil did not start");
}

async function send(from, to, data, label) {
  await rpc("anvil_setBalance", [from, ethers.toQuantity(10n ** 24n)]);
  const tx = { from, data, gas: ethers.toQuantity(label === "deploy" ? P24.deployGas : TX_GAS) };
  if (to) tx.to = to;
  const hash = await rpc("eth_sendTransaction", [tx]);
  let r = null;
  for (let i = 0; i < 400 && !r; i++) {
    r = await rpc("eth_getTransactionReceipt", [hash]);
    if (!r) await new Promise((res) => setTimeout(res, 25));
  }
  if (!r || r.status !== "0x1") throw new Error(`tx failed: ${label}`);
  return r;
}

async function deploy(art, args, types) {
  const data = art.bytecode + (types ? coder.encode(types, args).slice(2) : "");
  return ethers.getAddress((await send(addr("deployer"), null, data, "deploy")).contractAddress);
}

async function deployACL(owner) {
  const emptyImpl = await deploy(A.empty);
  const proxy = await deploy(A.proxy, [emptyImpl, emptyI.encodeFunctionData("initialize", [owner])], ["address", "bytes"]);
  const impl = await deploy(A.acl);
  await send(owner, proxy, aclI.encodeFunctionData("upgradeToAndCall", [impl, aclI.encodeFunctionData("initializeFromEmptyProxy", [])]), "upgrade");
  return proxy;
}

let handleSeq = 0;
function newHandle() {
  let h = BigInt(ethers.id(`level2-carry-handle:${handleSeq++}`)) & ~((1n << 88n) - 1n);
  h |= 0xffn << 80n;
  h |= 31337n << 16n;
  h |= 5n << 8n;
  return ethers.toBeHex(h, 32);
}

/// The app holds `h`: the ACL's persisted pair [h][app], written directly (the app's own grant needs it).
async function hold(acl, h, app) {
  const inner = BigInt(ethers.keccak256(coder.encode(["bytes32", "uint256"], [h, ACL_LOCATION])));
  const slot = ethers.keccak256(coder.encode(["address", "uint256"], [app, inner]));
  await rpc("anvil_setStorageAt", [acl, slot, ethers.toBeHex(1n, 32)]);
}

async function grantMany(acl, app, handles, to) {
  for (const h of handles) await hold(acl, h, app);
  for (let i = 0; i < handles.length; i += 100) {
    await send(addr("app-operator"), app, appI.encodeFunctionData("grantMany", [handles.slice(i, i + 100), to]), "grantMany");
  }
}

const view = async (acl, name, args) => aclI.decodeFunctionResult(name, await rpc("eth_call", [{ to: acl, data: aclI.encodeFunctionData(name, args) }, "latest"]))[0];
const opts = (acl, old, nw, extra = {}) => ({ rpc: RPC, acl, old, new: nw, fromBlock: 0, logRange: 10_000, chunk: 400, signer: "impersonate", allowContract: [], balanceToken: [], ...extra });
const summary = (p) => ({ grants: p.grants, handles: p.handles, kept: p.kept.length, chunks: p.chunks.map((c) => c.length), refuse: p.refuse, breakdown: p.breakdown });

async function main() {
  const anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", port, "--hardfork", hardfork, "--auto-impersonate", "--silent", ...P24.anvilArgs], { stdio: "ignore" });
  const out = { hardfork, anvil: null, scenario: {}, gas: [] };
  try {
    await waitForNode();
    out.anvil = await rpc("web3_clientVersion", []);
    const owner = addr("owner");
    const acl = await deployACL(owner);
    const appA = await deploy(A.app, [acl], ["address"]);
    const token = await deploy(A.app, [acl], ["address"]);
    const spammer = await deploy(A.app, [acl], ["address"]);
    const OLD = addr("old");
    const NEW = addr("new");
    const RETIRED = addr("retired-new");
    const s = out.scenario;
    s.addresses = { acl, appA, token, spammer, OLD, NEW, RETIRED };
    // OLD pays for its own carry.
    await rpc("anvil_setBalance", [OLD, ethers.toQuantity(10n ** 21n)]);

    // Grants to OLD: 120 from the app (one of them already granted to NEW), one handle from both the app and the
    // spammer, 5 successive token balances (4 stale), and 300 spam handles.
    const hA = Array.from({ length: 120 }, newHandle);
    await grantMany(acl, appA, hA, OLD);
    await grantMany(acl, appA, [hA[0]], NEW);
    const hShared = newHandle();
    await grantMany(acl, appA, [hShared], OLD);
    await grantMany(acl, spammer, [hShared], OLD);
    const balances = Array.from({ length: 5 }, newHandle);
    for (const h of balances) {
      await hold(acl, h, token);
      await send(addr("app-operator"), token, appI.encodeFunctionData("setBalance", [OLD, h]), "setBalance");
    }
    const spam = Array.from({ length: 300 }, newHandle);
    await grantMany(acl, spammer, spam, OLD);
    const expectKept = new Set([...hA.slice(1), hShared, balances[4]].map((h) => h.toLowerCase()));

    // 0. The command line: a dry run (exit 0, nothing sent) and a refusal (exit 2).
    const cli = (args) => spawnSync(process.execPath, [path.join(here, "..", "..", "carry-tool", "carry.mjs"), ...args], { encoding: "utf8" });
    const base = ["--rpc", RPC, "--acl", acl, "--old", OLD];
    const c1 = cli([...base, "--new", NEW, "--allow-contract", appA, "--balance-token", token, "--chunk", "50", "--dry-run"]);
    const lines1 = c1.stdout.split(/\r?\n/);
    s.cliDryRun = { exit: c1.status, summaryLine: lines1[1]?.trim(), listedHandles: lines1.filter((l) => /^ {4}0x[0-9a-f]{64}$/.test(l)).length, stderr: c1.stderr.trim() };
    console.error(c1.stdout);
    await send(addr("retired-cli"), acl, aclI.encodeFunctionData("retireAccount", []), "retire for the CLI refusal");
    const c2 = cli([...base, "--new", addr("retired-cli"), "--dry-run"]);
    s.cliRefusal = { exit: c2.status, refused: c2.stdout.split(/\r?\n/).filter((l) => l.includes("REFUSED")).map((l) => l.trim()) };

    // 1. Dry run with the allowlist.
    const filtered = opts(acl, OLD, NEW, { allowContract: [appA], balanceToken: [token], chunk: 50 });
    const nonceBefore = await provider.getTransactionCount(OLD);
    const p1 = await plan(filtered, provider);
    s.dryRun = summary(p1);
    s.dryRun.keptMatchesExpectation = p1.kept.length === expectKept.size && p1.kept.every((h) => expectKept.has(h.toLowerCase()));
    s.dryRun.sentNothing = (await provider.getTransactionCount(OLD)) === nonceBefore && !(await view(acl, "isAccountRetired", [OLD]));
    console.error("stage 1 dry run:", JSON.stringify({ kept: p1.kept.length, chunks: p1.chunks.map((c) => c.length), refuse: p1.refuse, match: s.dryRun.keptMatchesExpectation }));

    // 2. Without the allowlist every spam handle would be carried.
    s.dryRunNoAllowlist = summary(await plan(opts(acl, OLD, NEW), provider));

    // 3. Refusals: NEW retired; NEW equal to OLD.
    await send(RETIRED, acl, aclI.encodeFunctionData("retireAccount", []), "retire RETIRED");
    s.refuseRetiredNew = (await plan(opts(acl, OLD, RETIRED), provider)).refuse;
    s.refuseSameAccount = (await plan(opts(acl, OLD, OLD), provider)).refuse;

    // 4. A failure in the middle: the registry owner deny-lists OLD before chunk 1. The run stops; OLD stays active.
    const r4 = await execute(filtered, provider, p1, {
      beforeChunk: async (i) => {
        if (i === 1) await send(owner, acl, aclI.encodeFunctionData("blockAccount", [OLD]), "blockAccount");
      },
    });
    s.injectedFailure = {
      sent: r4.sent.map(({ chunk, handles, retires, status, gasUsed }) => ({ chunk, handles, retires, status, gasUsed })),
      stopped: r4.stopped,
      oldRetired: await view(acl, "isAccountRetired", [OLD]),
      newHoldsChunk0: (await Promise.all(p1.chunks[0].map((h) => view(acl, "persistAllowed", [h, NEW])))).every(Boolean),
    };
    console.error("stage 4 injected failure:", JSON.stringify(s.injectedFailure));
    await send(owner, acl, aclI.encodeFunctionData("unblockAccount", [OLD]), "unblockAccount");

    // 5. Resume: the rerun skips what NEW already holds and finishes with the retirement.
    const p5 = await plan(filtered, provider);
    const r5 = await execute(filtered, provider, p5);
    s.resume = { plan: summary(p5), sent: r5.sent.map(({ chunk, handles, retires, status, gasUsed, calldataBytes }) => ({ chunk, handles, retires, status, gasUsed, calldataBytes })), stopped: r5.stopped, verified: r5.verified };
    s.afterRetirement = {
      allExpectedAtNew: (await Promise.all([...expectKept].map((h) => view(acl, "persistAllowed", [h, NEW])))).every(Boolean),
      spamAtNew: (await Promise.all(spam.slice(0, 20).map((h) => view(acl, "persistAllowed", [h, NEW])))).some(Boolean),
      staleBalanceAtNew: (await Promise.all(balances.slice(0, 4).map((h) => view(acl, "persistAllowed", [h, NEW])))).some(Boolean),
      oldUsableOnAny: (await Promise.all([...expectKept].map((h) => view(acl, "persistAllowed", [h, OLD])))).some(Boolean),
      secondRunRefused: (await plan(filtered, provider)).refuse,
    };

    // 6. Gas: one transaction carrying k handles and retiring, for several k (fresh accounts and handles each time).
    for (const k of [0, 1, 10, 50, 100, 200, 400, 500]) {
      const old = addr(`gas-old-${k}`);
      const nw = addr(`gas-new-${k}`);
      const hs = Array.from({ length: k }, newHandle);
      await grantMany(acl, appA, hs, old);
      await rpc("anvil_setBalance", [old, ethers.toQuantity(10n ** 21n)]);
      const o = opts(acl, old, nw, { allowContract: [appA], chunk: P24.chunk });
      const t0 = performance.now();
      const p = await plan(o, provider);
      const t1 = performance.now();
      const r = await execute(o, provider, p);
      const t2 = performance.now();
      if (!r.verified?.ok) throw new Error(`gas run k=${k} did not verify`);
      out.gas.push({ handles: k, transactions: r.sent.length, gasUsed: r.sent.map((x) => x.gasUsed), calldataBytes: r.sent.map((x) => x.calldataBytes), planMs: Math.round(t1 - t0), executeMs: Math.round(t2 - t1) });
    }
    const one = (k) => out.gas.find((g) => g.handles === k).gasUsed[0];
    out.fit = {
      perHandle: (one(P24.fitHi) - one(P24.fitLo)) / (P24.fitHi - P24.fitLo),
      base: one(0),
      points: [P24.fitLo, P24.fitHi],
      note: "gasUsed of one multicall transaction: allow(h, NEW) for k handles, then retireAccount()",
    };
    out.fit.maxHandlesUnderTxCap = Math.floor((16_777_216 - out.fit.base) / out.fit.perHandle);

    // 7. (P2.4) The largest single transaction under the 2^24 cap, measured: the largest k whose multicall the node
    //    estimates at <= 2^24, then that k and k + 1 sent with a gas limit of exactly 2^24 from fresh accounts.
    if (P24.verifyCap) {
      const CAP = 16_777_216n;
      const pool = Math.ceil(out.fit.maxHandlesUnderTxCap * 1.2) + 2;
      const mkCarry = async (tag) => {
        const old = addr(`cap-old-${tag}`);
        const hs = Array.from({ length: pool }, newHandle);
        await grantMany(acl, appA, hs, old);
        return { old, hs };
      };
      const data = (hs, nw) => aclI.encodeFunctionData("multicall", [[...hs.map((h) => aclI.encodeFunctionData("allow", [h, nw])), aclI.encodeFunctionData("retireAccount", [])]]);
      const a = await mkCarry("a");
      const nwA = addr("cap-new-a");
      const fits = async (k) => {
        try {
          return BigInt(await rpc("eth_estimateGas", [{ from: a.old, to: acl, data: data(a.hs.slice(0, k), nwA) }])) <= CAP;
        } catch {
          return false;
        }
      };
      let lo = 1, hi = pool;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (await fits(mid)) lo = mid;
        else hi = mid - 1;
      }
      const sendCapped = async (from, d) => {
        await rpc("anvil_setBalance", [from, ethers.toQuantity(10n ** 21n)]);
        const hash = await rpc("eth_sendTransaction", [{ from, to: acl, data: d, gas: ethers.toQuantity(CAP) }]);
        let r = null;
        for (let i = 0; i < 400 && !r; i++) {
          r = await rpc("eth_getTransactionReceipt", [hash]);
          if (!r) await new Promise((res) => setTimeout(res, 25));
        }
        return { status: r ? Number(BigInt(r.status)) : null, gasUsed: r ? Number(BigInt(r.gasUsed)) : null, hash };
      };
      const estimate = async (from, d) => Number(BigInt(await rpc("eth_estimateGas", [{ from, to: acl, data: d }])));
      const estAtMax = await estimate(a.old, data(a.hs.slice(0, lo), nwA));
      const { hash: _h1, ...atMax } = await sendCapped(a.old, data(a.hs.slice(0, lo), nwA));
      const b = await mkCarry("b");
      const dB = data(b.hs.slice(0, lo + 1), addr("cap-new-b"));
      const estOverMax = await estimate(b.old, dB);
      const { hash: failedHash, ...overMax } = await sendCapped(b.old, dB);
      out.capCheck = { estimatedMax: lo, sentAtMax: atMax, sentAtMaxPlusOne: overMax, gasLimit: Number(CAP) };
      // (P2.4, P24_CAP_DIAG=1) Why the boundary sits below the fit: the estimates at k and k + 1, the gas k + 1 uses
      // when the limit is ample, and where the transaction sent at 2^24 failed (callTracer).
      if (process.env.P24_CAP_DIAG === "1") {
        const c = await mkCarry("c");
        await rpc("anvil_setBalance", [c.old, ethers.toQuantity(10n ** 21n)]);
        const hashC = await rpc("eth_sendTransaction", [{ from: c.old, to: acl, data: data(c.hs.slice(0, lo + 1), addr("cap-new-c")), gas: ethers.toQuantity(40_000_000n) }]);
        let rc = null;
        for (let i = 0; i < 400 && !rc; i++) {
          rc = await rpc("eth_getTransactionReceipt", [hashC]);
          if (!rc) await new Promise((res) => setTimeout(res, 25));
        }
        let trace = null;
        try {
          const t = await rpc("debug_traceTransaction", [failedHash, { tracer: "callTracer" }]);
          const calls = t.calls || [];
          const last = calls[calls.length - 1] || {};
          trace = {
            topError: t.error || null,
            topGasUsed: Number(BigInt(t.gasUsed || "0x0")),
            innerCalls: calls.length,
            innerFailed: calls.filter((x) => x.error).length,
            lastInner: { type: last.type, error: last.error || null, gas: last.gas ? Number(BigInt(last.gas)) : null, gasUsed: last.gasUsed ? Number(BigInt(last.gasUsed)) : null },
            secondLastInner: calls.length > 1 ? { error: calls[calls.length - 2].error || null, gas: Number(BigInt(calls[calls.length - 2].gas)), gasUsed: Number(BigInt(calls[calls.length - 2].gasUsed)) } : null,
          };
        } catch (e) {
          trace = { error: String(e.message || e).slice(0, 200) };
        }
        out.capDiag = {
          estimateAtMax: estAtMax,
          estimateAtMaxPlusOne: estOverMax,
          maxPlusOneWithAmpleGas: { status: rc ? Number(BigInt(rc.status)) : null, gasUsed: rc ? Number(BigInt(rc.gasUsed)) : null, gasLimit: 40_000_000 },
          failedAtCapTrace: trace,
        };
      }
    }
  } finally {
    anvil.kill();
  }
  writeFileSync(outJson, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ scenario: Object.fromEntries(Object.entries(out.scenario).filter(([k]) => k !== "addresses")), gas: out.gas, fit: out.fit }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
