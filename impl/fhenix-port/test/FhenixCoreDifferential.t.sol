// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: TC3 (R6) on the Fhenix port. Fhenix's own suite is Hardhat with its plugins and a local Fhenix node,
// so the analogue is differential: random sequences of grants, shares, computations and publications by accounts that
// never retire run on the port (with a retired bystander present) and on Fhenix's unmodified TaskManager and ACL
// (b5c20ed). Every outcome, every revert, and every view at the end must be identical.

import {FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {ACL} from "../src/ACL.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {ERC1967Proxy} from "../src/ERC1967Proxy.sol";
import {ACP, SCOPE_GLOBAL} from "../src/Permissioned.sol";
import {ACL as VendorACL} from "../vendor/cofhe-contracts-b5c20ed/internal/host-chain/contracts/ACL.sol";
import {TaskManager as VendorTaskManager} from
    "../vendor/cofhe-contracts-b5c20ed/internal/host-chain/contracts/TaskManager.sol";
import {PortSetup} from "./utils/PortSetup.sol";
import {PortAccount} from "./utils/PortFixtures.sol";

contract FhenixCoreDifferentialTest is PortSetup {
    TaskManager internal tmV;
    ACL internal aclV; // Fhenix's ACL behind its proxy, called through the port's ABI (the shared functions are identical)
    PortAccount internal A;
    PortAccount internal B; // run by A, so that A's transaction can act through it
    address internal u1;
    uint256 internal u1Key;
    address internal u2 = makeAddr("u2");
    uint256[] internal handles;

    function setUp() public override {
        super.setUp();
        (u1, u1Key) = makeAddrAndKey("u1");
        vm.startPrank(admin);
        tmV = TaskManager(
            address(
                new ERC1967Proxy(address(new VendorTaskManager()), abi.encodeCall(TaskManager.initialize, (admin, 0)))
            )
        );
        aclV = ACL(
            address(
                new ERC1967Proxy(address(new VendorACL()), abi.encodeCall(VendorACL.initialize, (admin, 0, address(tmV))))
            )
        );
        tmV.grantRole(tmV.CONFIG_MANAGER_ROLE(), admin);
        tmV.grantRole(tmV.VERIFIER_SIGNER_MANAGER_ROLE(), admin);
        tmV.setACLContract(address(aclV));
        tmV.setVerifierSigner(verifier);
        vm.stopPrank();
        assertEq(aclV.getVersion(), "ACL v0.1.0");

        (A, ) = _newAccount("A");
        B = new PortAccount(address(A));
        // A retired bystander on the port only; it takes part in nothing.
        _retire(makeAddr("bystander"));
    }

    /// forge-config: default.fuzz.runs = 256
    function testFuzz_TC3_NeverRetiredAccountsSeeTheSameRegistry(uint256 seed, uint8[12] calldata kinds) public {
        for (uint256 i = 0; i < kinds.length; i++) {
            bytes memory p = _step(kinds[i] % 10, seed, i, tm, acl);
            bytes memory v = _step(kinds[i] % 10, seed, i, tmV, aclV);
            assertEq(keccak256(p), keccak256(v), string.concat("step ", vm.toString(i), " differs"));
            _remember(kinds[i] % 10, seed, i);
        }
        _compareViews();
    }

    /// @dev The steps do real work: a fixed script grants, shares, computes and publishes on both stacks.
    function test_TC3_AFixedScriptGrantsSharesComputesAndPublishes() public {
        uint8[6] memory script = [0, 1, 2, 3, 4, 9];
        uint256 seed = 3;
        for (uint256 i = 0; i < script.length; i++) {
            bytes memory p = _step(script[i], seed, i, tm, acl);
            assertEq(keccak256(p), keccak256(_step(script[i], seed, i, tmV, aclV)), "step differs");
            _remember(script[i], seed, i);
        }
        uint256 z = handles[0]; // step 0: computed by A, granted to u1 and A
        uint256 pub = handles[1]; // step 1: published
        uint256 dec = handles[2]; // step 2: marked for decryption, granted to u2
        uint256 shared = handles[3]; // step 3: shared to B, which granted it to u2
        ACL[2] memory acls = [acl, aclV];
        for (uint256 s = 0; s < 2; s++) {
            assertTrue(acls[s].persistAllowed(z, u1) && acls[s].persistAllowed(z, address(A)), "grant");
            assertTrue(acls[s].globalAllowed(pub), "publication");
            assertTrue(acls[s].isAllowedForDecryption(dec) && acls[s].persistAllowed(dec, u2), "decryption flag");
            assertTrue(acls[s].persistAllowed(shared, u2), "grant after a share");
        }
        _compareViews();
    }

    /// @dev Negative control: the comparison catches a difference. On the port only, u1 is retired.
    function test_TC3_NegativeControl_ARetiredActorIsCaught() public {
        _retire(u1);
        uint256 seed = 5;
        bytes memory p = _step(0, seed, 0, tm, acl);
        bytes memory v = _step(0, seed, 0, tmV, aclV);
        assertEq(keccak256(p), keccak256(v), "granting to u1 is not refused (R8), so step 0 is the same");
        _remember(0, seed, 0);
        try this.compareViewsExternal() {
            revert("the comparison missed a retired actor");
        } catch {}
    }

    function compareViewsExternal() external view {
        _compareViews();
    }

    // ------------------------------------------------------------------------------------------------------------

    function _raw(uint256 seed, uint256 i, uint256 j) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, i, j)));
    }

    function _pick(uint256 seed, uint256 i, uint256 j) internal view returns (uint256) {
        if (handles.length == 0) return _handle(_raw(seed, i, 99));
        return handles[_raw(seed, i, j) % handles.length];
    }

    /// @dev Handles created by a step, for the later steps to pick from (the same on both stacks).
    function _remember(uint256 kind, uint256 seed, uint256 i) internal {
        uint256 x = _handle(_raw(seed, i, 0));
        if (kind == 0) handles.push(_output(FunctionId.add, x, _handle(_raw(seed, i, 1))));
        if (kind >= 1 && kind <= 3) handles.push(x);
    }

    /// @dev One step on one stack; returns the outcome as bytes (ok flag and return or revert data).
    function _step(uint256 kind, uint256 seed, uint256 i, TaskManager t, ACL a) internal returns (bytes memory) {
        uint256 rx = _raw(seed, i, 0);
        uint256 x = _handle(rx);
        uint256 pick = _pick(seed, i, 2);
        if (kind == 0) {
            uint256 ry = _raw(seed, i, 1);
            uint256 z = _output(FunctionId.add, x, _handle(ry));
            _add(_verifyInputData(t, address(A), u1, rx));
            _add(_verifyInputData(t, address(A), u1, ry));
            _add(address(t), _createTaskData(FunctionId.add, x, _handle(ry)));
            _add(address(t), abi.encodeCall(TaskManager.allow, (z, u1)));
            _add(address(t), abi.encodeCall(TaskManager.allow, (z, address(A))));
            return abi.encode(_run(A));
        }
        if (kind == 1) {
            _add(_verifyInputData(t, address(A), u1, rx));
            _add(address(t), abi.encodeCall(TaskManager.allowGlobal, (x)));
            return abi.encode(_run(A));
        }
        if (kind == 2) {
            _add(_verifyInputData(t, address(A), u2, rx));
            _add(address(t), abi.encodeCall(TaskManager.allowForDecryption, (x)));
            _add(address(t), abi.encodeCall(TaskManager.allow, (x, u2)));
            return abi.encode(_run(A));
        }
        if (kind == 3) {
            _add(_verifyInputData(t, address(A), u1, rx));
            _add(address(t), abi.encodeCall(TaskManager.shareCtHash, (x, address(B))));
            _add(address(B), abi.encodeCall(PortAccount.execute, (address(t), abi.encodeCall(TaskManager.receiveCtHash, (x, address(A))))));
            _add(address(B), abi.encodeCall(PortAccount.execute, (address(t), abi.encodeCall(TaskManager.allow, (x, u2)))));
            _add(address(B), abi.encodeCall(PortAccount.execute, (address(a), abi.encodeCall(ACL.isAllowed, (x, address(B))))));
            return abi.encode(_run(A));
        }
        if (kind == 4) return _as(u1, address(t), abi.encodeCall(TaskManager.allow, (pick, u2)));
        if (kind == 5) return _as(u2, address(t), abi.encodeCall(TaskManager.allowGlobal, (pick)));
        if (kind == 6) {
            _add(address(t), abi.encodeCall(TaskManager.allowTransient, (pick, address(B))));
            _add(address(B), abi.encodeCall(PortAccount.execute, (address(a), abi.encodeCall(ACL.allowedTransient, (pick, address(B))))));
            _add(address(B), abi.encodeCall(PortAccount.execute, (address(a), abi.encodeCall(ACL.isAllowed, (pick, address(B))))));
            return abi.encode(_run(A));
        }
        if (kind == 7) {
            _add(address(t), _createTaskData(FunctionId.mul, pick, _pick(seed, i, 3)));
            return abi.encode(_run(A));
        }
        if (kind == 8) return _as(u1, address(t), _createTaskData(FunctionId.add, pick, pick));
        _add(address(t), abi.encodeCall(TaskManager.allow, (pick, address(B))));
        _add(address(B), abi.encodeCall(PortAccount.execute, (address(t), abi.encodeCall(TaskManager.allowGlobal, (pick)))));
        _add(address(B), abi.encodeCall(PortAccount.execute, (address(t), abi.encodeCall(TaskManager.allowForDecryption, (pick)))));
        return abi.encode(_run(A));
    }

    function _as(address who, address target, bytes memory data) internal returns (bytes memory) {
        vm.prank(who);
        (bool ok, bytes memory ret) = target.call(data);
        return abi.encode(ok, ret);
    }

    function _view(address target, bytes memory data) internal view returns (bytes memory) {
        (bool ok, bytes memory ret) = target.staticcall(data);
        return abi.encode(ok, ret);
    }

    function _compareViews() internal view {
        address[4] memory accounts = [address(A), address(B), u1, u2];
        ACP memory pP = _selfPermit(acl, u1, u1Key, SCOPE_GLOBAL);
        ACP memory pV = _selfPermit(aclV, u1, u1Key, SCOPE_GLOBAL);
        for (uint256 k = 0; k < handles.length; k++) {
            uint256 h = handles[k];
            _same(abi.encodeCall(ACL.globalAllowed, (h)), "globalAllowed");
            _same(abi.encodeCall(ACL.isAllowedForDecryption, (h)), "isAllowedForDecryption");
            _sameTm(abi.encodeCall(TaskManager.isPubliclyAllowed, (h)), "TaskManager.isPubliclyAllowed");
            _same(abi.encodeCall(ACL.allowedOnBehalf, (u2, h, address(A), u1)), "allowedOnBehalf");
            for (uint256 j = 0; j < accounts.length; j++) {
                _same(abi.encodeCall(ACL.isAllowed, (h, accounts[j])), "isAllowed");
                _same(abi.encodeCall(ACL.persistAllowed, (h, accounts[j])), "persistAllowed");
                _sameTm(abi.encodeCall(TaskManager.isAllowed, (h, accounts[j])), "TaskManager.isAllowed");
            }
            assertEq(
                keccak256(_view(address(acl), abi.encodeCall(ACL.isAllowedWithPermission, (pP, h)))),
                keccak256(_view(address(aclV), abi.encodeCall(ACL.isAllowedWithPermission, (pV, h)))),
                "isAllowedWithPermission"
            );
        }
    }

    function _same(bytes memory data, string memory what) internal view {
        assertEq(keccak256(_view(address(acl), data)), keccak256(_view(address(aclV), data)), what);
    }

    function _sameTm(bytes memory data, string memory what) internal view {
        assertEq(keccak256(_view(address(tm), data)), keccak256(_view(address(tmV), data)), what);
    }
}
