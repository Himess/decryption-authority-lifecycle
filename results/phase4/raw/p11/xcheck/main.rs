//! P1.1 cross-check: dilithium-py signatures (p11_mldsa_tool.py) against the four Rust ML-DSA verifiers.
use alloy::hex;
use user_decryption_signature::kda::{KdaScheme, MlDsaImpl, verify_with_impl};

fn main() {
    let text = std::fs::read_to_string(std::env::args().nth(1).expect("input")).unwrap();
    let mut bad = 0;
    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let v: serde_json::Value = serde_json::from_str(line).unwrap();
        let scheme = KdaScheme::from_name(v["scheme"].as_str().unwrap()).unwrap();
        let get = |k: &str| hex::decode(v[k].as_str().unwrap()).unwrap();
        let (pk, msg, sig) = (get("pk"), get("msg"), get("sig"));
        let mut other = msg.clone();
        other[0] ^= 1;
        for imp in MlDsaImpl::ALL {
            let ok = verify_with_impl(imp, scheme, &pk, &msg, &[], &sig).is_ok();
            let other_ok = verify_with_impl(imp, scheme, &pk, &other, &[], &sig).is_ok();
            println!("XCHECK scheme={scheme} impl={imp} accepts_python_sig={ok} accepts_other_msg={other_ok}");
            if !ok || other_ok {
                bad += 1;
            }
        }
    }
    println!("XCHECK-SUMMARY failures={bad}");
    std::process::exit(if bad == 0 { 0 } else { 1 });
}
