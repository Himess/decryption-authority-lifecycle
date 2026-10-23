// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, Vm} from "forge-std/Test.sol";

contract Target {
    uint256 public x = 1;
}

/// A minimal proxy: delegates every call to `impl`, as an ERC-1967 proxy does.
contract Forwarder {
    address internal immutable impl;

    constructor(address i) {
        impl = i;
    }

    fallback() external {
        address i = impl;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), i, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(ok) { revert(0, returndatasize()) }
            return(0, returndatasize())
        }
    }
}

/// Does vm.cool make an account cold for EIP-2929 account access, and does the frame gas include it?
contract CoolTest is Test {
    function test_cool() public {
        Target t = new Target();
        Forwarder p = new Forwarder(address(t));
        Target(address(p)).x();
        for (uint256 round = 0; round < 2; round++) {
            if (round == 0) {
                vm.cool(address(p));
                vm.cool(address(t));
            }
            uint256 g0 = gasleft();
            Target(address(p)).x();
            uint256 callerSide = g0 - gasleft();
            Vm.Gas memory fg = vm.lastCallGas();
            emit log_named_uint(round == 0 ? "after vm.cool: caller-side" : "warm: caller-side", callerSide);
            emit log_named_uint(round == 0 ? "after vm.cool: frame" : "warm: frame", fg.gasTotalUsed);
        }
    }
}
