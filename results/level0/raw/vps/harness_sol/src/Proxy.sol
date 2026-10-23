// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Unmodified OpenZeppelin v5.1.0 ERC1967Proxy (the proxy Zama's own Foundry deploy utils use for the ACL:
// host-contracts/fhevm-foundry/HostContractsDeployerTestUtils.sol `DeployableERC1967Proxy`).
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployableERC1967Proxy is ERC1967Proxy {
    constructor(address implementation, bytes memory data) ERC1967Proxy(implementation, data) {}
}
