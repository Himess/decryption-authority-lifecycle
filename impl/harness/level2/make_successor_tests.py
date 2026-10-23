"""Generate the Level 2 (E1 successor) real-connector tests from the Level 0 harness files.

The Level 0 file's helpers (environment, ACL deployment from an artifact, one fresh unmodified kms-worker per request,
neutral gateway mock, outcome checks) are kept verbatim except for the edits listed below; its test section is
replaced by the Level 2 tests. Output: results/level2/harness/<ver>/crates/kms-worker/tests/acl_successor_real_chain.rs
Usage: python -I make_successor_tests.py <fhe-authority-lifecycle dir>
"""
import os
import sys

root = sys.argv[1]

SOL_E1 = '''        function retireSelf(address acl) external;
    }

    /// TEST-ONLY view of the Level 2 additions to the ACL (E1 Successor).
    #[sol(rpc)]
    interface IAclSuccession {
        function designateSuccessor(address successor) external;
        function acceptSuccession(address account) external;
        function confirmSuccessor() external;
        function resignSuccession(address account) external;
        function successorOf(address account) external view returns (address);
    }
}
'''

COMMON_L2 = '''
// ================================================================================================
// Level 2 (E1): the successor reads through the unmodified connector's delegated path
// ================================================================================================

/// Latest block timestamp of the anvil chain.
async fn chain_now(acl: &AnvilAcl) -> anyhow::Result<u64> {
    let block: serde_json::Value = acl
        .provider
        .raw_request("eth_getBlockByNumber".into(), ("latest", false))
        .await?;
    let ts = block["timestamp"]
        .as_str()
        .ok_or_else(|| anyhow!("latest block has no timestamp"))?;
    Ok(u64::from_str_radix(ts.trim_start_matches("0x"), 16)?)
}

async fn increase_time(acl: &AnvilAcl, seconds: u64) -> anyhow::Result<()> {
    let _: serde_json::Value = acl
        .provider
        .raw_request("evm_increaseTime".into(), (seconds,))
        .await?;
    let _: serde_json::Value = acl
        .provider
        .raw_request("evm_mine".into(), Vec::<u64>::new())
        .await?;
    Ok(())
}

/// The E1 lifecycle with anvil EOAs: `account` designates, `successor` accepts (its own tx), 7 days pass on the
/// chain, `account` confirms. Checked with `successorOf` (direct read, not recorded).
async fn confirm_successor(acl: &AnvilAcl, account: Address, successor: Address) -> anyhow::Result<()> {
    let e1 = IAclSuccession::new(acl.acl, &acl.provider);
    ensure_success(
        e1.designateSuccessor(successor).from(account).send().await?.get_receipt().await?,
        "designateSuccessor",
    )?;
    ensure_success(
        e1.acceptSuccession(account).from(successor).send().await?.get_receipt().await?,
        "acceptSuccession",
    )?;
    increase_time(acl, 7 * 86_400).await?;
    ensure_success(
        e1.confirmSuccessor().from(account).send().await?.get_receipt().await?,
        "confirmSuccessor",
    )?;
    let confirmed = e1.successorOf(account).call().await?;
    info!("L2-SUCCESSION account={account} successor={successor} successorOf={confirmed} (designate, accept, +7d, confirm)");
    ensure!(confirmed == successor, "successor not confirmed");
    Ok(())
}

async fn resign(acl: &AnvilAcl, account: Address, successor: Address) -> anyhow::Result<()> {
    ensure_success(
        IAclSuccession::new(acl.acl, &acl.provider)
            .resignSuccession(account)
            .from(successor)
            .send()
            .await?
            .get_receipt()
            .await?,
        "resignSuccession",
    )?;
    let now = IAclSuccession::new(acl.acl, &acl.provider).successorOf(account).call().await?;
    info!("L2-RESIGN account={account} successor={successor} successorOf={now}");
    ensure!(now == Address::ZERO, "resignation not effective");
    Ok(())
}

/// Direct (non-recorded) reads, logged as `L2-STATE[tag]`.
async fn log_l2_state(acl: &AnvilAcl, a: &Accounts, handle: B256, tag: &str) -> anyhow::Result<()> {
    let view = acl.instance();
    let c = acl.dapp;
    info!(
        "L2-STATE[{tag}] isAccountRetired(U)={} successorOf(U)={} isHandleDelegatedForUserDecryption(U,S,C,h)={} \\
        isHandleDelegatedForUserDecryption(U,D,C,h)={} isAllowed(h,S)={} isAllowed(h,U)={}",
        IAclLevel0::new(acl.acl, &acl.provider).isAccountRetired(a.u).call().await?,
        IAclSuccession::new(acl.acl, &acl.provider).successorOf(a.u).call().await?,
        view.isHandleDelegatedForUserDecryption(a.u, a.s, c, handle).call().await?,
        view.isHandleDelegatedForUserDecryption(a.u, a.d, c, handle).call().await?,
        view.isAllowed(handle, a.s).call().await?,
        view.isAllowed(handle, a.u).call().await?,
    );
    Ok(())
}
'''


