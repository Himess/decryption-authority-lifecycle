//! udsig-h: drives the Level 1 `user-decryption-signature` crate (zama-ai/fhevm main ed851716c + lifecycle/level1)
//! from the command line, so the Profile H evidence runs the exact verification code against a local anvil node.
//!
//! Commands (one JSON object on stdout):
//!
//!   udsig-h digest
//!       stdin: {"chainId":u64,"gateway":addr,"userAddress":addr,"publicKey":hex,"allowedContracts":[addr],
//!               "startTimestamp":u64,"durationSeconds":u64,"extraData":hex}
//!       -> {"digest": hex}
//!
//!   udsig-h verify-legacy <rpc_url> <signer> <digest> <gas_limit>
//!       The UNCHANGED `verify_signature` (RFC-012 ordering, caller-supplied gas cap). stdin: signature hex.
//!
//!   udsig-h verify-h <rpc_url> <signer> <digest> <off|shadow|enforce> <b_exec> <fallback 0|1>
//!                    <negatives> <last_negative_block|-> <public_key_len> <extra_data_len>
//!       The Profile H entry point `verify_user_decryption_signature`. stdin: signature hex.
//!
//! Signatures go through stdin so they never appear in argv or logs. The tool never holds keys.

use std::io::Read;
use std::time::Instant;

use alloy::primitives::{Address, B256, Bytes, U256};
use alloy::providers::ProviderBuilder;
use fhevm_gateway_bindings::decryption::IDecryption::{RequestValiditySeconds, UserDecryptionRequestPayload};
use serde_json::{Value, json};
use user_decryption_signature::{
    AttemptState, CodeFirstMode, Erc1271Error, SignatureInput, SignaturePolicy, VerdictSummary,
    compute_user_decrypt_digest, default_user_decrypt_domain, verify_signature, verify_user_decryption_signature,
};

fn read_stdin() -> String {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s).expect("stdin");
    s.trim().to_string()
}

fn hex_bytes(s: &str) -> Vec<u8> {
    let t = s.trim().trim_start_matches("0x");
    if t.is_empty() {
        return Vec::new();
    }
    (0..t.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&t[i..i + 2], 16).expect("hex"))
        .collect()
}

fn variant(e: &Erc1271Error) -> &'static str {
    match e {
        Erc1271Error::EoaMismatchNoCode(_) => "EoaMismatchNoCode",
        Erc1271Error::EmptySigOnEoa(_) => "EmptySigOnEoa",
        Erc1271Error::WrongMagic(_, _) => "WrongMagic",
        Erc1271Error::Rejected(_, _) => "Rejected",
        Erc1271Error::EmptyRevert(_) => "EmptyRevert",
        Erc1271Error::Transport(_) => "Transport",
        Erc1271Error::CapExceeded { .. } => "CapExceeded",
        Erc1271Error::EmptyReturn(_) => "EmptyReturn",
        Erc1271Error::AwaitingNextBlock { .. } => "AwaitingNextBlock",
        Erc1271Error::AttemptsExhausted { .. } => "AttemptsExhausted",
    }
}

fn verdict(v: &VerdictSummary) -> Value {
    match v {
        VerdictSummary::Accept(p) => json!({"accept": format!("{p:?}")}),
        VerdictSummary::Reject(e) => json!({"reject": variant(e)}),
        VerdictSummary::Unknown(e) => json!({"unknown": variant(e)}),
    }
}

fn cmd_digest() -> Value {
    let v: Value = serde_json::from_str(&read_stdin()).expect("json on stdin");
    let addr = |k: &str| v[k].as_str().expect(k).parse::<Address>().expect(k);
    let u = |k: &str| v[k].as_u64().expect(k);
    let payload = UserDecryptionRequestPayload {
        userAddress: addr("userAddress"),
        publicKey: Bytes::from(hex_bytes(v["publicKey"].as_str().expect("publicKey"))),
        allowedContracts: v["allowedContracts"]
            .as_array()
            .expect("allowedContracts")
            .iter()
            .map(|a| a.as_str().unwrap().parse::<Address>().unwrap())
            .collect(),
        requestValidity: RequestValiditySeconds {
            startTimestamp: U256::from(u("startTimestamp")),
            durationSeconds: U256::from(u("durationSeconds")),
        },
        extraData: Bytes::from(hex_bytes(v["extraData"].as_str().expect("extraData"))),
        signature: Bytes::default(),
    };
    let domain = default_user_decrypt_domain(u("chainId"), addr("gateway"));
    json!({ "digest": format!("{}", compute_user_decrypt_digest(&payload, &domain)) })
}

