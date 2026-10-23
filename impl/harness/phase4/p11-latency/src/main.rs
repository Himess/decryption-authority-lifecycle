//! Phase 4, P1.1: per-request signature-check latency of the KDA route (E3), ECDSA and the ERC-1271 budget path, with
//! the Level 3 crate, against a local anvil. The same binary runs on M1 and on the VPS.
//!
//! Usage:
//!   p11-latency <rpc_url> <artifacts_dir> <f1600_hex> <python> <mldsa_tool.py> <p11_mldsa_tool.py> <checkout> <n> <out.json>
//!
//! It deploys E4's ML-DSA-44 ERC-1271 account (the Fireblocks verifier, unaudited) on the anvil, prepares one request
//! digest and the signatures (an ECDSA key, the account's ML-DSA-44 key, and an ML-DSA-44/65/87 key per KDA), then
//! times each verifier entry point `n` times after 3 warm-up calls. Every RPC goes to the given local node. The keys
//! come from public test seeds (keccak256 of a label) and are passed to the signer tools through their environment.

use alloy::{
    hex,
    network::TransactionBuilder,
    primitives::{Address, B256, Bytes, keccak256},
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::{SignerSync, local::PrivateKeySigner},
    sol_types::SolValue,
};
use serde_json::{Value, json};
use std::{path::PathBuf, process::Command, time::Instant};
use user_decryption_signature::{
    AttemptState, CodeFirstMode, SignatureInput, SignaturePolicy,
    kda::{
        K8Mode, KdaOutcome, KdaScheme, MlDsaImpl, key_derived_address, request_signature, verify_native_k8,
        verify_with_kda_k8,
    },
    verify_signature, verify_user_decryption_signature,
};

const F1600_CODEHASH: &str = "0x4afb4435879cdf8e50474c7aab2bc3a679caed432550ad6dba64f509309a817b";
const E4_SEED_LABEL: &[u8] = b"fhe-authority-lifecycle/E4/local-test-seed/v1";
const P11_SEED_LABEL: &str = "fhe-authority-lifecycle/P1.1/local-test-seed/v1/";
/// The account a KDA request names as owner (not read: the delegation is not part of the signature check).
const ACCOUNT: Address = Address::repeat_byte(0xaa);

struct Tools {
    py: String,
    e4: PathBuf,
    p11: PathBuf,
    repo: PathBuf,
}

impl Tools {
    fn run(&self, tool: &PathBuf, seed_var: &str, seed: B256, args: &[&str]) -> Value {
        let out = Command::new(&self.py)
            .arg("-I")
            .arg("-B")
            .arg(tool)
            .arg("--repo")
            .arg(&self.repo)
            .args(args)
            .env_clear()
            .env("PATH", std::env::var("PATH").unwrap_or_default())
            .env("SYSTEMROOT", std::env::var("SYSTEMROOT").unwrap_or_default())
            .env(seed_var, hex::encode(seed))
            .output()
            .expect("signer tool");
        assert!(out.status.success(), "{}: {}", args[0], String::from_utf8_lossy(&out.stderr));
        serde_json::from_slice(&out.stdout).expect("tool JSON")
    }
}

fn hexfield(v: &Value, k: &str) -> Vec<u8> {
    hex::decode(v[k].as_str().unwrap_or_else(|| panic!("{k} missing"))).unwrap()
}

async fn deploy<P: Provider>(provider: &P, from: Address, code: Vec<u8>) -> Address {
    let tx = TransactionRequest::default().with_from(from).with_deploy_code(Bytes::from(code)).with_gas_limit(16_000_000);
    let receipt = provider.send_transaction(tx).await.unwrap().get_receipt().await.unwrap();
    assert!(receipt.status(), "deployment reverted");
    receipt.contract_address.expect("contract address")
}

fn artifact(dir: &PathBuf, name: &str) -> Vec<u8> {
    let v: Value = serde_json::from_str(&std::fs::read_to_string(dir.join(format!("{name}.json"))).unwrap()).unwrap();
    hex::decode(v["bytecode"]["object"].as_str().unwrap().trim_start_matches("0x")).unwrap()
}

fn input(signer: Address, digest: B256, signature: &[u8]) -> SignatureInput<'_> {
    SignatureInput { signer, digest, signature, public_key_len: 800, extra_data_len: 1 }
}

struct Stats {
    p50: u128,
    p95: u128,
    mean: u128,
    min: u128,
}

fn stats(mut v: Vec<u128>) -> Stats {
    v.sort_unstable();
    let n = v.len();
    Stats { p50: v[n / 2], p95: v[(n * 95 / 100).min(n - 1)], mean: v.iter().sum::<u128>() / n as u128, min: v[0] }
}

macro_rules! time_it {
    ($n:expr, $body:expr) => {{
        for _ in 0..3 {
            let _ = $body.await;
        }
        let mut t = Vec::with_capacity($n);
        let mut last = None;
        for _ in 0..$n {
            let s = Instant::now();
            let r = $body.await;
            t.push(s.elapsed().as_micros());
            last = Some(r);
        }
        (stats(t), last.unwrap())
    }};
}

