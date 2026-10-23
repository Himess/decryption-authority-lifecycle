#!/usr/bin/env node
// =============================================================================
// analyze_build.mjs: static checks on the re-pointed cleartext mock build.
//
// Input: an "analysis build" of the clone's sdk/js-sdk/contracts made with the
// same profile and compiler as Zama's deploy, plus --ast (run_mock_e2e.sh step 5):
//     FOUNDRY_PROFILE=v13 forge build --skip test --ast --out <sdkOut> --cache-path <...>
//
// It does three things and nothing else:
//   1. From the compiled AST, lists the functions CleartextACL itself defines and
//      fails if it defines (overrides) any gated view or lifecycle function, in
//      particular persistAllowed and isHandleDelegatedForUserDecryption. It also
//      locates where the inherited definitions live (the re-pointed vendored ACL.sol).
//   2. Pins the source lines the report cites (CleartextACL.sol:236/239/257, the
//      CleartextKMSVerifier calls, the retirement gates in the re-pointed ACL.sol).
//   3. Writes a compact bundle for the e2e test: deployed bytecode, source map,
//      immutable references and source-id -> path for CleartextACL and
//      CleartextKMSVerifier, so the test can (a) check that the deployed
//      implementation IS this build and (b) map a runtime REVERT pc to file:line.
//
// Usage: node analyze_build.mjs --sdk-out <dir> --clone <fhevm clone> --bundle <json> --report <txt>
// =============================================================================
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
for (const k of ['sdk-out', 'clone', 'bundle', 'report']) if (!args[k]) throw new Error(`missing --${k}`);
const SDK_OUT = args['sdk-out'];
const CLONE = args.clone;
const CONTRACTS_ROOT = join(CLONE, 'sdk', 'js-sdk', 'contracts');

const TARGETS = {
  CleartextACL: 'src/v0.13.0/cleartext/CleartextACL.sol',
  CleartextKMSVerifier: 'src/v0.13.0/cleartext/CleartextKMSVerifier.sol',
  ACL: 'src/v0.13.0/host-contracts/contracts/ACL.sol',
};
// Functions CleartextACL must NOT define itself: the gated views and lifecycle surface
// of the base ACL (they must be inherited unchanged from the re-pointed ACL v0.4.1).
const MUST_BE_INHERITED = [
  'persistAllowed',
  'isHandleDelegatedForUserDecryption',
  'isAllowed',
  'getUserDecryptionDelegationExpirationDate',
  'delegateForUserDecryption',
  'retireAccount',
  'isAccountRetired',
  'supportsInterface',
  'retirementStorageLocation',
  '_authorizeUpgrade',
  '_retired',
];

const lines = [];
const out = (s = '') => lines.push(s);
const pinFailsEarly = [];

// ---------------------------------------------------------------------------
function walk(dir) {
  const res = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'build-info') res.push(...walk(p));
    } else if (name.endsWith('.json')) res.push(p);
  }
  return res;
}
const artifacts = {};
for (const f of walk(SDK_OUT)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const target = j.metadata?.settings?.compilationTarget ?? {};
  for (const [name, path] of Object.entries(TARGETS)) {
    if (target[path] === name) artifacts[name] = { file: f, json: j };
  }
}
for (const name of Object.keys(TARGETS)) {
  if (!artifacts[name]) throw new Error(`artifact for ${name} (${TARGETS[name]}) not found under ${SDK_OUT}`);
}

// build-info whose source_id_to_path maps the artifact id to its own source
const buildInfos = readdirSync(join(SDK_OUT, 'build-info')).map((f) => JSON.parse(readFileSync(join(SDK_OUT, 'build-info', f), 'utf8')));
function sourceIdToPathFor(art, path) {
  const bi = buildInfos.find((b) => b.source_id_to_path?.[String(art.json.id)] === path);
  if (!bi) throw new Error(`no build-info maps id ${art.json.id} to ${path}`);
  return bi.source_id_to_path;
}

