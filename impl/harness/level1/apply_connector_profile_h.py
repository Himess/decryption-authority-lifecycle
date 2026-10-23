"""[lifecycle Level 1, part 2] Wire Profile H into the main kms-worker's DecryptionProcessor (decryption.rs).

Off by default (`profile_h.enabled = false`): every change below is gated by `self.profile_h`, so the connector's
behaviour and its host-chain RPCs are unchanged unless Profile H is switched on. With it on:
  - RFC-016 signature check: `verify_user_decryption_signature` (H1-H4, H8), dispositions mapped to recoverable /
    irrecoverable, the H4 attempt state kept per request (by EIP-712 digest), shadow verdicts logged;
  - H5 (V7): an ACL denial resting on a retired account becomes a final `account_retired` denial;
  - H6: the legacy (ECDSA-only, gateway-verified) path refuses a user with regular code on the host chain.
Every replacement must match exactly once. Usage: python -I apply_connector_profile_h.py <decryption.rs>
"""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (old[:80], n)
    s = s.replace(old, new)


# ------------------------------------------------------------------ imports
rep(
    """use crate::core::{
    config::Config,
""",
    """use crate::core::{
    config::{Config, ProfileHConfig},
""",
)
rep(
    """use std::collections::HashMap;
use tracing::info;
use user_decryption_signature::compute_user_decrypt_digest;
""",
    """use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tracing::{info, warn};
use user_decryption_signature::{
    AttemptState, Disposition, SignatureInput, SignaturePolicy, compute_user_decrypt_digest,
};
""",
)

# ------------------------------------------------------------------ state
rep(
    """    /// Gas cap for the `IERC1271.isValidSignature` static call (RFC-012).
    erc1271_gas_limit: u64,
}
""",
    """    /// Gas cap for the `IERC1271.isValidSignature` static call (RFC-012).
    erc1271_gas_limit: u64,

    /// [lifecycle Level 1] Profile H, when enabled in the configuration.
    profile_h: Option<ProfileH>,
}

/// [lifecycle Level 1] Runtime state of Profile H.
#[derive(Clone)]
struct ProfileH {
    config: ProfileHConfig,
    policy: SignaturePolicy,
    /// H4 attempt state per request, keyed by the request's EIP-712 digest. In memory: a restart forgets it, which
    /// can grant at most `max_erc1271_attempts` further attempts to a request already being retried.
    attempts: Arc<Mutex<HashMap<B256, AttemptState>>>,
}
""",
)
rep(
    """            ciphertext_manager,
            erc1271_gas_limit: config.erc1271_gas_limit,
        }
    }
""",
    """            ciphertext_manager,
            erc1271_gas_limit: config.erc1271_gas_limit,
            profile_h: config.profile_h.enabled.then(|| {
                let policy = config.profile_h.signature_policy();
                info!(
                    "PROFILE-H enabled: mode={} b_exec={} caps=({}, {}, {}) attempts={} eip7702_fallback={} \\
                    final_retirement_denials={} refuse_regular_code_on_legacy={}",
                    policy.mode,
                    policy.erc1271_execution_budget,
                    policy.max_user_signature_bytes,
                    policy.max_public_key_bytes,
                    policy.max_extra_data_bytes,
                    policy.max_erc1271_attempts,
                    policy.eip7702_fallback,
                    config.profile_h.final_retirement_denials,
                    config.profile_h.refuse_regular_code_on_legacy,
                );
                ProfileH {
                    config: config.profile_h.clone(),
                    policy,
                    attempts: Arc::default(),
                }
            }),
        }
    }

    /// [lifecycle Level 1, H5 / V7] Turns an ACL denial into a final `account_retired` denial when one of the
    /// accounts the denied check rests on is retired (retirement is one-way, so the check can never pass again).
    /// Returns `denial` unchanged when Profile H or H5 is off, when no subject is retired, or when the registry
    /// cannot answer `isAccountRetired` (no lifecycle Core).
    async fn finalize_if_retired(
        &self,
        host_client: &HostRpcClient<HP>,
        denial: RequestCheckError,
        subjects: &[(&'static str, Address)],
    ) -> RequestCheckError {
        let Some(profile_h) = &self.profile_h else {
            return denial;
        };
        if !profile_h.config.final_retirement_denials {
            return denial;
        }
        for (role, account) in subjects {
            if host_client.is_account_retired(*account).await == Some(true) {
                return RequestCheckError::irrecoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AccountRetired,
                    anyhow!(
                        "ACCOUNT_RETIRED: the {role} {account} has retired its decryption authority ({denial})"
                    ),
                );
            }
        }
        denial
    }

    /// [lifecycle Level 1] The RFC-016 signature check: today's `verify_signature`, or Profile H when enabled.
    async fn verify_user_signature(
        &self,
        host_client: &HostRpcClient<HP>,
        payload: &fhevm_gateway_bindings::decryption::IDecryption::UserDecryptionRequestPayload,
        digest: B256,
    ) -> Result<(), RequestCheckError> {
        let Some(profile_h) = &self.profile_h else {
            return host_client
                .verify_signature(
                    payload.userAddress,
                    digest,
                    payload.signature.as_ref(),
                    self.erc1271_gas_limit,
                )
                .await;
        };
        let input = SignatureInput::from_payload(payload, digest);
        let attempts = profile_h
            .attempts
            .lock()
            .expect("profile_h attempts lock")
            .get(&digest)
            .copied()
            .unwrap_or_default();
        let outcome = host_client
            .verify_signature_profile_h(&input, &profile_h.policy, attempts)
            .await;
        if let Some(report) = outcome.shadow()
            && (report.would_reject() || report.would_accept())
        {
            info!(
                "PROFILE-H-SHADOW signer={} would_reject={} would_accept={} served={:?} code_first={:?} code={:?}",
                payload.userAddress,
                report.would_reject(),
                report.would_accept(),
                report.served,
                report.code_first,
                report.code,
            );
        }
        match outcome.result {
            Ok(verification) => {
                profile_h
                    .attempts
                    .lock()
                    .expect("profile_h attempts lock")
                    .remove(&digest);
                info!(
                    "PROFILE-H accepted signer={} path={:?} block={:?} code={:?} erc1271_calls={}",
                    payload.userAddress,
                    verification.path,
                    verification.block,
                    verification.code,
                    verification.erc1271_calls,
                );
                Ok(())
            }
            Err(rejection) => {
                profile_h
                    .attempts
                    .lock()
                    .expect("profile_h attempts lock")
                    .insert(digest, outcome.attempts);
                warn!(
                    "PROFILE-H rejected signer={} error={} disposition={:?} block={:?} code={:?} erc1271_calls={} \\
                    attempts={:?}",
                    payload.userAddress,
                    rejection.error,
                    rejection.disposition,
                    rejection.block,
                    rejection.code,
                    rejection.erc1271_calls,
                    outcome.attempts,
                );
                Err(match rejection.disposition {
                    Disposition::Final => RequestCheckError::irrecoverable(
                        RequestCheckKind::Signature,
                        ErrorCode::UserSignatureRejected,
                        rejection.error,
                    ),
                    Disposition::RetryNextBlock | Disposition::AwaitingNextBlock => {
                        RequestCheckError::recoverable(
                            RequestCheckKind::Signature,
                            ErrorCode::UserSignatureRejected,
                            rejection.error,
                        )
                    }
                    Disposition::Transport => RequestCheckError::network(rejection.error),
                })
            }
        }
    }
""",
)

