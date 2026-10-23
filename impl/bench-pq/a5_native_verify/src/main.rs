// A5 deliberation (AA / PQ accounts): native verification cost for decryption-permit
// signers, and a Wycheproof cross-check of the native ML-DSA-44 verifier.
// Throwaway measurement code; not production. Every crate used here is unaudited
// for this purpose (see MEASUREMENT_NOTES.txt).
//
// Usage:
//   a5-native-verify bench
//   a5-native-verify wycheproof <path/to/mldsa_44_verify_test.json>
use std::hint::black_box;
use std::time::Instant;

fn median(v: &mut Vec<f64>) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = v.len();
    if n % 2 == 1 { v[n / 2] } else { (v[n / 2 - 1] + v[n / 2]) / 2.0 }
}

/// `rounds` rounds of `batch` calls; prints median and min microseconds per call.
fn bench<F: FnMut() -> bool>(name: &str, rounds: usize, batch: usize, mut f: F) {
    for _ in 0..batch {
        assert!(black_box(f()), "{name}: verification failed in warm-up");
    }
    let mut per_call = Vec::with_capacity(rounds);
    for _ in 0..rounds {
        let t = Instant::now();
        for _ in 0..batch {
            assert!(black_box(f()), "{name}: verification failed");
        }
        per_call.push(t.elapsed().as_secs_f64() * 1e6 / batch as f64);
    }
    let min = per_call.iter().cloned().fold(f64::INFINITY, f64::min);
    let med = median(&mut per_call);
    println!("{name:<58} median {med:>9.2} us   min {min:>9.2} us   ({rounds}x{batch})");
}

fn keccak(data: &[u8]) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    Keccak256::digest(data).into()
}

/// Stand-in for the 32-byte EIP-712 permit digest.
fn digest(i: u8) -> [u8; 32] {
    let mut v = b"fhevm user-decrypt permit digest stand-in".to_vec();
    v.push(i);
    keccak(&v)
}

// ---------------------------------------------------------------- secp256k1
fn ecdsa_baselines() {
    // One key, one signature, recovered two ways: pure-Rust k256 (what alloy's
    // `k256` feature uses in Zama's shared crate) and libsecp256k1 (C, via the
    // `secp256k1` crate). Both include the keccak of the 64-byte public key.
    use k256::ecdsa::{RecoveryId, Signature, SigningKey, VerifyingKey};
    let sk = SigningKey::from_slice(&[7u8; 32]).unwrap();
    let msg = digest(1);
    let (sig, recid): (Signature, RecoveryId) = sk.sign_prehash_recoverable(&msg).unwrap();
    let expected: [u8; 20] = {
        let pk = sk.verifying_key().to_encoded_point(false);
        keccak(&pk.as_bytes()[1..])[12..].try_into().unwrap()
    };
    println!("secp256k1 ECDSA: sig 65 B, address recovered (no key transmitted)");
    bench("ecrecover, k256 0.13.4 (pure Rust) + keccak", 21, 400, || {
        let vk = VerifyingKey::recover_from_prehash(&msg, &sig, recid).unwrap();
        let pk = vk.to_encoded_point(false);
        keccak(&pk.as_bytes()[1..])[12..] == expected
    });

    let secp = secp256k1::Secp256k1::verification_only();
    let compact: [u8; 64] = sig.to_bytes().into();
    let rid = secp256k1::ecdsa::RecoveryId::try_from(recid.to_byte() as i32).unwrap();
    let rsig = secp256k1::ecdsa::RecoverableSignature::from_compact(&compact, rid).unwrap();
    let m = secp256k1::Message::from_digest(msg);
    bench("ecrecover, libsecp256k1 (secp256k1 0.30.0) + keccak", 21, 400, || {
        let pk = secp.recover_ecdsa(&m, &rsig).unwrap();
        keccak(&pk.serialize_uncompressed()[1..])[12..] == expected
    });
}

