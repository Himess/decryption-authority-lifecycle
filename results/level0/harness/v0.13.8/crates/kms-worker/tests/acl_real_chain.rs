//! [lifecycle real-chain harness] Baseline proof: the UNMODIFIED kms-worker checks user-decryption
//! requests against a REAL fhevm ACL (Zama bytecode at this checkout) deployed on a local Anvil node.
//!
//! Same structure as `tests/acl.rs`: Gateway mocked with an alloy `Asserter`, KMS Core mocked with a
//! `mocktail` gRPC server, ciphertext storage mocked with a `mocktail` HTTP server. Only the host
//! chain changes: `init_host_chains_acl_contracts_mock` is replaced by
//! `init_host_chains_acl_contracts_anvil`, whose provider reaches Anvil through a JSON-RPC recorder,
//! so every ACL view the connector performs is captured on the wire.
//!
//! Environment (set by `/srv/lifecycle/scripts/run_real_chain.sh`):
//! - `LIFECYCLE_ANVIL_URL`: direct Anvil URL, used only for harness setup transactions/reads.
//! - `LIFECYCLE_HOST_RPC_URL`: recorder URL in front of the same Anvil, given to the connector.
//! - `LIFECYCLE_HOST_CHAIN_ID`: Anvil chain id, encoded in the handle.
//! - `LIFECYCLE_SOL_OUT`: forge `out/` dir of the test-only helper contracts.
//! - `LIFECYCLE_PG_ADMIN_URL` (+ `PGPASSFILE`): external Postgres, see `setup/db.rs`.
mod common;

