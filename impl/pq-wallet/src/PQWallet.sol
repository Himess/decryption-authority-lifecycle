// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IMLDSAVerifier} from "mldsa/IMLDSAVerifier.sol";

/// @title PQWallet (TEST ONLY, NOT AUDITED)
/// @notice Phase 5, B0: a minimal contract wallet whose only authority is one ML-DSA-44 (FIPS 204) key.
///         - `isValidSignature(hash, signature)` (ERC-1271) accepts iff `signature` is a valid 2,420-byte ML-DSA-44
///           signature over the 32-byte `hash` (message M = hash, empty FIPS 204 context).
///         - `execute(target, data, signature)` calls `target` with `data`, authorized by an ML-DSA-44 signature over
///           `executeDigest(target, data)`, which binds the chain id, this account, its nonce, the target and the
///           data. Anyone can submit it and pay the gas (a relayer); the nonce makes each signature single-use.
///         The same code serves as a deployed contract (key set by the constructor) and as an EIP-7702 delegate (key
///         set once by the account itself through `initialize`). The key lives in ERC-7201 namespaced storage, so a
///         delegated account's other storage is not touched, and an account that later adopts this code as its own
///         (EIP-8298) keeps it.
/// @dev    Signatures are checked by fireblocks-labs/evm-ml-dsa-verifier at cca262b5, unaudited research code,
///         vendored in impl/p3-operator-ratification/vendor/. Key registration follows that verifier's shape (b)
///         (docs/SAFETY.md §3.1): the owner derives the public-key blob client-side with the upstream
///         prepare/prepare.py from its own genuine key, deploys it as a data contract, and this wallet only ever
///         passes the stored blob address to the verifier. The wallet does not validate the blob.
contract PQWallet {
    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_REJECT = 0xffffffff;
    uint256 internal constant MLDSA44_SIG_BYTES = 2420;

    /// @notice keccak256("PQWallet.execute(uint256 chainId,address wallet,uint256 nonce,address target,bytes32 dataHash)")
    bytes32 public constant EXECUTE_TYPEHASH = 0xee1ab2b804e7e54a9cdc20e1a9f6c0143c163e3d54a8b4ee164b0abd3e0ee2c2;

    /// @custom:storage-location erc7201:fhe-authority-lifecycle.storage.PQWallet
    struct WalletStorage {
        address pkBlob;
        bytes32 pkHash;
        uint256 nonce;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("fhe-authority-lifecycle.storage.PQWallet")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0xee161f0ecf558526e61f9da3c9d34937b040975b377fc6140341767857906900;

    /// @notice The verifier is part of the code that every account using this wallet shares.
    IMLDSAVerifier public immutable VERIFIER;

    event Initialized(address indexed pkBlob, bytes32 pkHash);
    event Executed(uint256 indexed nonce, address indexed target, bytes32 dataHash);

    error AlreadyInitialized();
    error NotSelf(address caller);
    error InvalidKey();
    error SignatureRejected();
    error CallFailed(bytes returnData);

    /// @param verifier the ML-DSA-44 verifier
    /// @param pkBlob   the key blob of a deployed wallet, or address(0) for code that accounts delegate to
    /// @param pkHash   keccak256 of the 1,312-byte FIPS 204 public key (bookkeeping only; not checked on-chain)
    constructor(IMLDSAVerifier verifier, address pkBlob, bytes32 pkHash) {
        VERIFIER = verifier;
        if (pkBlob != address(0)) _initialize(pkBlob, pkHash);
    }

    /// @notice Sets the key of an EIP-7702 delegated account, once. Only the account itself can call it (a transaction
    ///         from the account to itself, which its ECDSA key still authorizes at that point).
    function initialize(address pkBlob, bytes32 pkHash) external {
        if (msg.sender != address(this)) revert NotSelf(msg.sender);
        _initialize(pkBlob, pkHash);
    }

    /// @notice ERC-1271.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        return _verify(hash, signature) ? ERC1271_MAGIC_VALUE : ERC1271_REJECT;
    }

    /// @notice The 32-byte message the key signs to authorize `execute(target, data, ·)` at the current nonce.
    function executeDigest(address target, bytes calldata data) public view returns (bytes32) {
        return keccak256(
            abi.encode(EXECUTE_TYPEHASH, block.chainid, address(this), _storage().nonce, target, keccak256(data))
        );
    }

    /// @notice Calls `target` with `data` (no value), authorized by the key. Reverts with the target's revert data.
    function execute(address target, bytes calldata data, bytes calldata signature)
        external
        returns (bytes memory result)
    {
        bytes32 digest = executeDigest(target, data);
        if (!_verify(digest, signature)) revert SignatureRejected();
        WalletStorage storage $ = _storage();
        uint256 used = $.nonce;
        $.nonce = used + 1;
        bool ok;
        (ok, result) = target.call(data);
        if (!ok) revert CallFailed(result);
        emit Executed(used, target, keccak256(data));
    }

    function nonce() external view returns (uint256) {
        return _storage().nonce;
    }

    function key() external view returns (address pkBlob, bytes32 pkHash) {
        WalletStorage storage $ = _storage();
        return ($.pkBlob, $.pkHash);
    }

    /// @notice Plain ether transfers to the account still succeed under this code.
    receive() external payable {}

    function _initialize(address pkBlob, bytes32 pkHash) private {
        WalletStorage storage $ = _storage();
        if ($.pkBlob != address(0)) revert AlreadyInitialized();
        if (pkBlob.code.length == 0) revert InvalidKey();
        $.pkBlob = pkBlob;
        $.pkHash = pkHash;
        emit Initialized(pkBlob, pkHash);
    }

    function _verify(bytes32 hash, bytes calldata signature) private view returns (bool) {
        address pkBlob = _storage().pkBlob;
        if (pkBlob == address(0)) return false;
        if (signature.length != MLDSA44_SIG_BYTES) return false;
        // The verifier's revert and `false` both mean "not accepted"; ERC-1271 callers get the reject value either way.
        try VERIFIER.verify(pkBlob, abi.encodePacked(hash), signature) returns (bool accepted) {
            return accepted;
        } catch {
            return false;
        }
    }

    function _storage() private pure returns (WalletStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }
}