// byte offset -> 1-based line, on the file's bytes (sources contain non-ASCII comments)
const fileCache = new Map();
function fileBytes(relPath) {
  if (!fileCache.has(relPath)) fileCache.set(relPath, readFileSync(join(CONTRACTS_ROOT, relPath)));
  return fileCache.get(relPath);
}
function lineOf(relPath, offset) {
  const b = fileBytes(relPath);
  let n = 1;
  for (let i = 0; i < offset && i < b.length; i++) if (b[i] === 0x0a) n++;
  return n;
}
function lineText(relPath, line) {
  return fileBytes(relPath).toString('utf8').split('\n')[line - 1] ?? '';
}

// ---------------------------------------------------------------------------
// 1. AST: functions defined by CleartextACL itself
// ---------------------------------------------------------------------------
const cacl = artifacts.CleartextACL.json;
if (!cacl.ast) throw new Error('CleartextACL artifact has no AST: build with --ast');
const caclIds = sourceIdToPathFor(artifacts.CleartextACL, TARGETS.CleartextACL);
const contractNode = cacl.ast.nodes.find((n) => n.nodeType === 'ContractDefinition' && n.name === 'CleartextACL');
const own = contractNode.nodes
  .filter((n) => n.nodeType === 'FunctionDefinition')
  .map((n) => {
    const [start, , fileId] = n.src.split(':').map(Number);
    return {
      name: n.name || `<${n.kind}>`,
      kind: n.kind,
      visibility: n.visibility,
      stateMutability: n.stateMutability,
      virtual: !!n.virtual,
      overrides: !!n.overrides,
      line: lineOf(caclIds[String(fileId)], start),
    };
  });
const ownNames = new Set(own.map((f) => f.name));
const violations = MUST_BE_INHERITED.filter((n) => ownNames.has(n));

out('# Static checks on the re-pointed cleartext mock build');
out(`# generated ${new Date().toISOString()} from ${relative(CLONE, SDK_OUT) || SDK_OUT}`);
out(`# solc ${cacl.metadata.compiler.version}; optimizer ${JSON.stringify(cacl.metadata.settings.optimizer)}; evmVersion ${cacl.metadata.settings.evmVersion}`);
out();
out('## 1. Functions defined by CleartextACL itself (src/v0.13.0/cleartext/CleartextACL.sol), from the compiled AST');
for (const f of own) {
  out(`  - ${f.name.padEnd(36)} line ${String(f.line).padStart(3)}  ${f.visibility} ${f.stateMutability}${f.overrides ? ' override' : ''}${f.virtual ? ' virtual' : ''}`);
}
out();
out(`Must be inherited (not defined in CleartextACL): ${MUST_BE_INHERITED.join(', ')}`);
out(`RESULT: ${violations.length === 0 ? 'PASS, CleartextACL overrides none of them' : 'FAIL, CleartextACL defines: ' + violations.join(', ')}`);

// where the inherited definitions live
const baseIds = cacl.ast.nodes
  .filter((n) => n.nodeType === 'ContractDefinition' && n.name === 'CleartextACL')[0]
  .linearizedBaseContracts;
