// link_deps.mjs: reuse the original clones' dependency folders in the Level 2 worktrees.
// Junctions for read-only dependency trees (node_modules, soldeer dependencies/), copies for
// generated files that our own runs rewrite (host-contracts/addresses/, sdk contracts remappings.txt),
// so nothing we run ever writes into the original clones.
// Usage: node link_deps.mjs <implDir> [worktree]   (a worktree name limits the run to that entry)
import fs from "node:fs";
import path from "node:path";

const impl = process.argv[2] && path.resolve(process.argv[2]); // absolute: a relative junction target resolves against the link
const only = process.argv[3];
if (!impl) { console.error("usage: node link_deps.mjs <implDir>"); process.exit(2); }

const plan = {
  "wt-l2-main": {
    from: "fhevm-main",
    junctions: [
      ["node_modules", "node_modules"],
      ["host-contracts/node_modules", "host-contracts/node_modules"],
      ["host-contracts/dependencies", "host-contracts/dependencies"],
      ["library-solidity/node_modules", "library-solidity/node_modules"],
      // library-solidity pins the same forge-std 1.11.0 (identical soldeer checksum) as host-contracts
      ["library-solidity/dependencies", "host-contracts/dependencies"],
      ["sdk/js-sdk/node_modules", "sdk/js-sdk/node_modules"],
      ["sdk/js-sdk/contracts/dependencies", "sdk/js-sdk/contracts/dependencies"],
    ],
    copies: [
      ["host-contracts/addresses", "host-contracts/addresses"],
      ["sdk/js-sdk/contracts/remappings.txt", "sdk/js-sdk/contracts/remappings.txt"],
    ],
  },
  "wt-l2-v0138": {
    from: "fhevm-v0.13.8",
    junctions: [
      ["node_modules", "node_modules"],
      ["host-contracts/node_modules", "host-contracts/node_modules"],
      ["host-contracts/dependencies", "host-contracts/dependencies"],
      ["library-solidity/node_modules", "library-solidity/node_modules"],
      ["library-solidity/dependencies", "host-contracts/dependencies"],
      ["sdk/js-sdk/node_modules", "sdk/js-sdk/node_modules"],
      ["sdk/js-sdk/contracts/dependencies", "sdk/js-sdk/contracts/dependencies"],
    ],
    copies: [
      ["host-contracts/addresses", "host-contracts/addresses"],
      ["sdk/js-sdk/contracts/remappings.txt", "sdk/js-sdk/contracts/remappings.txt"],
    ],
  },
  // Phase 4, P1.3: E2 on the v0.13 line (branch lifecycle/level3 of the v0.13.8 clone, from lifecycle/level2)
  "wt-l3-v0138": {
    from: "fhevm-v0.13.8",
    junctions: [
      ["node_modules", "node_modules"],
      ["host-contracts/node_modules", "host-contracts/node_modules"],
      ["host-contracts/dependencies", "host-contracts/dependencies"],
      ["library-solidity/node_modules", "library-solidity/node_modules"],
      ["library-solidity/dependencies", "host-contracts/dependencies"],
    ],
    copies: [
      ["host-contracts/addresses", "host-contracts/addresses"],
    ],
  },
  // Level 2 cleartext mock and SDK hygiene (branch lifecycle/level2-mock, from lifecycle/level2 on the v0.13 line)
  "wt-l2-mock": {
    from: "fhevm-v0.13.8",
    junctions: [
      ["node_modules", "node_modules"],
      ["host-contracts/node_modules", "host-contracts/node_modules"],
      ["host-contracts/dependencies", "host-contracts/dependencies"],
      ["library-solidity/node_modules", "library-solidity/node_modules"],
      ["library-solidity/dependencies", "host-contracts/dependencies"],
      ["sdk/js-sdk/node_modules", "sdk/js-sdk/node_modules"],
      ["sdk/js-sdk/contracts/dependencies", "sdk/js-sdk/contracts/dependencies"],
    ],
    copies: [
      ["host-contracts/addresses", "host-contracts/addresses"],
      ["sdk/js-sdk/contracts/remappings.txt", "sdk/js-sdk/contracts/remappings.txt"],
    ],
  },
  // Level 1, rule H9 (branch lifecycle/level1): the SDK unit tests only
  "wt-l1-h9": {
    from: "fhevm-main",
    junctions: [["sdk/js-sdk/node_modules", "sdk/js-sdk/node_modules"]],
    copies: [],
  },
  // Phase 4, P1.6 (branch lifecycle/phase4-sdk-status): the SDK unit tests and the local status run
  "wt-sdk-status": {
    from: "fhevm-main",
    junctions: [["sdk/js-sdk/node_modules", "sdk/js-sdk/node_modules"]],
    copies: [],
  },
};

for (const [wt, cfg] of Object.entries(plan)) {
  if (only && wt !== only) continue;
  const wtDir = path.join(impl, wt);
  const srcDir = path.join(impl, cfg.from);
  for (const [link, target] of cfg.junctions) {
    const l = path.join(wtDir, link);
    const t = path.join(srcDir, target);
    if (!fs.existsSync(t)) { console.log(`skip (no source) ${wt}/${link}`); continue; }
    if (fs.existsSync(l)) {
      const same = fs.realpathSync(l) === fs.realpathSync(t);
      console.log(`${same ? "ok" : "EXISTS(different)"} ${wt}/${link}`);
      continue;
    }
    fs.mkdirSync(path.dirname(l), { recursive: true });
    fs.symlinkSync(t, l, "junction");
    console.log(`junction ${wt}/${link} -> ${cfg.from}/${target}`);
  }
  for (const [dst, src] of cfg.copies) {
    const d = path.join(wtDir, dst);
    const s = path.join(srcDir, src);
    if (!fs.existsSync(s)) { console.log(`skip (no source) ${wt}/${dst}`); continue; }
    fs.cpSync(s, d, { recursive: true, force: true });
    console.log(`copy ${wt}/${dst} <- ${cfg.from}/${src}`);
  }
}
