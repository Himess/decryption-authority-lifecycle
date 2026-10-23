// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IMLDSAVerifier} from "../vendor/evm-ml-dsa-verifier-cca262b5/src/IMLDSAVerifier.sol";

interface IUpgradeableRegistry {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/// @title Operator-ratified registry upgrades (Phase 4, P3 prototype; research code, not audited)
/// @notice The end state of the governance profile: a registry upgrade executes only after a delay, and only with
///         ML-DSA-44 (FIPS 204) signatures of at least `threshold` of the registered operators, verified on-chain.
///         The verifier is fireblocks-labs/evm-ml-dsa-verifier at cca262b5, which is unaudited research code.
/// @dev    Each operator key is a prepared public-key blob contract (the verifier's format). Operators sign the
///         32-byte proposal id, which binds the domain, the chain, this contract, the registry, the new
///         implementation, the call data and a nonce that every execution advances (no replay).
contract OperatorRatifiedUpgrader {
    bytes32 public constant DOMAIN = keccak256("ERC-XXXX operator ratification v1");

    IMLDSAVerifier public immutable verifier;
    address public immutable registry;
    address public immutable proposer;
    uint256 public immutable threshold;
    uint256 public immutable delay;
    address[] internal _operatorKeys;
    uint256 public nonce;
    mapping(bytes32 => uint256) public eta;

    event UpgradeProposed(bytes32 indexed id, address newImplementation, bytes32 dataHash, uint256 eta);
    event UpgradeRatified(bytes32 indexed id, address newImplementation, uint256 signatures);

    error InvalidConfiguration();
    error NotProposer(address caller);
    error AlreadyProposed(bytes32 id);
    error UnknownProposal(bytes32 id);
    error TooEarly(uint256 eta);
    error LengthMismatch();
    error SignerOutOfOrder(uint256 position);
    error SignatureRejected(uint256 position, uint256 operator);
    error NotEnoughSignatures(uint256 valid, uint256 needed);

    constructor(
        IMLDSAVerifier verifier_,
        address registry_,
        address proposer_,
        address[] memory operatorKeys_,
        uint256 threshold_,
        uint256 delay_
    ) {
        if (threshold_ == 0 || threshold_ > operatorKeys_.length) revert InvalidConfiguration();
        verifier = verifier_;
        registry = registry_;
        proposer = proposer_;
        _operatorKeys = operatorKeys_;
        threshold = threshold_;
        delay = delay_;
    }

    function operatorKeys() external view returns (address[] memory) {
        return _operatorKeys;
    }

    /// @notice The id operators sign for this upgrade, at the current nonce.
    function proposalId(address newImplementation, bytes calldata data) public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN, block.chainid, address(this), registry, newImplementation, keccak256(data), nonce)
        );
    }

    /// @notice Starts the delay. Only the proposer (for example, the existing governance) may propose.
    function propose(address newImplementation, bytes calldata data) external returns (bytes32 id) {
        if (msg.sender != proposer) revert NotProposer(msg.sender);
        id = proposalId(newImplementation, data);
        if (eta[id] != 0) revert AlreadyProposed(id);
        uint256 when = block.timestamp + delay;
        eta[id] = when;
        emit UpgradeProposed(id, newImplementation, keccak256(data), when);
    }

    /// @notice Executes a proposed upgrade once the delay has passed. `signers` are operator indices in strictly
    ///         increasing order; `signatures[i]` is operator `signers[i]`'s ML-DSA-44 signature over the 32-byte id.
    ///         Every signature passed must verify; at least `threshold` must be passed.
    function execute(
        address newImplementation,
        bytes calldata data,
        uint256[] calldata signers,
        bytes[] calldata signatures
    ) external {
        bytes32 id = proposalId(newImplementation, data);
        uint256 when = eta[id];
        if (when == 0) revert UnknownProposal(id);
        if (block.timestamp < when) revert TooEarly(when);
        if (signers.length != signatures.length) revert LengthMismatch();
        if (signers.length < threshold) revert NotEnoughSignatures(signers.length, threshold);
        bytes memory message = abi.encodePacked(id);
        for (uint256 i = 0; i < signers.length; ++i) {
            uint256 s = signers[i];
            if (s >= _operatorKeys.length || (i > 0 && s <= signers[i - 1])) revert SignerOutOfOrder(i);
            if (!verifier.verify(_operatorKeys[s], message, signatures[i])) revert SignatureRejected(i, s);
        }
        delete eta[id];
        ++nonce;
        IUpgradeableRegistry(registry).upgradeToAndCall(newImplementation, data);
        emit UpgradeRatified(id, newImplementation, signers.length);
    }
}