# ------------------------------------------------------------------ H6 on the legacy path
rep(
    """        let signature_host_client =
            self.host_clients.get(&contracts_chain_id).ok_or_else(|| {
                RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::UpstreamTransient,
                    anyhow!("No ACL contract config found for chain id {contracts_chain_id}"),
                )
            })?;
""",
    """        let signature_host_client =
            self.host_clients.get(&contracts_chain_id).ok_or_else(|| {
                RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::UpstreamTransient,
                    anyhow!("No ACL contract config found for chain id {contracts_chain_id}"),
                )
            })?;

        // [lifecycle Level 1, H6] This path's signature is verified by ECDSA only (by the gateway), so a user with
        // regular code on the host chain (an EIP-8298-migrated account, say) is refused. EIP-7702 accounts are not
        // regular code.
        if let Some(profile_h) = &self.profile_h
            && profile_h.config.refuse_regular_code_on_legacy
        {
            let code = signature_host_client.account_code(user_address).await?;
            if code.is_regular() {
                return Err(RequestCheckError::irrecoverable(
                    RequestCheckKind::Signature,
                    ErrorCode::UserSignatureRejected,
                    anyhow!(
                        "PROFILE-H6: {user_address} has regular code ({code:?}) on host chain \\
                        {contracts_chain_id}; this path verifies its signature by ECDSA only"
                    ),
                ));
            }
        }
""",
)

# ------------------------------------------------------------------ H5 on the legacy delegated check
rep(
    """        if !is_delegated {
            return Err(RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!(
                    "{user_address} is not a delegate of {delegator_address} for contract \\
                    {contract_address} and handle {handle}!",
                ),
            ));
        }

        Ok(())
    }
""",
    """        if !is_delegated {
            let denial = RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!(
                    "{user_address} is not a delegate of {delegator_address} for contract \\
                    {contract_address} and handle {handle}!",
                ),
            );
            return Err(self
                .finalize_if_retired(
                    host_client,
                    denial,
                    &[
                        ("delegator", delegator_address),
                        ("delegate", user_address),
                        ("contract", contract_address),
                    ],
                )
                .await);
        }

        Ok(())
    }
""",
)

