// Amsterdam transaction-level estimates [E] for main (runs 800):
//   tx(Amsterdam) ~= receipt(anvil, Prague) + [caller-side(forge amsterdam) - caller-side(forge prague)], same variant.
// anvil 1.8.5 --hardfork amsterdam does not apply the state-creation charge (see L0_gas_anvil_sstore_probe_*.json),
// forge --evm-version amsterdam does (see L0_forge_hardfork_primitives.log).
// Usage: node amsterdam_estimate.mjs <raw dir>
import { readFileSync } from "node:fs";
import path from "node:path";
const raw = process.argv[2];
const anv = JSON.parse(readFileSync(path.join(raw, "L0_gas_anvil_main_prague.json"), "utf8"));
function callerSide(evm) {
  const m = new Map();
  for (const l of readFileSync(path.join(raw, `L0_gas_main_runs800_${evm}.log`), "utf8").split(/\r?\n/)) {
    const i = l.indexOf("GAS|");
    if (i < 0 || !l.includes("(caller-side)")) continue;
    const [, , label, base, l0] = l.slice(i).split("|");
    m.set(label, [Number(base), Number(l0)]);
  }
  return m;
}
const P = callerSide("prague"), A = callerSide("amsterdam");
const rows = [
  ["allow (new pair)", "v0_7_0", "allow_new_pair", "allow (new pair) (caller-side)", 0],
  ["allow (new pair)", "v0_8_0", "allow_new_pair", "allow (new pair) (caller-side)", 1],
  ["retireAccount", "v0_8_0", "retireAccount", "retireAccount (first, cold) (caller-side)", 1],
  ...[1, 10, 100, 500].flatMap((n) => [
    [`carry n=${n}`, "v0_7_0", `carry_n${n}`, `carry n=${n}: multicall(allow x n) [base] vs v0.8.0 + retireAccount() (caller-side)`, 0],
    [`carry n=${n} + retireAccount`, "v0_8_0", `carry_n${n}`, `carry n=${n}: multicall(allow x n) [base] vs v0.8.0 + retireAccount() (caller-side)`, 1],
  ]),
];
const est = {};
console.log("| Item | variant | anvil Prague receipt [M] | forge caller-side Prague / Amsterdam [M] | Amsterdam tx estimate [E] |");
console.log("|---|---|---|---|---|");
for (const [item, v, k, lab, idx] of rows) {
  const r = anv[v][k].gasUsed, p = P.get(lab)[idx], a = A.get(lab)[idx];
  const e = r + (a - p);
  est[`${v}:${k}`] = e;
  console.log(`| ${item} | ${v === "v0_7_0" ? "v0.7.0" : "v0.8.0"} | ${r.toLocaleString("en-US")} | ${p.toLocaleString("en-US")} / ${a.toLocaleString("en-US")} | ${e.toLocaleString("en-US")} |`);
}
for (const v of ["v0_7_0", "v0_8_0"]) {
  const c1 = est[`${v}:carry_n1`], c500 = est[`${v}:carry_n500`];
  const per = (c500 - c1) / 499, fixed = c1 - per;
  console.log(`- ${v}: Amsterdam carry per handle ~${per.toFixed(0)} [E]; max handles per transaction under the 2^24 cap ~${Math.floor((16_777_216 - fixed) / per)} [E]`);
}
