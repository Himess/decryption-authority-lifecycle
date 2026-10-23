// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IMLDSAVerifier} from "../vendor/evm-ml-dsa-verifier-cca262b5/src/IMLDSAVerifier.sol";
import {OperatorRatifiedUpgrader} from "./OperatorRatifiedUpgrader.sol";

interface IOwnable2Step {
    function acceptOwnership() external;
}

/// @title The operator-ratified upgrader as a registry's owner (Phase 5, B5; research code, not audited)
/// @notice Phase 4's OperatorRatifiedUpgrader, unchanged, plus what owning a two-step-ownable registry needs: accepting
///         the ownership transfer the current owner started. Accepting gives this contract nothing beyond what it
///         already controls: the registry's upgrades, each one ratified by ML-DSA-44 signatures of at least `threshold`
///         operators after the delay. The verifier is fireblocks-labs/evm-ml-dsa-verifier at cca262b5 (unaudited).
contract OperatorRatifiedRegistryOwner is OperatorRatifiedUpgrader {
    constructor(
        IMLDSAVerifier verifier_,
        address registry_,
        address proposer_,
        address[] memory operatorKeys_,
        uint256 threshold_,
        uint256 delay_
    ) OperatorRatifiedUpgrader(verifier_, registry_, proposer_, operatorKeys_, threshold_, delay_) {}

    /// @notice Completes a pending ownership transfer of the registry to this contract. Anyone may call it.
    function acceptRegistryOwnership() external {
        IOwnable2Step(registry).acceptOwnership();
    }
}
