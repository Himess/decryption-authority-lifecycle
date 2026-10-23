use crate::types::handle::extract_chain_id_from_handle;
use alloy::{
    network::TransactionBuilder,
    primitives::{Address, B256, Bytes},
    providers::{DynProvider, Provider, ProviderBuilder, RootProvider, mock::Asserter},
    rpc::types::{TransactionReceipt, TransactionRequest},
    sol_types::{SolCall, SolValue},
    transports::http::reqwest::Url,
};
use anyhow::{Context, anyhow};
use fhevm_host_bindings::{
    acl::ACL::{self, ACLInstance},
    empty_uups_proxy_acl::EmptyUUPSProxyACL,
};
use std::{collections::HashMap, path::Path, str::FromStr};
use tracing::info;

pub fn init_host_chains_acl_contracts_mock(
    ct_handle: &[u8],
    responses: Vec<bool>,
) -> HashMap<u64, ACLInstance<RootProvider>> {
    let asserter = Asserter::new();
    for response in responses {
        asserter.push_success(&response.abi_encode());
    }
    let host_mock_provider = ProviderBuilder::new()
        .disable_recommended_fillers()
        .connect_mocked_client(asserter.clone());

    let acl_contracts_mock = HashMap::from([(
        extract_chain_id_from_handle(ct_handle).unwrap(),
        ACL::new(Address::default(), host_mock_provider),
    )]);
    info!("Host chain mock started!");

    acl_contracts_mock
}

// -------------------------------------------------------------------------------------------------
// [lifecycle real-chain harness] Test-only additions. Nothing below is used by production code.
// -------------------------------------------------------------------------------------------------

/// Anvil-backed replacement for [`init_host_chains_acl_contracts_mock`].
///
/// Same return type as the mock (`ACLInstance<RootProvider>`, no fillers), but the provider is a
/// plain HTTP client to a real node, so every ACL view the connector calls is executed by the real
/// ACL bytecode deployed on that node.
pub fn init_host_chains_acl_contracts_anvil(
    host_chain_id: u64,
    acl_address: Address,
    host_rpc_url: Url,
) -> HashMap<u64, ACLInstance<RootProvider>> {
    let host_provider = ProviderBuilder::new()
        .disable_recommended_fillers()
        .connect_http(host_rpc_url.clone());
    info!("Host chain {host_chain_id}: real ACL {acl_address} via {host_rpc_url}");
    HashMap::from([(host_chain_id, ACL::new(acl_address, host_provider))])
}

alloy::sol! {
    #[sol(rpc)]
    interface IExecutorStub {
        function produce(address acl, bytes32 handle, address dapp, address user) external;
    }
}

/// A real fhevm `ACL` (bytecode from `fhevm_host_bindings` at the checked-out version) deployed on
/// a local Anvil node the same way Zama's Foundry utils do it (`HostContractsDeployerTestUtils.
/// _deployACL`): `ERC1967Proxy(EmptyUUPSProxyACL, initialize(owner))`, then
/// `upgradeToAndCall(ACL, initializeFromEmptyProxy())`.
pub struct AnvilAcl {
    pub provider: DynProvider,
    pub owner: Address,
    pub acl: Address,
    pub acl_implementation: Address,
    pub executor: Address,
    pub dapp: Address,
    pub version: String,
}

/// Bytecodes of the test-only helper contracts compiled with forge (see `harness/sol`).
struct Artifact {
    bytecode: Bytes,
    deployed_bytecode: Bytes,
}

fn load_artifact(out_dir: &Path, file: &str, name: &str) -> anyhow::Result<Artifact> {
    let path = out_dir.join(file).join(format!("{name}.json"));
    let json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&path).with_context(|| format!("reading {}", path.display()))?,
    )?;
    let get = |key: &str| -> anyhow::Result<Bytes> {
        let hex = json[key]["object"]
            .as_str()
            .ok_or_else(|| anyhow!("{key}.object missing in {}", path.display()))?;
        Ok(Bytes::from_str(hex)?)
    };
    Ok(Artifact {
        bytecode: get("bytecode")?,
        deployed_bytecode: get("deployedBytecode")?,
    })
}

fn ensure_success(receipt: TransactionReceipt, what: &str) -> anyhow::Result<TransactionReceipt> {
    if receipt.status() {
        Ok(receipt)
    } else {
        Err(anyhow!("{what} reverted (tx {})", receipt.transaction_hash))
    }
}

