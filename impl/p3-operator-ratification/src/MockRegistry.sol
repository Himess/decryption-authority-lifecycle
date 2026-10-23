// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title A stand-in for an upgradeable registry (Phase 4, P3 prototype)
/// @notice Records the implementation an upgrade installs; only its owner (the ratifying upgrader) may upgrade. It
///         stands for the access-control registry so that the measurement isolates the ratification itself.
contract MockRegistry {
    address public owner;
    address public implementation;
    uint256 public upgrades;

    event Upgraded(address indexed implementation);

    error NotOwner(address caller);
    error UpgradeCallFailed();

    constructor(address implementation_) {
        owner = msg.sender;
        implementation = implementation_;
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        owner = newOwner;
    }

    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        implementation = newImplementation;
        ++upgrades;
        if (data.length > 0) {
            (bool ok,) = newImplementation.delegatecall(data);
            if (!ok) revert UpgradeCallFailed();
        }
        emit Upgraded(newImplementation);
    }
}

/// @notice Two empty implementations, so that an upgrade has distinct addresses to install.
contract RegistryImplementationV1 {
    function version() external pure returns (uint256) {
        return 1;
    }
}

contract RegistryImplementationV2 {
    function version() external pure returns (uint256) {
        return 2;
    }
}