// ---------------------------------------------------------------- ML-DSA
fn mldsa<P: ml_dsa::MlDsaParams>(label: &str) {
    use ml_dsa::{EncodedSignature, EncodedVerifyingKey, Signature, SigningKey, VerifyingKey};
    let seed = ml_dsa::Seed::try_from(&[42u8; 32][..]).unwrap();
    let sk = SigningKey::<P>::from_seed(&seed);
    let esk = sk.expanded_key();
    let vk = esk.verifying_key();
    let msg = digest(2);
    // FIPS 204 ML-DSA.Sign, pure, empty context (deterministic variant for repeatability).
    let sig: Signature<P> = esk.sign_deterministic(&msg, &[]).unwrap();
    let sig_bytes: EncodedSignature<P> = sig.encode();
    let vk_bytes: EncodedVerifyingKey<P> = vk.encode();
    // Declared-signer shape: the on-chain declaration stores keccak256(pk) (32 B);
    // the request carries pk || sig; the verifier checks the commitment first.
    let commitment = keccak(&vk_bytes);
    println!(
        "{label}: sig {} B, pk {} B, request carries pk||sig = {} B",
        sig_bytes.len(),
        vk_bytes.len(),
        sig_bytes.len() + vk_bytes.len()
    );
    bench(&format!("{label}: decode pk+sig, verify (cold)"), 21, 200, || {
        let vk2 = VerifyingKey::<P>::decode(&vk_bytes);
        match Signature::<P>::decode(&sig_bytes) {
            Some(s) => vk2.verify_with_context(&msg, &[], &s),
            None => false,
        }
    });
    bench(&format!("{label}: declared-signer path (keccak(pk) check + cold)"), 21, 200, || {
        if keccak(&vk_bytes) != commitment {
            return false;
        }
        let vk2 = VerifyingKey::<P>::decode(&vk_bytes);
        match Signature::<P>::decode(&sig_bytes) {
            Some(s) => vk2.verify_with_context(&msg, &[], &s),
            None => false,
        }
    });
    let mut bad = msg;
    bad[0] ^= 1;
    assert!(!vk.verify_with_context(&bad, &[], &sig), "{label}: negative control passed");
}

// ---------------------------------------------------------------- FN-DSA (pre-standard)
fn fndsa512() {
    use fn_dsa::{
        sign_key_size, signature_size, vrfy_key_size, KeyPairGenerator, KeyPairGeneratorStandard,
        SigningKey, SigningKeyStandard, VerifyingKey, VerifyingKeyStandard, DOMAIN_NONE,
        HASH_ID_RAW, FN_DSA_LOGN_512,
    };
    use rand::rngs::OsRng;
    let logn = FN_DSA_LOGN_512;
    let mut kg = KeyPairGeneratorStandard::default();
    let mut skb = vec![0u8; sign_key_size(logn)];
    let mut vkb = vec![0u8; vrfy_key_size(logn)];
    kg.keygen(logn, &mut OsRng, &mut skb, &mut vkb);
    let mut sk = SigningKeyStandard::decode(&skb).unwrap();
    let msg = digest(3);
    let mut sig = vec![0u8; signature_size(sk.get_logn())];
    sk.sign(&mut OsRng, &DOMAIN_NONE, &HASH_ID_RAW, &msg, &mut sig);
    println!("FN-DSA-512 (fn-dsa 0.4.0, pre-standard): sig {} B, pk {} B", sig.len(), vkb.len());
    bench("FN-DSA-512: decode pk, verify (cold)", 21, 400, || {
        match VerifyingKeyStandard::decode(&vkb) {
            Some(v) => v.verify(&sig, &DOMAIN_NONE, &HASH_ID_RAW, &msg),
            None => false,
        }
    });
}