def legacy_test(run):
    # `run` is the RequestHarness method for legacy requests: "run" (v0.13.8) or "run_legacy" (main).
    return f'''
/// U (delegator) confirms S as its successor; D holds a live 30-day delegation from U. Before U retires the
/// succession gives S nothing; after it, the unmodified connector forwards S's delegated request (the view answers as
/// an active wildcard delegation) and refuses D's, and S has no use right of its own. A handle granted to U after
/// retirement (straggler) is readable by S. After S resigns, S is refused again.
/// Order: each RequestHarness's first request is a forward (v0.13.8 primes its coprocessor-config cache with it).
#[rstest]
#[timeout(Duration::from_secs(300))]
#[tokio::test]
async fn level2_successor_legacy_delegated() -> anyhow::Result<()> {{
    let log_guard = init_tracing();
    let env = Env::load()?;
    let a = Accounts::load(&env).await?;
    let case = "l2.legacy";
    info!("L0-CASE name={{case}} version={{VERSION}} acl_kind=level2");
    let acl = deploy_acl(&env, AclKind::Level0, a.owner).await?;
    let h = make_handle(env.chain_id);
    let h2 = make_handle(env.chain_id);
    acl.grant(h, a.u).await?;
    acl.grant(h2, a.v).await?;
    let exp = chain_now(&acl).await? + 30 * 86_400;
    acl.delegate(a.u, a.d, acl.dapp, exp).await?;
    confirm_successor(&acl, a.u, a.s).await?;
    log_l2_state(&acl, &a, h, &format!("{{case}}.confirmed")).await?;

    let test_instance = TestInstanceBuilder::default()
        .with_tracing(Some(log_guard))
        .with_db(DB_SETUP)
        .build();
    let db = test_instance.db();
    let mut rh = RequestHarness::new(&env, &acl, AclKind::Level0, h).await?;
    let mut rh2 = RequestHarness::new(&env, &acl, AclKind::Level0, h2).await?;
    let cfg = RunCfg::harness();

    // U active.
    let r = rh
        .{run}(db, &Req::delegated(format!("{{case}}.delegate-d.u-active"), a.d, a.u, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;
    let r = rh
        .{run}(
            db,
            &Req::delegated(
                format!("{{case}}.successor-s.u-active"),
                a.s,
                a.u,
                Outcome::Rejected,
                "isHandleDelegatedForUserDecryption(U,S,C,h)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;

    // U retires: the successor reads, every other delegate is refused, the successor has no use right.
    retire(&acl, a.u, "delegator-with-successor", case).await?;
    log_l2_state(&acl, &a, h, &format!("{{case}}.u-retired")).await?;
    let r = rh
        .{run}(db, &Req::delegated(format!("{{case}}.successor-s.u-retired"), a.s, a.u, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;
    let r = rh
        .{run}(
            db,
            &Req::delegated(
                format!("{{case}}.delegate-d.u-retired"),
                a.d,
                a.u,
                Outcome::Rejected,
                "isHandleDelegatedForUserDecryption(U,D,C,h)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;
    let r = rh
        .{run}(db, &Req::direct(format!("{{case}}.successor-s-direct.u-retired"), a.s, Outcome::Rejected, "isAllowed(h,S)"), &cfg)
        .await?;
    check(&r, &cfg)?;

    // Straggler: C grants h2 to the retired U (inert for U itself), and S reads it.
    acl.grant(h2, a.u).await?;
    let r = rh2
        .{run}(db, &Req::direct(format!("{{case}}.h2-holder-v"), a.v, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;
    let r = rh2
        .{run}(db, &Req::delegated(format!("{{case}}.successor-s.straggler-h2"), a.s, a.u, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;

    // S resigns: refused again.
    resign(&acl, a.u, a.s).await?;
    let r = rh
        .{run}(
            db,
            &Req::delegated(
                format!("{{case}}.successor-s.after-resign"),
                a.s,
                a.u,
                Outcome::Rejected,
                "isHandleDelegatedForUserDecryption(U,S,C,h)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;
    Ok(())
}}
'''


