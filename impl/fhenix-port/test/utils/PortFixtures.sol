// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: test fixtures for the Decryption Authority Lifecycle Core on Fhenix CoFHE.

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {FHE, euint64, sharedEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ACL} from "../../src/ACL.sol";

/// @notice A contract account: its owner runs calls through it, one at a time or as one atomic batch, with the
///         account as `msg.sender`. It answers ERC-1271 for its owner's ECDSA signatures. It stands for a smart
///         account, for an EIP-7702 delegate's batching, and for an application contract that computes.
contract PortAccount {
    struct Call {
        address target;
        bytes data;
    }

    struct Result {
        bool ok;
        bytes ret;
    }

    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory) {
        require(msg.sender == owner, "PortAccount: not owner");
        return _call(target, data);
    }

    /// @notice All calls or none (the batching that R13 recommends, here done by the account).
    function executeBatch(Call[] calldata calls) external returns (bytes[] memory results) {
        require(msg.sender == owner, "PortAccount: not owner");
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            results[i] = _call(calls[i].target, calls[i].data);
        }
    }

    /// @notice Every call in one transaction, each outcome recorded instead of stopping at a failure. With Foundry's
    ///         isolation each top-level test call is its own transaction, so a sequence that needs a transient right
    ///         (and the views that read it) runs through here.
    function executeAll(Call[] calldata calls) external returns (Result[] memory results) {
        require(msg.sender == owner, "PortAccount: not owner");
        results = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = calls[i].target.call(calls[i].data);
            results[i] = Result(ok, ret);
        }
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(hash, signature);
        return err == ECDSA.RecoverError.NoError && signer == owner ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }

    function _call(address target, bytes calldata data) private returns (bytes memory ret) {
        bool ok;
        (ok, ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

/// @notice An application written against Fhenix's own FHE.sol (b5c20ed). It holds each user's balance handle and
///         acts as a deputy the way an ERC-7984 token does: before it moves or discloses a handle on a caller's
///         request, it asks the use view whether the caller may use that handle.
contract PortApp {
    error CallerNotAllowed(address caller);

    mapping(address account => euint64 balance) public balanceOf;

    /// @notice The caller deposits a fresh encrypted input; the app keeps it as the caller's balance and grants it to
    ///         itself and to the caller (persistent).
    function deposit(bytes calldata input) external returns (euint64 v) {
        v = FHE.asEuint64(input);
        FHE.allowThis(v);
        FHE.allow(v, msg.sender);
        balanceOf[msg.sender] = v;
    }

    /// @notice Deputy transfer of the caller's balance to `to`.
    function transferBalance(address to) external {
        euint64 b = balanceOf[msg.sender];
        if (!FHE.isAllowed(b, msg.sender)) revert CallerNotAllowed(msg.sender);
        balanceOf[to] = b;
        balanceOf[msg.sender] = euint64.wrap(0);
        FHE.allow(b, to);
    }

    /// @notice Deputy disclosure of the caller's balance.
    function discloseBalance() external {
        euint64 b = balanceOf[msg.sender];
        if (!FHE.isAllowed(b, msg.sender)) revert CallerNotAllowed(msg.sender);
        FHE.allowPublic(b);
    }

    /// @notice Deputy transfer of a handle the caller holds; the caller must first give the app a right on it.
    function transferHandle(address to, euint64 h) external {
        if (!FHE.isAllowed(h, msg.sender)) revert CallerNotAllowed(msg.sender);
        FHE.allow(h, to);
    }

    /// @notice Deputy disclosure of a handle the caller holds; the caller must first give the app a right on it.
    function discloseHandle(euint64 h) external {
        if (!FHE.isAllowed(h, msg.sender)) revert CallerNotAllowed(msg.sender);
        FHE.allowPublic(h);
    }

    /// @notice Receives a handle shared with this app (FHE.shareEuint64 by the caller) and keeps it for `to`.
    function receiveFor(address to, sharedEuint64 s) external returns (euint64 h) {
        h = FHE.receiveEuint64Param(s);
        FHE.allowThis(h);
        FHE.allow(h, to);
    }
}

/// @notice TC11: a Core implementation that reads retirement state at another location.
contract CoreOtherLocation {
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x556d2088 || id == 0x01ffc9a7;
    }

    function retirementStorageLocation() external pure returns (bytes32) {
        return keccak256("another location");
    }

    function proxiableUUID() external pure returns (bytes32) {
        return 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    }
}

/// @notice TC11: an implementation that reads retirement state at the port's location but does not declare Core.
contract LocationWithoutCore {
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7;
    }

    function retirementStorageLocation() external pure returns (bytes32) {
        return 0xfb6f17ca58407a16d354df28099d1c3b0fae80bca895f989456c75e03a668600;
    }

    function proxiableUUID() external pure returns (bytes32) {
        return 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    }
}

/// @notice TC11: an implementation at the port's location whose ERC-165 answer for Core is the word 2, not a bool.
contract CoreAnswersTwo {
    function supportsInterface(bytes4) external pure returns (uint256) {
        return 2;
    }

    function retirementStorageLocation() external pure returns (bytes32) {
        return 0xfb6f17ca58407a16d354df28099d1c3b0fae80bca895f989456c75e03a668600;
    }

    function proxiableUUID() external pure returns (bytes32) {
        return 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    }
}

/// @notice TC11: an implementation that answers both checks as the port does and enforces nothing. Its use view
///         answers true for every account (the asserted residual: only a canary catches it).
contract LyingImplementation {
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x556d2088 || id == 0x01ffc9a7;
    }

    function retirementStorageLocation() external pure returns (bytes32) {
        return 0xfb6f17ca58407a16d354df28099d1c3b0fae80bca895f989456c75e03a668600;
    }

    function proxiableUUID() external pure returns (bytes32) {
        return 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    }

    function isAccountRetired(address) external pure returns (bool) {
        return false;
    }

    function isAllowed(uint256, address) external pure returns (bool) {
        return true;
    }
}

/// @notice TC11: an implementation whose ERC-165 answer is malformed (two words), or that reverts.
contract MalformedImplementation {
    bool public immutable reverts;

    constructor(bool reverts_) {
        reverts = reverts_;
    }

    fallback() external {
        if (reverts) revert("no");
        assembly {
            mstore(0, 1)
            mstore(32, 1)
            return(0, 64)
        }
    }
}

/// @notice The R10 negative test. The port with the engine exemption defined by caller identity instead of a
///         dedicated entry point: retirement is not consulted when the TaskManager is the caller, as a "skip when
///         the caller is the engine" rule copied from a registry whose engine calls it directly would do. Test only.
contract ACLCallerExemption is ACL {
    function _isRetired(address account) internal view override returns (bool) {
        if (msg.sender == _getACLStorage().taskManager) {
            return false;
        }
        return super._isRetired(account);
    }
}