async fn cmd_verify_legacy(args: &[String]) -> Value {
    let provider = ProviderBuilder::new().connect_http(args[0].parse().expect("rpc url"));
    let signer: Address = args[1].parse().expect("signer");
    let digest: B256 = args[2].parse().expect("digest");
    let gas_limit: u64 = args[3].parse().expect("gas limit");
    let sig = hex_bytes(&read_stdin());
    let t0 = Instant::now();
    let res = verify_signature(&provider, signer, digest, &sig, gas_limit).await;
    let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
    match res {
        Ok(()) => json!({"fn": "verify_signature", "ok": true, "signature_len": sig.len(), "gas_limit": gas_limit, "elapsed_ms": elapsed_ms}),
        Err(e) => json!({"fn": "verify_signature", "ok": false, "variant": variant(&e), "error": e.to_string(), "signature_len": sig.len(), "gas_limit": gas_limit, "elapsed_ms": elapsed_ms}),
    }
}

async fn cmd_verify_h(args: &[String]) -> Value {
    let provider = ProviderBuilder::new().connect_http(args[0].parse().expect("rpc url"));
    let signer: Address = args[1].parse().expect("signer");
    let digest: B256 = args[2].parse().expect("digest");
    let mode: CodeFirstMode = args[3].parse().expect("mode");
    let b_exec: u64 = args[4].parse().expect("b_exec");
    let fallback = args[5] == "1";
    let attempts = AttemptState {
        negatives: args[6].parse().expect("negatives"),
        last_negative_block: if args[7] == "-" { None } else { Some(args[7].parse().expect("block")) },
    };
    let public_key_len: usize = args[8].parse().expect("public_key_len");
    let extra_data_len: usize = args[9].parse().expect("extra_data_len");
    let sig = hex_bytes(&read_stdin());
    let policy = SignaturePolicy {
        mode,
        erc1271_execution_budget: b_exec,
        eip7702_fallback: fallback,
        ..SignaturePolicy::default()
    };
    let input = SignatureInput { signer, digest, signature: &sig, public_key_len, extra_data_len };
    let t0 = Instant::now();
    let out = verify_user_decryption_signature(&provider, &input, &policy, attempts).await;
    let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
    let shadow = out.shadow().map(|s| {
        json!({"served": verdict(&s.served), "code_first": verdict(&s.code_first), "would_reject": s.would_reject(), "would_accept": s.would_accept(), "code": s.code.map(|c| format!("{c:?}"))})
    });
    let attempts_out = json!({"negatives": out.attempts.negatives, "last_negative_block": out.attempts.last_negative_block});
    let common = json!({
        "fn": "verify_user_decryption_signature", "mode": mode.as_str(), "b_exec": b_exec, "fallback": fallback,
        "gas_limit_formula": policy.erc1271_gas_limit(4 + 32 + 32 + 32 + sig.len().div_ceil(32) * 32),
        "signature_len": sig.len(), "elapsed_ms": elapsed_ms, "attempts": attempts_out, "shadow": shadow,
    });
    let mut v = match out.result {
        Ok(ok) => json!({"ok": true, "path": format!("{:?}", ok.path), "block": ok.block, "code": ok.code.map(|c| format!("{c:?}")), "erc1271_calls": ok.erc1271_calls}),
        Err(r) => json!({"ok": false, "variant": variant(&r.error), "error": r.error.to_string(), "disposition": format!("{:?}", r.disposition), "block": r.block, "code": r.code.map(|c| format!("{c:?}")), "erc1271_calls": r.erc1271_calls}),
    };
    for (k, val) in common.as_object().unwrap() {
        v[k] = val.clone();
    }
    v
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let out = match args.first().map(String::as_str) {
        Some("digest") => cmd_digest(),
        Some("verify-legacy") if args.len() == 5 => cmd_verify_legacy(&args[1..]).await,
        Some("verify-h") if args.len() == 11 => cmd_verify_h(&args[1..]).await,
        _ => {
            eprintln!("usage: udsig-h digest | verify-legacy <rpc> <signer> <digest> <gas> | verify-h <rpc> <signer> <digest> <mode> <b_exec> <fallback> <negatives> <last_block|-> <pk_len> <ed_len>");
            std::process::exit(2);
        }
    };
    println!("{out}");
}