#[tokio::main]
async fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (url, arts, f1600, n, out) = (&a[1], PathBuf::from(&a[2]), &a[3], a[9].parse::<usize>().unwrap(), &a[10]);
    let tools = Tools { py: a[4].clone(), e4: a[5].clone().into(), p11: a[6].clone().into(), repo: a[7].clone().into() };
    let _ = &a[8];
    let provider = ProviderBuilder::new().connect_http(url.parse().unwrap());
    let client: String = provider.raw_request("web3_clientVersion".into(), ()).await.unwrap();
    let funder = provider.get_accounts().await.unwrap()[0];

    // E4's ML-DSA-44 ERC-1271 account: helper (pinned code), verifier, public-key blob, account.
    let helper_hex: String = std::fs::read_to_string(f1600).unwrap().split_whitespace().collect();
    let helper_code = hex::decode(helper_hex.trim_start_matches("0x")).unwrap();
    assert_eq!(keccak256(&helper_code).to_string(), F1600_CODEHASH, "f1600 helper does not match the verifier's pin");
    let helper = Address::from_slice(&keccak256(b"p11-latency helper")[..20]);
    let _: Value = provider.raw_request("anvil_setCode".into(), (helper, Bytes::from(helper_code))).await.unwrap();
    let mut code = artifact(&arts, "MLDSA44Verifier");
    code.extend(helper.abi_encode());
    let verifier = deploy(&provider, funder, code).await;
    let e4_seed = keccak256(E4_SEED_LABEL);
    let pk = tools.run(&tools.e4, "MLDSA44_SEED_HEX", e4_seed, &["pubkey"]);
    let (pk44, blob) = (hexfield(&pk, "pk"), hexfield(&pk, "blob"));
    let pk_blob = Address::from_slice(&keccak256(b"p11-latency pk blob")[..20]);
    let _: Value = provider.raw_request("anvil_setCode".into(), (pk_blob, Bytes::from(blob))).await.unwrap();
    let mut code = artifact(&arts, "MLDSA44Account1271");
    code.extend((verifier, pk_blob, keccak256(&pk44)).abi_encode_params());
    let account = deploy(&provider, funder, code).await;

    let digest = keccak256(b"p11-latency request digest");
    let ecdsa_key = PrivateKeySigner::from_bytes(&keccak256(b"p11-latency ecdsa test key")).unwrap();
    let ecdsa_sig = ecdsa_key.sign_hash_sync(&digest).unwrap().as_bytes().to_vec();
    let e4_sig = hexfield(&tools.run(&tools.e4, "MLDSA44_SEED_HEX", e4_seed, &["sign", "--msg", &digest.to_string()]), "sig");
    let enforce = SignaturePolicy { mode: CodeFirstMode::Enforce, ..SignaturePolicy::default() };
    let mut rows = Vec::new();
    let mut push = |case: &str, path: &str, rpcs: u32, ok: bool, s: Stats| {
        println!("{case:46} {path:34} rpcs={rpcs} ok={ok} p50={}us p95={}us mean={}us min={}us", s.p50, s.p95, s.mean, s.min);
        rows.push(json!({"case": case, "path": path, "rpcs": rpcs, "ok": ok, "n": n,
            "p50_us": s.p50, "p95_us": s.p95, "mean_us": s.mean, "min_us": s.min}));
    };

    let (s, r) = time_it!(n, verify_signature(&provider, ecdsa_key.address(), digest, &ecdsa_sig, 250_000));
    push("ecdsa, unmodified (RFC-012)", "ecrecover", 0, r.is_ok(), s);
    let (s, r) = time_it!(n, verify_user_decryption_signature(&provider, &input(ecdsa_key.address(), digest, &ecdsa_sig), &enforce, AttemptState::default()));
    push("ecdsa, Profile H enforce", "code read + ecrecover", 2, r.result.is_ok(), s);
    let (s, r) = time_it!(n, verify_signature(&provider, account, digest, &e4_sig, 250_000));
    push("erc1271 ML-DSA-44 account, unmodified 250k", "isValidSignature at 250,000", 1, r.is_ok(), s);
    let (s, r) = time_it!(n, verify_user_decryption_signature(&provider, &input(account, digest, &e4_sig), &enforce, AttemptState::default()));
    push("erc1271 ML-DSA-44 account, Profile H B_exec 2M", "code read + isValidSignature", 3, r.result.is_ok(), s);

    for scheme in KdaScheme::ALL {
        let seed = keccak256(format!("{P11_SEED_LABEL}{}/latency", scheme.name()));
        let pk = hexfield(&tools.run(&tools.p11, "MLDSA_SEED_HEX", seed, &["pubkey", "--scheme", scheme.name()]), "pk");
        let sig = hexfield(&tools.run(&tools.p11, "MLDSA_SEED_HEX", seed, &["sign", "--scheme", scheme.name(), "--msg", &digest.to_string()]), "sig");
        let signer_bytes = scheme.signer_bytes(&pk);
        let kda = key_derived_address(&signer_bytes);
        let field = request_signature(&signer_bytes, &sig);
        for mode in [K8Mode::Single(MlDsaImpl::RustCrypto), K8Mode::Agree(MlDsaImpl::RustCrypto, MlDsaImpl::Fips204)] {
            let (s, r) = time_it!(n, verify_with_kda_k8(&provider, &input(kda, digest, &field), &[ACCOUNT], &enforce, &KdaScheme::ALL, mode, AttemptState::default()));
            push(&format!("kda {} {mode}", scheme.name()), "code read + native verify", 1, r == KdaOutcome::Kda(Ok(scheme)), s);
        }
        for imp in MlDsaImpl::ALL {
            let (s, r) = time_it!(n, async { verify_native_k8(K8Mode::Single(imp), scheme, &pk, digest.as_slice(), &sig) });
            push(&format!("native {} {imp}", scheme.name()), "no RPC", 0, r.is_ok(), s);
        }
    }
    let doc = json!({"client": client, "rpc": "local anvil", "iterations": n, "warmup": 3,
        "os": std::env::consts::OS, "arch": std::env::consts::ARCH, "account": account.to_string(), "rows": rows});
    std::fs::write(out, serde_json::to_string_pretty(&doc).unwrap()).unwrap();
}