use crate::common::init_kms_worker;
use alloy::{
    hex,
    primitives::{Address, B256, U256, keccak256},
    providers::{Provider, ProviderBuilder, mock::Asserter},
    rpc::types::Transaction,
    sol_types::{SolCall, SolValue},
    transports::http::reqwest::Url,
};
use connector_utils::{
    tests::{
        db::requests::{InsertRequestOptions, insert_rand_request},
        rand::{rand_address, rand_digest, rand_u256},
        setup::{AnvilAcl, DbInstance, TestInstanceBuilder, init_host_chains_acl_contracts_anvil},
    },
    types::{ProtocolEventKind, db::EventType},
};
use fhevm_gateway_bindings::{
    decryption::{
        Decryption::{
            CtHandleContractPair, SnsCiphertextMaterial, delegatedUserDecryptionRequestCall,
            userDecryptionRequestCall,
        },
        IDecryption::{ContractsInfo, DelegationAccounts},
    },
    gateway_config::GatewayConfig::Coprocessor,
};
use kms_grpc::kms::v1::{Empty, UserDecryptionResponse, UserDecryptionResponsePayload};
use kms_worker::core::Config;
use mocktail::{
    MockSet,
    server::{MockServer, MockServerConfig},
};
use rstest::rstest;
use sqlx::{Pool, Postgres};
use std::{
    net::{IpAddr, Ipv4Addr},
    path::PathBuf,
    str::FromStr,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio_util::sync::CancellationToken;
use tracing::info;
use tracing_subscriber::EnvFilter;

const MAX_DECRYPTION_ATTEMPTS: u16 = 3;
/// FHE type byte (index 30) of the test handle: 5 (`euint64`), as in the repo's `S3_CT_HANDLE`.
const HANDLE_FHE_TYPE: u8 = 5;

#[derive(Debug, Clone, Copy)]
enum Scenario {
    /// Direct path, user U holds a persistent ACL allowance on the handle.
    DirectUserU,
    /// Direct path, user V holds no allowance.
    DirectUserV,
    /// Delegated path, delegator U (allowed) delegated to D for contract C.
    DelegatedUToD,
    /// Delegated path, delegator V (not allowed on the handle) delegated to D for contract C.
    DelegatedVToD,
    /// Delegated path, delegator U, but V was never delegated by U.
    DelegatedUToV,
}

struct Accounts {
    owner: Address,
    u: Address,
    v: Address,
    d: Address,
}

impl Scenario {
    /// (request user = `userAddress` of the event, delegator, expected to be forwarded to the KMS)
    fn request(&self, a: &Accounts) -> (Address, Option<Address>, bool) {
        match self {
            Scenario::DirectUserU => (a.u, None, true),
            Scenario::DirectUserV => (a.v, None, false),
            Scenario::DelegatedUToD => (a.d, Some(a.u), true),
            Scenario::DelegatedVToD => (a.d, Some(a.v), false),
            Scenario::DelegatedUToV => (a.v, Some(a.u), false),
        }
    }
}

fn env(name: &str) -> anyhow::Result<String> {
    std::env::var(name).map_err(|_| anyhow::anyhow!("missing env var {name}"))
}

fn make_handle(chain_id: u64) -> B256 {
    let mut h = rand_digest().0;
    h[21] = 0xff;
    h[22..30].copy_from_slice(&chain_id.to_be_bytes());
    h[30] = HANDLE_FHE_TYPE;
    h[31] = 0;
    B256::from(h)
}

fn mock_gateway_tx(tx_hash: B256, calldata: Vec<u8>) -> Result<Transaction, serde_json::Error> {
    // Same JSON shape as `tests/common::create_mock_user_decryption_request_tx`.
    serde_json::from_value(serde_json::json!({
        "hash": hex::encode(tx_hash.as_slice()),
        "nonce": "0x0",
        "blockHash": null,
        "blockNumber": null,
        "transactionIndex": null,
        "from": "0x0000000000000000000000000000000000000000",
        "to": "0x0000000000000000000000000000000000000000",
        "value": "0x0",
        "gasPrice": "0x0",
        "gas": "0x0",
        "input": format!("0x{}", hex::encode(&calldata)),
        "v": "0x1b",
        "r": "0x0000000000000000000000000000000000000000000000000000000000000001",
        "s": "0x0000000000000000000000000000000000000000000000000000000000000001",
        "type": "0x0"
    }))
}

fn localhost_mock_config() -> MockServerConfig {
    MockServerConfig {
        listen_addr: IpAddr::V4(Ipv4Addr::LOCALHOST),
        ..Default::default()
    }
}

fn total_hits(server: &MockServer) -> usize {
    server.mocks().iter().map(|m| m.match_count()).sum()
}

#[derive(Debug, PartialEq)]
enum Outcome {
    Forwarded,
    Rejected,
}

async fn wait_for_outcome(db: &Pool<Postgres>, decryption_id: U256) -> anyhow::Result<Outcome> {
    let start = Instant::now();
    loop {
        let responses: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM user_decryption_responses WHERE decryption_id = $1",
        )
        .bind(decryption_id.as_le_slice())
        .fetch_one(db)
        .await?;
        if responses > 0 {
            return Ok(Outcome::Forwarded);
        }
        // `fetch_optional`: a response insert may remove/complete the request row concurrently.
        let status: Option<String> = sqlx::query_scalar(
            "SELECT status::text FROM user_decryption_requests WHERE decryption_id = $1",
        )
        .bind(decryption_id.as_le_slice())
        .fetch_optional(db)
        .await?;
        if status.as_deref() == Some("failed") {
            return Ok(Outcome::Rejected);
        }
        if start.elapsed() > Duration::from_secs(90) {
            anyhow::bail!("timeout waiting for outcome (status={status:?})");
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

#[rstest]
#[case::direct_user_u_allowed(Scenario::DirectUserU)]
#[case::direct_user_v_rejected(Scenario::DirectUserV)]
#[case::delegated_u_to_d_allowed(Scenario::DelegatedUToD)]
#[case::delegated_v_to_d_rejected(Scenario::DelegatedVToD)]
#[case::delegated_u_to_v_rejected(Scenario::DelegatedUToV)]
#[timeout(Duration::from_secs(180))]
#[tokio::test]
async fn real_acl_user_decryption(#[case] scenario: Scenario) -> anyhow::Result<()> {
    let log_guard = tracing::subscriber::set_default(
        tracing_subscriber::fmt()
            .with_env_filter(
                EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
            )
            .with_test_writer()
            .finish(),
    );
    let anvil_url = Url::from_str(&env("LIFECYCLE_ANVIL_URL")?)?;
    let host_rpc_url = Url::from_str(&env("LIFECYCLE_HOST_RPC_URL")?)?;
    let host_chain_id: u64 = env("LIFECYCLE_HOST_CHAIN_ID")?.parse()?;
    let sol_out = PathBuf::from(env("LIFECYCLE_SOL_OUT")?);

    // ---------------------------------------------------------------- real host chain (Anvil)
    let accounts = ProviderBuilder::new()
        .connect_http(anvil_url.clone())
        .get_accounts()
        .await?;
    let a = Accounts {
        owner: accounts[0],
        u: accounts[1],
        v: accounts[2],
        d: accounts[3],
    };
    info!("ACCOUNTS owner={} U={} V={} D={}", a.owner, a.u, a.v, a.d);
    let acl = AnvilAcl::deploy(anvil_url.clone(), &sol_out, a.owner).await?;
    let c = acl.dapp;
    let handle = make_handle(host_chain_id);
    acl.grant(handle, a.u).await?;
    let expiration = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() + 86_400;
    acl.delegate(a.u, a.d, c, expiration).await?;
    acl.delegate(a.v, a.d, c, expiration).await?;

    // Harness sanity table, read directly from Anvil (not through the recorder).
    let view = acl.instance();
    let table = [
        ("isAllowed(h,U)", view.isAllowed(handle, a.u).call().await?, true),
        ("isAllowed(h,V)", view.isAllowed(handle, a.v).call().await?, false),
        ("isAllowed(h,D)", view.isAllowed(handle, a.d).call().await?, false),
        ("isAllowed(h,C)", view.isAllowed(handle, c).call().await?, true),
        (
            "isHandleDelegatedForUserDecryption(U,D,C,h)",
            view.isHandleDelegatedForUserDecryption(a.u, a.d, c, handle).call().await?,
            true,
        ),
        (
            "isHandleDelegatedForUserDecryption(V,D,C,h)",
            view.isHandleDelegatedForUserDecryption(a.v, a.d, c, handle).call().await?,
            false,
        ),
        (
            "isHandleDelegatedForUserDecryption(U,V,C,h)",
            view.isHandleDelegatedForUserDecryption(a.u, a.v, c, handle).call().await?,
            false,
        ),
    ];
    for (name, got, want) in table {
        info!("ACL-STATE {name} = {got}");
        assert_eq!(got, want, "harness ACL state: {name}");
    }

    // ---------------------------------------------------------------- DB + mocks (as tests/acl.rs)
    let test_instance = TestInstanceBuilder::default()
        .with_tracing(Some(log_guard))
        .with_db(DbInstance::setup().await?)
        .build();
    let db = test_instance.db();

    let (user, delegator, expect_forwarded) = scenario.request(&a);
    let pairs = vec![CtHandleContractPair {
        ctHandle: handle,
        contractAddress: c,
    }];
    let contracts_info = ContractsInfo {
        chainId: U256::from(host_chain_id),
        addresses: vec![c],
    };
    let calldata = match delegator {
        None => userDecryptionRequestCall {
            ctHandleContractPairs: pairs,
            contractsInfo: contracts_info,
            userAddress: user,
            ..Default::default()
        }
        .abi_encode(),
        Some(delegator) => delegatedUserDecryptionRequestCall {
            ctHandleContractPairs: pairs,
            delegationAccounts: DelegationAccounts {
                delegatorAddress: delegator,
                delegateAddress: user,
            },
            contractsInfo: contracts_info,
            ..Default::default()
        }
        .abi_encode(),
    };

    // Ciphertext storage mock (S3), bound to 127.0.0.1.
    let ciphertext = [rand_digest().0, rand_digest().0].concat();
    let digest = keccak256(&ciphertext);
    let mut s3_mocks = MockSet::new();
    let ct_path = format!("/ct128/{}", hex::encode(digest));
    let ct_body = ciphertext.clone();
    s3_mocks.mock(move |when, then| {
        when.get().path(ct_path);
        then.headers([("x-amz-meta-Ct-Format", "compressed_on_cpu")])
            .bytes(ct_body);
    });
    let s3_server = MockServer::new_http("s3")
        .with_config(localhost_mock_config())
        .with_mocks(s3_mocks);
    s3_server.start().await?;
    let s3_bucket_url = format!("http://127.0.0.1:{}/ct128", s3_server.port().unwrap());

    // Gateway mock: the worker re-reads the request calldata from the gateway tx on every attempt.
    let asserter = Asserter::new();
    let tx_hash = rand_digest();
    let copro = rand_address();
    if expect_forwarded {
        asserter.push_success(&mock_gateway_tx(tx_hash, calldata.clone())?);
        asserter.push_success(
            &Coprocessor {
                s3BucketUrl: s3_bucket_url.clone(),
                ..Default::default()
            }
            .abi_encode(),
        );
    } else {
        for _ in 0..MAX_DECRYPTION_ATTEMPTS {
            asserter.push_success(&mock_gateway_tx(tx_hash, calldata.clone())?);
        }
    }
    let gateway_mock_provider = ProviderBuilder::new()
        .disable_recommended_fillers()
        .connect_mocked_client(asserter);

    // KMS Core mock (same mocks as tests/integration_tests.rs), bound to 127.0.0.1. It accepts
    // anything: a rejected request must fail before reaching it.
    let mut kms_mocks = MockSet::new();
    kms_mocks.mock(|when, then| {
        when.path("/kms_service.v1.CoreServiceEndpoint/UserDecrypt");
        then.pb(Empty::default());
    });
    kms_mocks.mock(|when, then| {
        when.path("/kms_service.v1.CoreServiceEndpoint/GetUserDecryptionResult");
        then.pb(UserDecryptionResponse {
            payload: Some(UserDecryptionResponsePayload::default()),
            ..Default::default()
        });
    });
    let kms_server = MockServer::new_grpc("kms_service.v1.CoreServiceEndpoint")
        .with_config(localhost_mock_config())
        .with_mocks(kms_mocks);
    kms_server.start().await?;

    // ---------------------------------------------------------------- unmodified kms-worker
    let config = Config {
        kms_core_endpoints: vec![kms_server.base_url().unwrap().to_string()],
        max_decryption_attempts: MAX_DECRYPTION_ATTEMPTS,
        db_fast_event_polling: Duration::from_millis(500),
        ..Default::default()
    };
    let acl_contracts = init_host_chains_acl_contracts_anvil(host_chain_id, acl.acl, host_rpc_url);
    let kms_worker = init_kms_worker(config, gateway_mock_provider, acl_contracts, db).await?;

    let sns_ct = SnsCiphertextMaterial {
        keyId: rand_u256(),
        ctHandle: handle,
        snsCiphertextDigest: digest,
        coprocessorTxSenderAddresses: vec![copro],
    };
    let request = insert_rand_request(
        db,
        EventType::UserDecryptionRequest,
        InsertRequestOptions::new()
            .with_sns_ct_materials(vec![sns_ct])
            .with_tx_hash(tx_hash),
    )
    .await?;
    let ProtocolEventKind::UserDecryption(request) = request else {
        anyhow::bail!("unexpected request kind");
    };
    // `insert_rand_request` draws a random `userAddress`; set the scenario's user before the
    // worker starts (the gateway event's userAddress is the requester / delegate).
    sqlx::query("UPDATE user_decryption_requests SET user_address = $1 WHERE decryption_id = $2")
        .bind(user.as_slice())
        .bind(request.decryptionId.as_le_slice())
        .execute(db)
        .await?;

    info!(
        "SCENARIO {scenario:?}: acl={} handle={handle} user={user} delegator={delegator:?} \
        contract={c} decryption_id={}",
        acl.acl, request.decryptionId
    );
    let cancel_token = CancellationToken::new();
    let kms_worker_task = tokio::spawn(kms_worker.start(cancel_token.clone()));

    let outcome = wait_for_outcome(db, request.decryptionId).await?;
    if outcome == Outcome::Rejected {
        // Give a late (wrong) forward a chance to show up before asserting it never happened.
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    let kms_hits = total_hits(&kms_server);
    let s3_hits = total_hits(&s3_server);
    cancel_token.cancel();
    kms_worker_task.await.unwrap();

    info!(
        "RESULT scenario={scenario:?} version=v0.13.8 acl={} acl_version={} user={user} \
        delegator={delegator:?} contract={c} expected={} observed={outcome:?} kms_mock_hits={kms_hits} \
        s3_mock_hits={s3_hits}",
        acl.acl,
        acl.version,
        if expect_forwarded { "Forwarded" } else { "Rejected" },
    );
    if expect_forwarded {
        assert_eq!(outcome, Outcome::Forwarded);
        assert!(kms_hits >= 2, "UserDecrypt + GetUserDecryptionResult expected");
    } else {
        assert_eq!(outcome, Outcome::Rejected);
        assert_eq!(kms_hits, 0, "a rejected request must never reach the KMS Core");
        assert_eq!(s3_hits, 0, "a rejected request must not fetch ciphertexts");
    }
    Ok(())
}
