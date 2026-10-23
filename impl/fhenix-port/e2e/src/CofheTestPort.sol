// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: Fhenix's published mock stack with the port's registry. `deployMocksWithPortACL` runs the plugin's own
// `deployMocks` unchanged, then puts the port's ACL (behind an ERC-1967 proxy, as deployed) and the port's ACP share
// registry where the mock ACL and the package's registry were: the mock TaskManager and the mock threshold network
// are pointed at the port's ACL, and the plugin's `mockAcl` and `acpShareRegistry` handles at the port's contracts.
// The mock TaskManager's operand check still calls `isAllowed`, the gated use view: it takes no engine exemption,
// which R10 allows (the exemption is a MAY).

import {CofheTest} from "@cofhe/foundry-plugin/contracts/CofheTest.sol";
import {MockACL} from "@cofhe/mock-contracts/contracts/MockACL.sol";
import {ACPShareRegistry} from "@cofhe/mock-contracts/contracts/ACPShareRegistry.sol";
import {ACL} from "../../src/ACL.sol";
import {ACPShareRegistry as PortACPShareRegistry} from "../../src/ACPShareRegistry.sol";
import {ERC1967Proxy} from "../../src/ERC1967Proxy.sol";

abstract contract CofheTestPort is CofheTest {
    ACL public portAcl;
    PortACPShareRegistry public portShareRegistry;

    function deployMocksWithPortACL() public {
        deployMocks();

        portAcl = ACL(
            address(
                new ERC1967Proxy(
                    address(new ACL()), abi.encodeCall(ACL.initialize, (address(this), 0, address(mockTaskManager)))
                )
            )
        );
        portAcl.setDefaultRevokerContract(address(acpRevoker));
        portShareRegistry = PortACPShareRegistry(
            address(
                new ERC1967Proxy(
                    address(new PortACPShareRegistry()),
                    abi.encodeCall(PortACPShareRegistry.initialize, (address(this)))
                )
            )
        );
        portShareRegistry.setRetirementRegistry(address(portAcl));
        portAcl.setShareRegistry(address(portShareRegistry));

        vm.prank(TM_ADMIN);
        mockTaskManager.setACLContract(address(portAcl));
        mockThresholdNetwork.initialize(address(mockTaskManager), address(portAcl));

        mockAcl = MockACL(address(portAcl));
        acpShareRegistry = ACPShareRegistry(address(portShareRegistry));
        vm.label(address(portAcl), "port ACL");
        vm.label(address(portShareRegistry), "port ACPShareRegistry");
    }
}