const aclArt = artifacts.ACL.json;
const aclIds = sourceIdToPathFor(artifacts.ACL, TARGETS.ACL);
const aclNode = aclArt.ast.nodes.find((n) => n.nodeType === 'ContractDefinition' && n.name === 'ACL');
out();
out(`CleartextACL linearized bases (AST ids): ${baseIds.join(' -> ')}; ACL contract AST id ${aclNode.id} ${baseIds.includes(aclNode.id) ? '(present)' : '(MISSING)'}`);
const inheritedDefs = {};
for (const name of MUST_BE_INHERITED) {
  const fn = aclNode.nodes.find((n) => n.nodeType === 'FunctionDefinition' && n.name === name);
  if (fn) {
    const [start, , fileId] = fn.src.split(':').map(Number);
    inheritedDefs[name] = `${aclIds[String(fileId)]}:${lineOf(aclIds[String(fileId)], start)}`;
    out(`  inherited ${name.padEnd(42)} defined at ${inheritedDefs[name]}`);
  } else {
    out(`  inherited ${name.padEnd(42)} NOT FOUND in ACL`);
  }
}
const abiNames = new Set(cacl.abi.filter((e) => e.type === 'function').map((e) => e.name));
const surface = ['persistAllowed', 'isHandleDelegatedForUserDecryption', 'retireAccount', 'isAccountRetired', 'supportsInterface', 'retirementStorageLocation', 'multicall'];
out(`CleartextACL ABI exposes: ${surface.map((n) => `${n}=${abiNames.has(n)}`).join(', ')}`);
// Every `revert <Error>(...)` statement in CleartextACL.sol, from the AST. The three decryption
// errors are declared in CleartextACL, so no base contract can raise them; a unique site per
// error lets the e2e test tie a runtime revert (by its selector) to one source line.
const raiseSites = {};
(function walkAst(n) {
  if (!n || typeof n !== 'object') return;
  if (n.nodeType === 'RevertStatement' && n.errorCall?.expression) {
    const name = n.errorCall.expression.name ?? n.errorCall.expression.memberName;
    const [start, , fileId] = n.src.split(':').map(Number);
    const path = caclIds[String(fileId)];
    (raiseSites[name] ??= []).push(`${path}:${lineOf(path, start)}`);
  }
  for (const v of Object.values(n)) {
    if (Array.isArray(v)) v.forEach(walkAst);
    else if (v && typeof v === 'object') walkAst(v);
  }
})(cacl.ast);
out();
out('Revert statements in CleartextACL.sol (AST), per error:');
for (const [name, sites] of Object.entries(raiseSites)) out(`  ${name.padEnd(38)} ${sites.join(', ')}`);
for (const e of ['UserNotAuthorizedForDecrypt', 'ContractNotAuthorizedForDecrypt', 'HandleNotDelegatedForUserDecryption']) {
  if ((raiseSites[e] ?? []).length !== 1) {
    pinFailsEarly.push(`${e} has ${(raiseSites[e] ?? []).length} raise sites`);
  }
}
const errNames = new Set(cacl.abi.filter((e) => e.type === 'error').map((e) => e.name));
out(`CleartextACL ABI errors: SenderRetired=${errNames.has('SenderRetired')}, AccountAlreadyRetired=${errNames.has('AccountAlreadyRetired')}, UpgradeDropsRetirement=${errNames.has('UpgradeDropsRetirement')}`);
const evNames = new Set(cacl.abi.filter((e) => e.type === 'event').map((e) => e.name));
out(`CleartextACL ABI events: AccountRetired=${evNames.has('AccountRetired')}`);