impl AnvilAcl {
    /// Deploys the ACL behind its proxy, installs the executor stand-in and deploys the dApp `C`.
    /// All transactions are sent with `eth_sendTransaction` from unlocked Anvil accounts, so no
    /// private key is handled by the harness.
    pub async fn deploy(rpc_url: Url, sol_out_dir: &Path, owner: Address) -> anyhow::Result<Self> {
        let provider = ProviderBuilder::new().connect_http(rpc_url).erased();

        let proxy_art = load_artifact(sol_out_dir, "Proxy.sol", "DeployableERC1967Proxy")?;
        let executor_art = load_artifact(sol_out_dir, "ExecutorStub.sol", "ExecutorStub")?;
        let dapp_art = load_artifact(sol_out_dir, "DappStub.sol", "DappStub")?;

        // 1. EmptyUUPSProxyACL implementation (Zama bytecode).
        let empty_impl = ensure_success(
            EmptyUUPSProxyACL::deploy_builder(&provider)
                .from(owner)
                .send()
                .await?
                .get_receipt()
                .await?,
            "EmptyUUPSProxyACL deploy",
        )?
        .contract_address
        .ok_or_else(|| anyhow!("no EmptyUUPSProxyACL address"))?;

        // 2. ERC1967Proxy(emptyImpl, initialize(owner)).
        let init = EmptyUUPSProxyACL::initializeCall {
            initialOwner: owner,
        }
        .abi_encode();
        let mut proxy_code = proxy_art.bytecode.to_vec();
        proxy_code.extend((empty_impl, Bytes::from(init)).abi_encode_params());
        let acl = Self::deploy_code(&provider, owner, proxy_code, "ERC1967Proxy deploy").await?;

        // 3. ACL implementation (Zama bytecode) and 4. upgradeToAndCall(..., initializeFromEmptyProxy()).
        let acl_implementation = ensure_success(
            ACL::deploy_builder(&provider)
                .from(owner)
                .send()
                .await?
                .get_receipt()
                .await?,
            "ACL implementation deploy",
        )?
        .contract_address
        .ok_or_else(|| anyhow!("no ACL implementation address"))?;
        let reinit = ACL::initializeFromEmptyProxyCall {}.abi_encode();
        ensure_success(
            EmptyUUPSProxyACL::new(acl, &provider)
                .upgradeToAndCall(acl_implementation, reinit.into())
                .from(owner)
                .send()
                .await?
                .get_receipt()
                .await?,
            "upgradeToAndCall(ACL)",
        )?;

        let acl_instance = ACL::new(acl, &provider);
        let version = acl_instance.getVersion().call().await?;
        let acl_owner = acl_instance.owner().call().await?;
        if acl_owner != owner {
            return Err(anyhow!("unexpected ACL owner {acl_owner}"));
        }

        // 5. The executor stand-in is placed at the address the ACL bytecode was compiled with.
        let executor = acl_instance.getFHEVMExecutorAddress().call().await?;
        let _: serde_json::Value = provider
            .raw_request(
                "anvil_setCode".into(),
                (executor, executor_art.deployed_bytecode.clone()),
            )
            .await?;

        // 6. dApp contract C.
        let dapp = Self::deploy_code(
            &provider,
            owner,
            dapp_art.bytecode.to_vec(),
            "DappStub deploy",
        )
        .await?;

        info!(
            "Deployed real ACL ({version}) proxy={acl} impl={acl_implementation} owner={owner} \
            executor(stand-in)={executor} dapp C={dapp}"
        );
        Ok(Self {
            provider,
            owner,
            acl,
            acl_implementation,
            executor,
            dapp,
            version,
        })
    }

    async fn deploy_code(
        provider: &DynProvider,
        from: Address,
        code: Vec<u8>,
        what: &str,
    ) -> anyhow::Result<Address> {
        let tx = TransactionRequest::default()
            .with_from(from)
            .with_deploy_code(code);
        ensure_success(
            provider.send_transaction(tx).await?.get_receipt().await?,
            what,
        )?
        .contract_address
        .ok_or_else(|| anyhow!("{what}: no contract address"))
    }

    /// Real fhEVM grant flow: executor `allowTransient(handle, C)`, then `C` calls
    /// `allow(handle, C)` and `allow(handle, user)` in the same transaction.
    pub async fn grant(&self, handle: B256, user: Address) -> anyhow::Result<()> {
        let receipt = ensure_success(
            IExecutorStub::new(self.executor, &self.provider)
                .produce(self.acl, handle, self.dapp, user)
                .from(self.owner)
                .send()
                .await?
                .get_receipt()
                .await?,
            "grant",
        )?;
        info!(
            "Granted handle {handle} to user {user} and dApp {} (tx {})",
            self.dapp, receipt.transaction_hash
        );
        Ok(())
    }

    /// `delegator` calls the real `ACL.delegateForUserDecryption(delegate, contract, expiration)`.
    pub async fn delegate(
        &self,
        delegator: Address,
        delegate: Address,
        contract: Address,
        expiration_date: u64,
    ) -> anyhow::Result<()> {
        let receipt = ensure_success(
            ACL::new(self.acl, &self.provider)
                .delegateForUserDecryption(delegate, contract, expiration_date)
                .from(delegator)
                .send()
                .await?
                .get_receipt()
                .await?,
            "delegateForUserDecryption",
        )?;
        info!(
            "Delegation {delegator} -> {delegate} for contract {contract} until {expiration_date} \
            (tx {})",
            receipt.transaction_hash
        );
        Ok(())
    }

    /// Direct (non-recorded) read of the ACL views, used only for the harness sanity table.
    pub fn instance(&self) -> ACLInstance<&DynProvider> {
        ACL::new(self.acl, &self.provider)
    }
}