# ------------------------------------------------------------------ RFC-016 signature check
rep(
    """            host_client.verify_signature(
                payload.userAddress,
                digest,
                payload.signature.as_ref(),
                self.erc1271_gas_limit,
            ),""",
    """            self.verify_user_signature(host_client, payload, digest),""",
)

# ------------------------------------------------------------------ H5 on RFC-016 ownership
rep(
    """            let user_allowed = host_client.is_allowed(entry.handle, user_address).await?;
            if !user_allowed {
                return Err(RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AclDenied,
                    anyhow!("{user_address} is not allowed to decrypt {handle_hex}"),
                ));
            }""",
    """            let user_allowed = host_client.is_allowed(entry.handle, user_address).await?;
            if !user_allowed {
                let denial = RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AclDenied,
                    anyhow!("{user_address} is not allowed to decrypt {handle_hex}"),
                );
                return Err(self
                    .finalize_if_retired(host_client, denial, &[("user", user_address)])
                    .await);
            }""",
)
rep(
    """            if !is_delegated {
                return Err(RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AclDenied,
                    anyhow!(
                        "{user_address} is not a delegate of {} for contract {} and handle {handle_hex}",
                        entry.ownerAddress,
                        entry.contractAddress,
                    ),
                ));
            }""",
    """            if !is_delegated {
                let denial = RequestCheckError::recoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AclDenied,
                    anyhow!(
                        "{user_address} is not a delegate of {} for contract {} and handle {handle_hex}",
                        entry.ownerAddress,
                        entry.contractAddress,
                    ),
                );
                return Err(self
                    .finalize_if_retired(
                        host_client,
                        denial,
                        &[
                            ("owner", entry.ownerAddress),
                            ("user", user_address),
                            ("contract", entry.contractAddress),
                        ],
                    )
                    .await);
            }""",
)

# ------------------------------------------------------------------ H5 on RFC-016 allowedContracts (all must be retired)
rep(
    """        // No contract returned true (all denied, all RPC calls failed, or a mix of both).
        Err(RequestCheckError::recoverable(
            RequestCheckKind::Acl,
            ErrorCode::AclDenied,
            anyhow!(
                "No contract in allowedContracts is allowed to decrypt handle {handle} ({rejections:?})",
            ),
        ))
    }""",
    """        // No contract returned true (all denied, all RPC calls failed, or a mix of both).
        let denial = RequestCheckError::recoverable(
            RequestCheckKind::Acl,
            ErrorCode::AclDenied,
            anyhow!(
                "No contract in allowedContracts is allowed to decrypt handle {handle} ({rejections:?})",
            ),
        );
        // [lifecycle Level 1, H5] Any-of semantics: final only when every listed contract is retired.
        if let Some(profile_h) = &self.profile_h
            && profile_h.config.final_retirement_denials
        {
            let mut all_retired = true;
            for contract in allowed_contracts {
                if host_client.is_account_retired(*contract).await != Some(true) {
                    all_retired = false;
                    break;
                }
            }
            if all_retired {
                return Err(RequestCheckError::irrecoverable(
                    RequestCheckKind::Acl,
                    ErrorCode::AccountRetired,
                    anyhow!(
                        "ACCOUNT_RETIRED: every contract in allowedContracts has retired ({denial})"
                    ),
                ));
            }
        }
        Err(denial)
    }""",
)

# ------------------------------------------------------------------ H5 on the legacy direct check
rep(
    """        if !user_allowed {
            return Err(RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!("{user_address} is not allowed to decrypt {handle}!"),
            ));
        }
        if !contract_allowed {
            return Err(RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!("{contract_address} is not allowed to decrypt {handle}!"),
            ));
        }

        Ok(())""",
    """        let subjects = [("user", user_address), ("contract", contract_address)];
        if !user_allowed {
            let denial = RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!("{user_address} is not allowed to decrypt {handle}!"),
            );
            return Err(self.finalize_if_retired(host_client, denial, &subjects).await);
        }
        if !contract_allowed {
            let denial = RequestCheckError::recoverable(
                RequestCheckKind::Acl,
                ErrorCode::AclDenied,
                anyhow!("{contract_address} is not allowed to decrypt {handle}!"),
            );
            return Err(self.finalize_if_retired(host_client, denial, &subjects).await);
        }

        Ok(())""",
)

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("applied Profile H wiring to", p)
