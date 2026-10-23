// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";

interface IVmEvmVersion {
    function getEvmVersion() external view returns (string memory);
}

contract Store {
    mapping(uint256 => uint256) public m;
    function setNew(uint256 k) external { m[k] = 1; }
    function setTwo(uint256 k) external { m[k] = 2; }
    function noop() external {}
    function create() external returns (address a) { a = address(new Tiny()); }
    function fill(uint256 from, uint256 n) external { for (uint256 i; i < n; i++) m[from + i] = 1; }
}

contract Tiny {
    uint256 internal x;
}

/// @notice frame = vm.lastCallGas().gasTotalUsed (the called frame); caller = gasleft() delta in the caller
///         (frame + CALL overhead + gas charged outside the frame).
contract PrimitivesTest is Test {
    function _m(string memory label, uint256 caller) internal view {
        console.log(string.concat("PRIM|", IVmEvmVersion(address(vm)).getEvmVersion(), "|", label, "|frame=",
            vm.toString(vm.lastCallGas().gasTotalUsed), "|caller=", vm.toString(caller)));
    }

    function test_primitives() public {
        Store s = new Store();
        vm.cool(address(s));
        uint256 g = gasleft(); s.noop(); _m("noop call to a cold account", g - gasleft());
        vm.cool(address(s));
        g = gasleft(); s.setNew(1); _m("SSTORE 0->1 (new slot)", g - gasleft());
        vm.cool(address(s));
        g = gasleft(); s.setTwo(1); _m("SSTORE 1->2 (existing slot)", g - gasleft());
        vm.cool(address(s));
        g = gasleft(); s.setTwo(1); _m("SSTORE 2->2 (same value)", g - gasleft());
        vm.cool(address(s));
        g = gasleft(); s.create(); _m("CREATE of a 1-slot contract", g - gasleft());
        vm.cool(address(s));
        g = gasleft(); s.fill(1000, 100); _m("100 new slots in one call", g - gasleft());
    }
}
