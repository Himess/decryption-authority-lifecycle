//! Phase 4, P3: ML-KEM-512/768/1024 sizes and times, for the reply-channel design note (Q6).
//!
//! Two implementations, both without a completed security audit for this use: RustCrypto `ml-kem` 0.3.2 (the
//! crate the example's reply channel uses) and Cryspen's `libcrux-ml-kem` 0.0.11. For each parameter set the
//! program checks a round trip in each implementation and across them, in both directions (one encapsulates to the
//! other's key and the other decapsulates), then times key generation, encapsulation and decapsulation one
//! operation at a time, and prints the median and the 95th percentile in microseconds with the encoded sizes.
//! Usage: p3-mlkem <iterations>

use std::time::Instant;

use ml_kem::kem::{Encapsulate, TryDecapsulate};
use ml_kem::{Kem, KeyExport, MlKem1024, MlKem512, MlKem768, TryKeyInit};
use rand::RngCore;

fn stats(mut v: Vec<f64>) -> (f64, f64) {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    (v[v.len() / 2], v[(v.len() * 95) / 100])
}

fn time<F: FnMut()>(n: usize, mut f: F) -> (f64, f64) {
    for _ in 0..(n / 10).max(10) {
        f();
    }
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        let t = Instant::now();
        f();
        v.push(t.elapsed().as_secs_f64() * 1e6);
    }
    stats(v)
}

fn rand_bytes<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    rand::thread_rng().fill_bytes(&mut b);
    b
}

macro_rules! bench_set {
    ($name:expr, $rc:ty, $lc:ident, $n:expr) => {{
        use libcrux_ml_kem::$lc as lc;
        // Round trips within each implementation.
        let (dk, ek) = <$rc>::generate_keypair();
        let (ct, k1) = ek.encapsulate();
        assert_eq!(k1, dk.try_decapsulate(&ct).expect("decapsulate"), "RustCrypto round trip");
        let kp = lc::generate_key_pair(rand_bytes::<64>());
        let (lct, ls1) = lc::encapsulate(kp.public_key(), rand_bytes::<32>());
        assert_eq!(ls1, lc::decapsulate(kp.private_key(), &lct), "libcrux round trip");
        // Across them: libcrux encapsulates to RustCrypto's key, RustCrypto decapsulates.
        let ek_bytes = ek.to_bytes();
        let lc_pk = TryFrom::try_from(&ek_bytes[..]).expect("libcrux accepts RustCrypto's key");
        let (x1_ct, x1_k) = lc::encapsulate(&lc_pk, rand_bytes::<32>());
        let x1_ct_rc = ml_kem::Ciphertext::<$rc>::try_from(x1_ct.as_ref()).expect("ciphertext size");
        let x1_k2 = dk.try_decapsulate(&x1_ct_rc).expect("RustCrypto decapsulates libcrux's ciphertext");
        assert_eq!(&x1_k[..], &x1_k2[..], "libcrux to RustCrypto");
        // And the other way: RustCrypto encapsulates to libcrux's key, libcrux decapsulates.
        let rc_ek = <<$rc as Kem>::EncapsulationKey as TryKeyInit>::new_from_slice(kp.public_key().as_ref())
            .expect("RustCrypto accepts libcrux's key");
        let (x2_ct, x2_k) = rc_ek.encapsulate();
        let lc_ct = TryFrom::try_from(&x2_ct[..]).expect("ciphertext size");
        let x2_k2 = lc::decapsulate(kp.private_key(), &lc_ct);
        assert_eq!(&x2_k[..], &x2_k2[..], "RustCrypto to libcrux");
        // Times.
        let rc_kg = time($n, || {
            let _ = <$rc>::generate_keypair();
        });
        let rc_enc = time($n, || {
            let _ = ek.encapsulate();
        });
        let rc_dec = time($n, || {
            let _ = dk.try_decapsulate(&ct).unwrap();
        });
        let lc_kg = time($n, || {
            let _ = lc::generate_key_pair(rand_bytes::<64>());
        });
        let lc_enc = time($n, || {
            let _ = lc::encapsulate(kp.public_key(), rand_bytes::<32>());
        });
        let lc_dec = time($n, || {
            let _ = lc::decapsulate(kp.private_key(), &lct);
        });
        println!(
            "{{\"set\":\"{}\",\"ek_bytes\":{},\"dk_bytes_expanded\":{},\"dk_seed_bytes\":64,\"ct_bytes\":{},\"ss_bytes\":{},\
\"interop\":\"both directions\",\
\"rustcrypto_us\":{{\"keygen\":[{:.1},{:.1}],\"encaps\":[{:.1},{:.1}],\"decaps\":[{:.1},{:.1}]}},\
\"libcrux_us\":{{\"keygen\":[{:.1},{:.1}],\"encaps\":[{:.1},{:.1}],\"decaps\":[{:.1},{:.1}]}}}}",
            $name, ek_bytes.len(), kp.private_key().as_ref().len(), ct.len(), k1.len(),
            rc_kg.0, rc_kg.1, rc_enc.0, rc_enc.1, rc_dec.0, rc_dec.1,
            lc_kg.0, lc_kg.1, lc_enc.0, lc_enc.1, lc_dec.0, lc_dec.1
        );
    }};
}

fn main() {
    let n: usize = std::env::args().nth(1).map(|s| s.parse().unwrap()).unwrap_or(2000);
    bench_set!("ML-KEM-512", MlKem512, mlkem512, n);
    bench_set!("ML-KEM-768", MlKem768, mlkem768, n);
    bench_set!("ML-KEM-1024", MlKem1024, mlkem1024, n);
}