// ---------------------------------------------------------------- SLH-DSA
fn slhdsa<P: slh_dsa::ParameterSet>(label: &str, rounds: usize, batch: usize) {
    use slh_dsa::signature::{Keypair, SignatureEncoding, Signer, Verifier};
    use slh_dsa::SigningKey;
    let sk = SigningKey::<P>::slh_keygen_internal(&[1u8; 16], &[2u8; 16], &[3u8; 16]);
    let vk = sk.verifying_key();
    let msg = digest(4);
    let sig = sk.try_sign(&msg).unwrap();
    println!("{label}: sig {} B, pk {} B", sig.to_bytes().len(), vk.to_bytes().len());
    bench(&format!("{label}: verify"), rounds, batch, || vk.verify(&msg, &sig).is_ok());
    let mut bad = msg;
    bad[0] ^= 1;
    assert!(vk.verify(&bad, &sig).is_err(), "{label}: negative control passed");
}

// ---------------------------------------------------------------- Wycheproof
fn wycheproof(path: &str) {
    use ml_dsa::{EncodedSignature, EncodedVerifyingKey, MlDsa44, Signature, VerifyingKey};
    let text = std::fs::read_to_string(path).expect("read vector file");
    let doc: serde_json::Value = serde_json::from_str(&text).expect("parse json");
    assert_eq!(doc["algorithm"], "ML-DSA-44");
    let (mut agree, mut disagree, mut total) = (0usize, 0usize, 0usize);
    let (mut valid_ok, mut invalid_ok) = (0usize, 0usize);
    let mut with_ctx = 0usize;
    for g in doc["testGroups"].as_array().unwrap() {
        let pk = hex::decode(g["publicKey"].as_str().unwrap()).unwrap();
        // Wrong-length keys cannot be decoded: the native verifier rejects them.
        let vk = EncodedVerifyingKey::<MlDsa44>::try_from(&pk[..])
            .ok()
            .map(|e| VerifyingKey::<MlDsa44>::decode(&e));
        for t in g["tests"].as_array().unwrap() {
            total += 1;
            let tc = t["tcId"].as_u64().unwrap();
            let msg = hex::decode(t["msg"].as_str().unwrap()).unwrap();
            let sig = hex::decode(t["sig"].as_str().unwrap()).unwrap();
            let ctx = t.get("ctx").map(|c| hex::decode(c.as_str().unwrap()).unwrap());
            if ctx.is_some() {
                with_ctx += 1;
            }
            let expected = t["result"].as_str().unwrap() == "valid";
            let got = match (&vk, EncodedSignature::<MlDsa44>::try_from(&sig[..]).ok()) {
                (Some(vk), Some(es)) => match Signature::<MlDsa44>::decode(&es) {
                    Some(s) => vk.verify_with_context(&msg, ctx.as_deref().unwrap_or(&[]), &s),
                    None => false,
                },
                _ => false,
            };
            if got == expected {
                agree += 1;
                if expected { valid_ok += 1 } else { invalid_ok += 1 }
            } else {
                disagree += 1;
                println!(
                    "DISAGREE tcId {tc}: expected {expected}, native {got}; flags {}; {}",
                    t["flags"],
                    t["comment"]
                );
            }
        }
    }
    println!(
        "Wycheproof ML-DSA-44 verify, RustCrypto ml-dsa 0.1.1: {total} tests, {agree} agree \
         ({valid_ok} valid accepted, {invalid_ok} invalid rejected), {disagree} disagree; \
         {with_ctx} tests carry a non-default ctx"
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("wycheproof") => wycheproof(args.get(2).expect("path to vector file")),
        _ => {
            println!("a5-native-verify: native verification, 32-byte message (permit digest)");
            println!("threads available: {:?}", std::thread::available_parallelism());
            ecdsa_baselines();
            mldsa::<ml_dsa::MlDsa44>("ML-DSA-44");
            mldsa::<ml_dsa::MlDsa65>("ML-DSA-65");
            mldsa::<ml_dsa::MlDsa87>("ML-DSA-87");
            fndsa512();
            slhdsa::<slh_dsa::Sha2_128s>("SLH-DSA-SHA2-128s", 15, 40);
            slhdsa::<slh_dsa::Sha2_128f>("SLH-DSA-SHA2-128f", 15, 20);
            slhdsa::<slh_dsa::Shake128f>("SLH-DSA-SHAKE-128f", 15, 10);
        }
    }
}
