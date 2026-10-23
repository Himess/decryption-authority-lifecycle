// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IACLGrant} from "./ExecutorStub.sol";

/// @notice TEST-ONLY dApp contract C. Equivalent of `FHE.allowThis(h); FHE.allow(h, user);` in a real
/// fhEVM app: it uses the transient allowance it just received from the executor to persist the
/// handle for itself and for `user` through the real ACL `allow` path.
contract DappStub {
    function onHandle(address acl, bytes32 handle, address user) external {
        IACLGrant(acl).allow(handle, address(this));
        IACLGrant(acl).allow(handle, user);
    }
}
