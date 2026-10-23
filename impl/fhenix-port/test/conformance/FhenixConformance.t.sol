// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.3: the conformance kit's adapter for the Fhenix CoFHE port (Core only: no E1, no E2). The kit
// (DecryptionAuthorityLifecycle.t.sol in this directory) is a byte-identical copy of the project's
// conformance/DecryptionAuthorityLifecycle.t.sol. Grants go through Fhenix's TaskManager, as Fhenix's contracts do.

import {ACL} from "../../src/ACL.sol";
import {TaskManager, TMCommon} from "../../src/TaskManager.sol";
import {ACPShareRegistry} from "../../src/ACPShareRegistry.sol";
import {CoFHEAddressBook} from "../../src/CoFHEAddressBook.sol";
import {ERC1967Proxy} from "../../src/ERC1967Proxy.sol";
import {ACP, SCOPE_GLOBAL} from "../../src/Permissioned.sol";
import {ACL as VendorACL} from "../../vendor/cofhe-contracts-b5c20ed/internal/host-chain/contracts/ACL.sol";
import {COFHE_ADDRESS_BOOK, TASK_MANAGER_ID} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FunctionId, UnsignedEncryptedInput} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {DecryptionAuthorityLifecycleConformance, KitAccount} from "./DecryptionAuthorityLifecycle.t.sol";

/// @dev Verifies a signed input and grants it persistently, in one call (the engine's transient grant lives for the
///      call's transaction only).
contract FhenixKitMinter {
    TaskManager internal immutable tm;

    constructor(TaskManager tm_) {
        tm = tm_;
    }

    function mint(UnsignedEncryptedInput[] calldata inputs, address sender, bytes calldata sig, address holder)
        external
        returns (uint256 h)
    {
        h = tm.batchVerifyInputs(inputs, sender, sig)[0];
        tm.allow(h, holder);
        tm.allow(h, address(this));
    }

    function grant(uint256 h, address to) external {
        tm.allow(h, to);
    }
}