V2_TEST = '''
/// RFC-016 unified path, delegated entry (owner U, signing user Sk): Sk is a local-key successor that accepts with
/// its own key. Dk holds a live 30-day delegation from U as the control.
#[rstest]
#[timeout(Duration::from_secs(300))]
#[tokio::test]
async fn level2_successor_v2_delegated() -> anyhow::Result<()> {
    let log_guard = init_tracing();
    let env = Env::load()?;
    let a = Accounts::load(&env).await?;
    let keys = LocalKeys::new()?;
    let sk = PrivateKeySigner::from_bytes(&rand_digest())?;
    info!("LOCAL-KEYS-L2 Sk={}", sk.address());
    let case = "l2.v2";
    info!("L0-CASE name={case} version={VERSION} acl_kind=level2");
    let acl = deploy_acl(&env, AclKind::Level0, a.owner).await?;
    let h = make_handle(env.chain_id);
    acl.grant(h, a.u).await?;
    let exp = chain_now(&acl).await? + 30 * 86_400;
    acl.delegate(a.u, keys.dk.address(), acl.dapp, exp).await?;

    // E1 with a local-key successor: U designates, Sk accepts with its own key, +7 days, U confirms.
    let e1 = IAclSuccession::new(acl.acl, &acl.provider);
    ensure_success(
        e1.designateSuccessor(sk.address()).from(a.u).send().await?.get_receipt().await?,
        "designateSuccessor",
    )?;
    let _: serde_json::Value = acl
        .provider
        .raw_request(
            "anvil_setBalance".into(),
            (sk.address(), U256::from(1_000_000_000_000_000_000u128)),
        )
        .await?;
    let sk_provider = ProviderBuilder::new()
        .wallet(EthereumWallet::from(sk.clone()))
        .connect_http(env.anvil_url.clone());
    ensure_success(
        IAclSuccession::new(acl.acl, &sk_provider)
            .acceptSuccession(a.u)
            .send()
            .await?
            .get_receipt()
            .await?,
        "acceptSuccession (local key)",
    )?;
    increase_time(&acl, 7 * 86_400).await?;
    ensure_success(
        e1.confirmSuccessor().from(a.u).send().await?.get_receipt().await?,
        "confirmSuccessor",
    )?;
    let confirmed = e1.successorOf(a.u).call().await?;
    info!("L2-SUCCESSION account={} successor={} successorOf={confirmed} (local-key successor)", a.u, sk.address());
    ensure!(confirmed == sk.address(), "successor not confirmed");

    let test_instance = TestInstanceBuilder::default()
        .with_tracing(Some(log_guard))
        .with_db(DbInstance::setup_external().await?)
        .build();
    let db = test_instance.db();
    let rh = RequestHarness::new(&env, &acl, AclKind::Level0, h).await?;
    let cfg = RunCfg::harness();
    let dk = &keys.dk;

    let r = rh
        .run_v2(db, &ReqV2::new(format!("{case}.delegate-dk.u-active"), dk, a.u, vec![], false, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;
    let r = rh
        .run_v2(
            db,
            &ReqV2::new(
                format!("{case}.successor-sk.u-active"),
                &sk,
                a.u,
                vec![],
                false,
                Outcome::Rejected,
                "isHandleDelegatedForUserDecryption(U,Sk,C,h)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;

    retire(&acl, a.u, "owner-with-successor", case).await?;
    let r = rh
        .run_v2(db, &ReqV2::new(format!("{case}.successor-sk.u-retired"), &sk, a.u, vec![], false, Outcome::Forwarded, "-"), &cfg)
        .await?;
    check(&r, &cfg)?;
    let r = rh
        .run_v2(
            db,
            &ReqV2::new(
                format!("{case}.delegate-dk.u-retired"),
                dk,
                a.u,
                vec![],
                false,
                Outcome::Rejected,
                "isHandleDelegatedForUserDecryption(U,Dk,C,h)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;
    // Decrypt-as only: the successor's own (direct) entry on U's handle is refused.
    let r = rh
        .run_v2(
            db,
            &ReqV2::new(
                format!("{case}.successor-sk-direct.u-retired"),
                &sk,
                sk.address(),
                vec![],
                false,
                Outcome::Rejected,
                "isAllowed(h,Sk)",
            ),
            &cfg,
        )
        .await?;
    check(&r, &cfg)?;
    Ok(())
}
'''