// ---------------------------------------------------------------------------
// 2. Line pins
// ---------------------------------------------------------------------------
const pins = [
  [TARGETS.CleartextACL, 222, /function plaintextForUserDecryption\(/],
  [TARGETS.CleartextACL, 236, /if \(!persistAllowed\(h, userAddress\)\)/],
  [TARGETS.CleartextACL, 237, /revert UserNotAuthorizedForDecrypt\(h, userAddress\)/],
  [TARGETS.CleartextACL, 239, /if \(!persistAllowed\(h, c\)\)/],
  [TARGETS.CleartextACL, 240, /revert ContractNotAuthorizedForDecrypt\(h, c\)/],
  [TARGETS.CleartextACL, 246, /function plaintextForDelegatedUserDecryption\(/],
  [TARGETS.CleartextACL, 257, /if \(!isHandleDelegatedForUserDecryption\(delegator, delegate, c, h\)\)/],
  [TARGETS.CleartextACL, 258, /revert HandleNotDelegatedForUserDecryption\(h, c, delegator, delegate\)/],
  [TARGETS.CleartextKMSVerifier, 225, /function userDecrypt\(/],
  [TARGETS.CleartextKMSVerifier, 246, /CleartextACL\(aclAdd\)\.plaintextForUserDecryption\(pairs, userAddress\)/],
  [TARGETS.CleartextKMSVerifier, 263, /function delegatedUserDecrypt\(/],
  [TARGETS.CleartextKMSVerifier, 286, /CleartextACL\(aclAdd\)\.plaintextForDelegatedUserDecryption\(pairs, delegator, delegate\)/],
  [TARGETS.CleartextKMSVerifier, 252, /_verifySignature\(/],
  [TARGETS.ACL, 571, /function isHandleDelegatedForUserDecryption\(/],
  [TARGETS.ACL, 578, /\$r\.retired\[delegator\] \|\| \$r\.retired\[delegate\] \|\| \$r\.retired\[contractAddress\]/],
  [TARGETS.ACL, 597, /function persistAllowed\(bytes32 handle, address account\)/],
  [TARGETS.ACL, 599, /persistedAllowedPairs\[handle\]\[account\] && !_retired\(\)\.retired\[account\]/],
  [TARGETS.ACL, 542, /function isAllowed\(bytes32 handle, address account\)/],
  [TARGETS.ACL, 543, /msg\.sender != FHEVM_EXECUTOR_ADDRESS && _retired\(\)\.retired\[account\]/],
  [TARGETS.ACL, 258, /revert SenderRetired\(msg\.sender\)/],
  [TARGETS.ACL, 346, /revert SenderRetired\(msg\.sender\)/],
  [TARGETS.ACL, 443, /function retireAccount\(\)/],
  [TARGETS.ACL, 446, /revert AccountAlreadyRetired\(msg\.sender\)/],
];
let pinFails = 0;
out();
out('## 2. Line pins in the re-pointed build (sdk/js-sdk/contracts/...)');
for (const [path, line, re] of pins) {
  const t = lineText(path, line);
  const ok = re.test(t);
  if (!ok) pinFails++;
  out(`  ${ok ? 'ok  ' : 'FAIL'} ${path}:${line}  ${t.trim()}`);
}
out(`RESULT: ${pinFails === 0 ? 'PASS, all pinned lines hold' : `FAIL, ${pinFails} pinned line(s) moved`}`);

// SDK side of the same path (sdk/js-sdk/src, this clone's SDK)
const SDK_SRC = join(CLONE, 'sdk', 'js-sdk', 'src');
const sdkPins = [
  ['core/actions/decrypt/decryptValue.ts', 47, /decryptValuesFromPairs_\(fhevm, \{/],
  ['core/actions/decrypt/decryptValues.ts', 49, /decryptValuesFromPairs_\(fhevm, \{/],
  ['core/kms/decryptValuesFromPairs.ts', 65, /fetchKmsSigncryptedSharesV1\(fhevm, parameters\)/],
  ['core/kms/fetchKmsSigncryptedSharesV1-p.ts', 125, /7\. Check: ACL permissions/],
  ['core/kms/fetchKmsSigncryptedSharesV1-p.ts', 127, /await checkDelegation\(context, \{/],
  ['core/kms/fetchKmsSigncryptedSharesV1-p.ts', 134, /await checkPersistAllowed\(context, \{/],
  ['core/kms/fetchKmsSigncryptedSharesV1-p.ts', 161, /context\.runtime\.relayer\.fetchDelegatedUserDecrypt\(context, \{/],
  ['core/kms/fetchKmsSigncryptedSharesV1-p.ts', 173, /context\.runtime\.relayer\.fetchUserDecrypt\(context, \{/],
  ['core/host-contracts/checkPersistAllowed.ts', 79, /await persistAllowed\(context, \{/],
  ['core/host-contracts/checkPersistAllowed.ts', 100, /throw new AclUserDecryptionError\(\{/],
  ['core/host-contracts/checkPersistAllowed.ts', 102, /User \$\{userAddress\} is not authorized to decrypt handle/],
  ['core/host-contracts/checkPersistAllowed.ts', 109, /throw new AclUserDecryptionError\(\{/],
  ['core/host-contracts/checkPersistAllowed.ts', 111, /Dapp contract \$\{pair\.contractAddress\} is not authorized/],
  ['core/host-contracts/persistAllowed.ts', 56, /context\.runtime\.ethereum\.readContract\(trustedClient, \{/],
  ['core/host-contracts/checkDelegation.ts', 100, /await isHandleDelegatedForUserDecryption\(context, \{/],
  ['core/host-contracts/checkDelegation.ts', 123, /throw new AclUserDecryptionError\(\{/],
  ['core/host-contracts/isHandleDelegatedForUserDecryption-p.ts', 65, /context\.runtime\.ethereum\.readContract\(trustedClient, \{/],
  ['ethers/internal/runtime-ct.ts', 20, /cleartextRelayerModule\(\)/],
  ['core/modules/relayer/cleartext/mock.ts', 50, /fetchUserDecrypt,/],
  ['core/modules/relayer/cleartext/mock.ts', 51, /fetchDelegatedUserDecrypt,/],
  ['core/modules/relayer/cleartext/fetchUserDecrypt.ts', 14, /fetchUserDecryptV1\(relayerClient, parameters\)/],
  ['core/modules/relayer/cleartext/fetchUserDecryptV1.ts', 188, /isForgeFhevmV1\(relayerClient, fhevmContext\)/],
  ['core/modules/relayer/cleartext/fetchUserDecryptV1.ts', 194, /runUserDecryptOnChain\(relayerClient, payload\)/],
  ['core/modules/relayer/cleartext/fetchUserDecryptV1.ts', 132, /relayerClient\.runtime\.ethereum\.readContract\(trustedClient, \{/],
  ['core/modules/relayer/cleartext/fetchUserDecryptV1.ts', 134, /contracts\.kmsVerifier\.address/],
  ['core/modules/relayer/cleartext/fetchDelegatedUserDecryptV1.ts', 194, /isForgeFhevmV1\(relayerClient, fhevmContext\)/],
  ['core/modules/relayer/cleartext/fetchDelegatedUserDecryptV1.ts', 200, /runDelegatedUserDecryptOnChain\(relayerClient, payload\)/],
  ['core/modules/relayer/cleartext/fetchDelegatedUserDecryptV1.ts', 137, /relayerClient\.runtime\.ethereum\.readContract\(trustedClient, \{/],
  ['core/modules/relayer/cleartext/fetchDelegatedUserDecryptV1.ts', 139, /contracts\.kmsVerifier\.address/],
  ['core/modules/relayer/cleartext/forgeFhevmV1.ts', 53, /signers\.length === 1 && isForgeFhevmV1KmsSigner/],
];
out();
out('## 2b. Line pins on the SDK side (sdk/js-sdk/src/...)');
const sdkText = (p) => readFileSync(join(SDK_SRC, p), 'utf8').split('\n');
for (const [path, line, re] of sdkPins) {
  const t = sdkText(path)[line - 1] ?? '';
  const ok = re.test(t);
  if (!ok) pinFails++;
  out(`  ${ok ? 'ok  ' : 'FAIL'} ${path}:${line}  ${t.trim()}`);
}
out(`RESULT: ${pinFails === 0 ? 'PASS, all pinned lines hold (contracts and SDK)' : `FAIL, ${pinFails} pinned line(s) moved`}`);

// ---------------------------------------------------------------------------
// 3. Bundle for the e2e test
// ---------------------------------------------------------------------------
function bundleOf(name) {
  const a = artifacts[name].json;
  return {
    target: TARGETS[name],
    artifact: relative(SDK_OUT, artifacts[name].file).split(sep).join('/'),
    deployedBytecode: a.deployedBytecode.object,
    sourceMap: a.deployedBytecode.sourceMap,
    immutableReferences: a.deployedBytecode.immutableReferences ?? {},
    sourceIdToPath: sourceIdToPathFor(artifacts[name], TARGETS[name]),
  };
}
const bundle = {
  generatedAt: new Date().toISOString(),
  solc: cacl.metadata.compiler.version,
  contractsRoot: CONTRACTS_ROOT,
  CleartextACL: bundleOf('CleartextACL'),
  CleartextKMSVerifier: bundleOf('CleartextKMSVerifier'),
  overrideCheck: { ownFunctions: own, mustBeInherited: MUST_BE_INHERITED, violations, inheritedDefs },
  raiseSites,
  pinFails,
  uniqueRaiseSiteFailures: pinFailsEarly,
};
if (pinFailsEarly.length) out(`RESULT: FAIL, ${pinFailsEarly.join('; ')}`);
else out('RESULT: PASS, each decryption error has exactly one revert statement in CleartextACL.sol');
writeFileSync(args.bundle, JSON.stringify(bundle, null, 1));
writeFileSync(args.report, lines.join('\n') + '\n');
console.log(lines.join('\n'));
if (violations.length || pinFails || pinFailsEarly.length) process.exit(1);