contract FhenixConformanceTest is DecryptionAuthorityLifecycleConformance {
    uint8 internal constant T64 = 5;
    bytes32 internal constant ACL_STORAGE = 0x98828dfd28e689e059a6351976306890867bc600c945a965dfec4b1356484b00;

    address internal admin = makeAddr("fhenix-kit-admin");
    address internal verifier;
    uint256 internal verifierKey;
    TaskManager internal tm;
    ACL internal acl;
    ACPShareRegistry internal shares;
    FhenixKitMinter internal minter;

    function setUp() public {
        (verifier, verifierKey) = makeAddrAndKey("fhenix-kit-input-verifier");
        vm.startPrank(admin);
        tm = TaskManager(
            address(new ERC1967Proxy(address(new TaskManager()), abi.encodeCall(TaskManager.initialize, (admin, 0))))
        );
        acl = ACL(address(new ERC1967Proxy(address(new ACL()), abi.encodeCall(ACL.initialize, (admin, 0, address(tm))))));
        tm.grantRole(tm.CONFIG_MANAGER_ROLE(), admin);
        tm.grantRole(tm.VERIFIER_SIGNER_MANAGER_ROLE(), admin);
        tm.grantRole(tm.PAUSER_ROLE(), admin);
        tm.grantRole(tm.ACCESS_LIST_MANAGER_ROLE(), admin);
        tm.setACLContract(address(acl));
        tm.setVerifierSigner(verifier);
        acl.grantRole(acl.UPGRADER_ROLE(), admin);
        shares = ACPShareRegistry(
            address(
                new ERC1967Proxy(address(new ACPShareRegistry()), abi.encodeCall(ACPShareRegistry.initialize, (admin)))
            )
        );
        shares.setRetirementRegistry(address(acl));
        acl.setShareRegistry(address(shares));
        vm.stopPrank();
        CoFHEAddressBook book = new CoFHEAddressBook();
        vm.etch(COFHE_ADDRESS_BOOK, address(book).code);
        CoFHEAddressBook(COFHE_ADDRESS_BOOK).initialize(admin);
        vm.prank(admin);
        CoFHEAddressBook(COFHE_ADDRESS_BOOK).setTm(TASK_MANAGER_ID, address(tm));
        minter = new FhenixKitMinter(tm);
    }

    // --------------------------------------------------------------------------------------------------------------

    function _raw(uint256 salt) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("fhenix-kit-input", salt))) & ~uint256(0xffff);
    }

    function _input(uint256 raw) internal pure returns (UnsignedEncryptedInput[] memory inputs) {
        inputs = new UnsignedEncryptedInput[](1);
        inputs[0] = UnsignedEncryptedInput(raw, 0, T64);
    }

    function _sign(uint256 raw, address sender, address consumer) internal view returns (bytes memory) {
        bytes32 h0 = keccak256(abi.encodePacked(raw, T64, uint8(0), sender, block.chainid, consumer));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierKey, keccak256(abi.encodePacked(h0)));
        return abi.encodePacked(r, s, v);
    }

    function _domainSeparator() internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            acl.eip712Domain();
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    function _signTyped(uint256 key, bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash)));
        return abi.encodePacked(r, s, v);
    }

    // --------------------------------------------------------------------------------------------------------------
    // Adapter
    // --------------------------------------------------------------------------------------------------------------

    function kitRegistry() internal view override returns (address) {
        return address(acl);
    }

    function kitGivePersistent(address holder, uint256 salt) internal override returns (bytes32) {
        uint256 raw = _raw(salt);
        return bytes32(minter.mint(_input(raw), holder, _sign(raw, holder, address(minter)), holder));
    }

    function kitTransientRight(KitAccount who, uint256 salt)
        internal
        view
        override
        returns (KitAccount.Call memory, bytes32)
    {
        uint256 raw = _raw(salt);
        bytes memory data =
            abi.encodeCall(TaskManager.batchVerifyInputs, (_input(raw), address(who), _sign(raw, address(who), address(who))));
        return (KitAccount.Call(address(tm), data), bytes32(TMCommon.appendMetadata(raw, 0, T64, false)));
    }

    function kitGrantPaths(bytes32 handle, address to, address grantor)
        internal
        view
        override
        returns (KitAccount.Call[] memory calls, string[] memory names)
    {
        uint256 h = uint256(handle);
        calls = new KitAccount.Call[](6);
        names = new string[](6);
        calls[0] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.allow, (h, to)));
        names[0] = "TaskManager.allow";
        calls[1] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.allowGlobal, (h)));
        names[1] = "TaskManager.allowGlobal";
        calls[2] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.allowForDecryption, (h)));
        names[2] = "TaskManager.allowForDecryption";
        calls[3] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.allowTransient, (h, to)));
        names[3] = "TaskManager.allowTransient";
        calls[4] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.shareCtHash, (h, to)));
        names[4] = "TaskManager.shareCtHash";
        calls[5] = KitAccount.Call(address(shares), abi.encodeCall(ACPShareRegistry.share, (_shareFor(handle, to, grantor), "")));
        names[5] = "ACPShareRegistry.share";
    }

    /// @dev The share `grantor` posts for `to`, scoped to `handle`. The registry checks no signature at posting, only
    ///      that the caller is the issuer.
    function _shareFor(bytes32 handle, address to, address grantor) internal view returns (ACP memory p) {
        p.issuer = grantor;
        p.expiration = uint64(block.timestamp + 1 days);
        p.recipient = to;
        p.scope = 2; // SCOPE_HANDLES
        p.handles = new bytes32[](1);
        p.handles[0] = handle;
        p.issuerSignature = hex"01";
    }

    function kitUseViews(bytes32 handle, address a)
        internal
        view
        override
        returns (KitAccount.Call[] memory calls, string[] memory names)
    {
        uint256 h = uint256(handle);
        calls = new KitAccount.Call[](4);
        names = new string[](4);
        calls[0] = KitAccount.Call(address(acl), abi.encodeCall(ACL.isAllowed, (h, a)));
        names[0] = "isAllowed";
        calls[1] = KitAccount.Call(address(acl), abi.encodeCall(ACL.persistAllowed, (h, a)));
        names[1] = "persistAllowed";
        calls[2] = KitAccount.Call(address(acl), abi.encodeCall(ACL.allowedTransient, (h, a)));
        names[2] = "allowedTransient (transient)";
        calls[3] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.isAllowed, (h, a)));
        names[3] = "TaskManager.isAllowed";
    }

    function kitPublicView(bytes32 handle) internal view override returns (KitAccount.Call memory) {
        return KitAccount.Call(address(tm), abi.encodeCall(TaskManager.isPubliclyAllowed, (uint256(handle))));
    }

    function kitPublish(bytes32 handle) internal view override returns (KitAccount.Call memory) {
        return KitAccount.Call(address(tm), abi.encodeCall(TaskManager.allowGlobal, (uint256(handle))));
    }

    function kitCompute(bytes32 operand) internal view override returns (KitAccount.Call memory) {
        uint256[] memory operands = new uint256[](2);
        operands[0] = uint256(operand);
        operands[1] = uint256(operand);
        return KitAccount.Call(
            address(tm), abi.encodeCall(TaskManager.createTask, (T64, FunctionId.add, operands, new uint256[](0)))
        );
    }

    function kitEngineExempt() internal pure override returns (bool) {
        return true;
    }

    /// @dev The on-behalf record is written into the ACL's storage (field 3 of `cofhe.storage.ACL`), as in the port's
    ///      own TC5; the contract gets a persistent right on the handle.
    function kitDelegate(address account, address delegate, address contractAddr, bytes32 handle)
        internal
        override
        returns (bool)
    {
        minter.grant(uint256(handle), contractAddr);
        bytes32 slot = bytes32(uint256(ACL_STORAGE) + 3);
        slot = keccak256(abi.encode(account, slot));
        slot = keccak256(abi.encode(delegate, slot));
        slot = keccak256(abi.encode(contractAddr, slot));
        vm.store(address(acl), slot, bytes32(uint256(1)));
        return true;
    }

    function kitOnBehalfViews(address account, address delegate, address contractAddr, bytes32 handle)
        internal
        view
        override
        returns (KitAccount.Call[] memory calls, string[] memory names)
    {
        calls = new KitAccount.Call[](1);
        names = new string[](1);
        calls[0] = KitAccount.Call(
            address(acl), abi.encodeCall(ACL.allowedOnBehalf, (delegate, uint256(handle), contractAddr, account))
        );
        names[0] = "allowedOnBehalf";
    }

    function kitPermitViews(address issuer, uint256 issuerKey, address recipient, uint256 recipientKey, bytes32 handle)
        internal
        view
        override
        returns (bool, KitAccount.Call[] memory calls, string[] memory names)
    {
        ACP memory p;
        p.issuer = issuer;
        p.expiration = uint64(block.timestamp + 1 days);
        p.recipient = recipient;
        p.scope = SCOPE_GLOBAL;
        if (recipient == address(0)) {
            p.sealingKey = keccak256("kit sealing key");
            p.issuerSignature = _signTyped(issuerKey, _issuerSelfHash(p));
        } else {
            p.issuerSignature = _signTyped(issuerKey, _issuerSharedHash(p));
            p.sealingKey = keccak256("kit recipient sealing key");
            p.recipientSignature = _signTyped(
                recipientKey,
                keccak256(
                    abi.encode(
                        keccak256("ACPRecipient(bytes32 sealingKey,bytes issuerSignature)"),
                        p.sealingKey,
                        keccak256(p.issuerSignature)
                    )
                )
            );
        }
        calls = new KitAccount.Call[](3);
        names = new string[](3);
        calls[0] = KitAccount.Call(address(tm), abi.encodeCall(TaskManager.isAllowedWithPermission, (p, uint256(handle))));
        names[0] = "TaskManager.isAllowedWithPermission";
        calls[1] = KitAccount.Call(address(acl), abi.encodeCall(ACL.isAllowedWithPermission, (p, uint256(handle))));
        names[1] = "isAllowedWithPermission";
        calls[2] = KitAccount.Call(address(acl), abi.encodeCall(ACL.checkPermissionValidity, (p)));
        names[2] = "checkPermissionValidity";
        return (true, calls, names);
    }

    function _issuerSelfHash(ACP memory p) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "ACPIssuerSelf(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,bytes32[] handles,bytes32 sealingKey)"
                ),
                p.issuer,
                p.expiration,
                p.recipient,
                p.revokerData,
                p.revokerContract,
                p.scope,
                keccak256(abi.encodePacked(p.contracts)),
                keccak256(abi.encodePacked(p.handles)),
                p.sealingKey
            )
        );
    }

    function _issuerSharedHash(ACP memory p) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "ACPIssuerShared(address issuer,uint64 expiration,address recipient,uint256 revokerData,address revokerContract,uint8 scope,address[] contracts,bytes32[] handles)"
                ),
                p.issuer,
                p.expiration,
                p.recipient,
                p.revokerData,
                p.revokerContract,
                p.scope,
                keccak256(abi.encodePacked(p.contracts)),
                keccak256(abi.encodePacked(p.handles))
            )
        );
    }

    function kitUpgradeGuarded() internal pure override returns (bool) {
        return true;
    }

    function kitUpgrader() internal view override returns (address) {
        return admin;
    }

    function kitUpgradeCall(address implementation) internal view override returns (KitAccount.Call memory) {
        return KitAccount.Call(
            address(acl), abi.encodeWithSignature("upgradeToAndCall(address,bytes)", implementation, "")
        );
    }

    function kitNewCoreImplementation() internal override returns (address) {
        return address(new ACL());
    }

    function kitImplementationWithoutCore() internal override returns (address) {
        return address(new VendorACL());
    }

    function kitRegistryBatch(KitAccount.Call[] memory)
        internal
        pure
        override
        returns (bool, KitAccount.Call memory)
    {
        return (false, KitAccount.Call(address(0), "")); // R13 is a SHOULD; Fhenix offers no batching
    }

    function kitHostileConditions(address account) internal override returns (string[] memory applied) {
        address[] memory list = new address[](1);
        list[0] = account;
        vm.startPrank(admin);
        tm.disable();
        tm.setDenyList(list, true);
        tm.enableAccessList();
        vm.stopPrank();
        applied = new string[](3);
        applied[0] = "TaskManager disabled";
        applied[1] = "deny-listed";
        applied[2] = "off the access list";
    }
}