def generate(ver, version_old, version_new, run_method, db_setup, with_v2):
    src_path = os.path.join(root, "results", "level0", "harness", ver, "crates", "kms-worker", "tests", "acl_retirement_real_chain.rs")
    s = open(src_path, encoding="utf-8").read()

    def rep(old, new):
        nonlocal s
        n = s.count(old)
        assert n == 1, (ver, old[:70], n)
        s = s.replace(old, new)

    # 1. header
    first_code = s.index("mod common;")
    header = (
        f"//! [lifecycle Level 2 connector proof] The UNMODIFIED kms-worker at {ver} serves the E1 successor of a retired\n"
        f"//! account through its existing delegated path, against the Level 2 ACL **{version_new.split(' ')[1]}** deployed on a\n"
        "//! local Anvil node (artifact in `LIFECYCLE_L0_ACL_ARTIFACT`).\n"
        "//!\n"
        "//! Test-only file, generated by impl/harness/level2/make_successor_tests.py from the Level 0 harness file\n"
        "//! `acl_retirement_real_chain.rs` (same helpers: one fresh unmodified kms-worker per request, neutral gateway mock,\n"
        "//! JSON-RPC recorder attributing every ACL call to its request); only the test section differs.\n"
    )
    s = header + s[first_code:]
    # 2. version, accounts, E1 interface, E1 declared at deployment
    rep(f'const LEVEL0_VERSION: &str = "{version_old}";', f'const LEVEL0_VERSION: &str = "{version_new}";')
    rep("        function retireSelf(address acl) external;\n    }\n}\n", SOL_E1)
    rep("    v: Address,\n    d: Address,\n}", "    v: Address,\n    d: Address,\n    /// The E1 successor (anvil account 4).\n    s: Address,\n}")
    rep("            d: accounts[3],\n        };", "            d: accounts[3],\n            s: accounts[4],\n        };")
    rep('info!("ACCOUNTS owner={} U={} V={} D={}", a.owner, a.u, a.v, a.d);', 'info!("ACCOUNTS owner={} U={} V={} D={} S={}", a.owner, a.u, a.v, a.d, a.s);')
    rep(
        '        ensure!(core && location == RETIREMENT_LOCATION, "Level 0 Core not declared");\n',
        '        ensure!(core && location == RETIREMENT_LOCATION, "Level 0 Core not declared");\n'
        "        let e1 = l0.supportsInterface(FixedBytes::<4>::new([0x7d, 0xc5, 0xe2, 0x09])).call().await?;\n"
        '        info!("ACL-LEVEL2 supportsInterface(0x7dc5e209)={e1}");\n'
        '        ensure!(e1, "E1 Successor not declared");\n',
    )
    # The retirement check expects AccountRetired(account, successorOf(account)): E1 emits the confirmed successor.
    rep("let topic2 = hex::encode_prefixed(B256::ZERO);",
        "let topic2 = hex::encode_prefixed(B256::left_padding_from(\n"
        "        IAclSuccession::new(acl.acl, &acl.provider).successorOf(account).call().await?.as_slice(),\n"
        "    ));")
    # 3. replace the test section
    marker = s.index("// 1-3. Retirement scenarios")
    cut = s.rindex("// ====", 0, marker)
    s = s[:cut].rstrip() + "\n" + COMMON_L2 + legacy_test(run_method).replace("DB_SETUP", db_setup) + (V2_TEST if with_v2 else "")
    out_dir = os.path.join(root, "results", "level2", "harness", ver, "crates", "kms-worker", "tests")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "acl_successor_real_chain.rs")
    open(out, "w", encoding="utf-8", newline="\n").write(s)
    print(ver, "->", out, len(s.splitlines()), "lines")


generate("v0.13.8", "ACL v0.4.1", "ACL v0.4.2", "run", "DbInstance::setup().await?", False)
generate("main", "ACL v0.8.0", "ACL v0.9.0", "run_legacy", "DbInstance::setup_external().await?", True)
