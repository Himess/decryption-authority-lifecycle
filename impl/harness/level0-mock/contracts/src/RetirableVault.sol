// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// Test-only app contract for the Level 0 cleartext-mock run (MOCK_E2E.md, scenario 4).
// Local anvil only; never deployed anywhere else.
//
// It holds encrypted balances the way an app does: the input is verified with
// FHE.fromExternal, then the contract grants the handle to itself and to the depositor,
// so the contract is persistently allowed on every handle it stores (the "contract
// role" of a user or delegated decryption). Its owner can make the contract retire its
// own decryption authority through a helper function, retire(), which calls
// ACL.retireAccount() with msg.sender = this contract.
//
// Grants use Impl.allow, exactly as Zama's own FHETest does (sdk/js-sdk/contracts/src/
// FHETest.sol, _setHandleOf). FHE.allow / FHE.allowThis first call
// FHEVMExecutor.checkHandleType, which the vendored v0.13.0 CleartextFHEVMExecutor does
// not implement (ENV_BASELINE.md §4.5), so they revert on this mock stack.

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig, Impl} from "@fhevm/solidity/lib/Impl.sol";

interface IACLRetirement {
    function retireAccount() external;
}

contract RetirableVault {
    address public immutable owner;
    address public immutable acl;

    mapping(address account => bytes32 handle) private _balanceOf;

    error NotOwner(address caller);

    constructor(CoprocessorConfig memory config) {
        owner = msg.sender;
        acl = config.ACLAddress;
        FHE.setCoprocessor(config);
    }

    /// @notice Stores an encrypted amount for the caller; the contract keeps access for itself.
    function deposit(externalEuint64 amount, bytes calldata inputProof) external returns (bytes32 handle) {
        euint64 value = FHE.fromExternal(amount, inputProof);
        handle = euint64.unwrap(value);
        Impl.allow(handle, address(this));
        Impl.allow(handle, msg.sender);
        _balanceOf[msg.sender] = handle;
    }

    function balanceOf(address account) external view returns (bytes32) {
        return _balanceOf[account];
    }

    /// @notice App-level re-grant performed by the contract itself (a grant path whose caller is this contract).
    function shareBalance(address to) external {
        Impl.allow(_balanceOf[msg.sender], to);
    }

    /// @notice Helper: the contract retires its own decryption authority (msg.sender at the ACL = this contract).
    function retire() external {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        IACLRetirement(acl).retireAccount();
    }
}
