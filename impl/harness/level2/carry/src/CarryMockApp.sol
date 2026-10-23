// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

interface IACLGrant {
    function allow(bytes32 handle, address account) external;
}

/**
 * @notice Test-only app for the carry-tool harness. It grants handles it holds to accounts through the ACL, so the
 *         grants carry the app as `caller` in `Allowed(caller, account, handle)`, as a real app's grants do. The
 *         harness makes the app hold a handle by writing the ACL's persisted pair directly (anvil_setStorageAt).
 *         `confidentialBalanceOf` mimics an ERC-7984 token: each `setBalance` grants a new balance handle and makes
 *         it the current one, so earlier balance handles stay granted but are stale.
 */
contract CarryMockApp {
    IACLGrant public immutable acl;
    mapping(address account => bytes32) private _balances;

    constructor(address acl_) {
        acl = IACLGrant(acl_);
    }

    function grant(bytes32 handle, address account) external {
        acl.allow(handle, account);
    }

    function grantMany(bytes32[] calldata handles, address account) external {
        for (uint256 i = 0; i < handles.length; i++) {
            acl.allow(handles[i], account);
        }
    }

    function setBalance(address account, bytes32 handle) external {
        acl.allow(handle, account);
        _balances[account] = handle;
    }

    function confidentialBalanceOf(address account) external view returns (bytes32) {
        return _balances[account];
    }
}
