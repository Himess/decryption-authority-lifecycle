// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

interface IACLGrant {
    function allowTransient(bytes32 handle, address account) external;
    function allow(bytes32 handle, address account) external;
}

interface IDappStub {
    function onHandle(address acl, bytes32 handle, address user) external;
}

/// @notice TEST-ONLY stand-in for FHEVMExecutor. Its runtime code is placed with `anvil_setCode` at the
/// address the deployed ACL reports from `getFHEVMExecutorAddress()`. It reproduces the only executor
/// behaviour the ACL relies on: after producing a handle it calls `allowTransient(handle, dapp)` (the ACL
/// lets the executor do this unconditionally) and hands the handle to the calling dApp in the same tx.
contract ExecutorStub {
    function produce(address acl, bytes32 handle, address dapp, address user) external {
        IACLGrant(acl).allowTransient(handle, dapp);
        IDappStub(dapp).onHandle(acl, handle, user);
    }
}
