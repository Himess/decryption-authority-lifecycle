// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: the deployment every Fhenix port test starts from. Fhenix's TaskManager and the ported ACL behind
// ERC-1967 proxies, wired as Fhenix deploys them; the address book at the fixed address FHE.sol resolves; the ACP
// share registry and the timestamp revoker; an input-verifier key that signs encrypted inputs as Fhenix's verifier
// does (one ECDSA signature over the batch digest that TaskManager.batchVerifyInputs rebuilds).

import {Test} from "forge-std/Test.sol";
import {ACL} from "../../src/ACL.sol";
import {TaskManager, TMCommon} from "../../src/TaskManager.sol";
import {ACPShareRegistry} from "../../src/ACPShareRegistry.sol";
import {ACPTimestampRevoker} from "../../src/ACPTimestampRevoker.sol";
import {CoFHEAddressBook} from "../../src/CoFHEAddressBook.sol";
import {ERC1967Proxy} from "../../src/ERC1967Proxy.sol";
import {ACP, SCOPE_GLOBAL} from "../../src/Permissioned.sol";
import {COFHE_ADDRESS_BOOK, TASK_MANAGER_ID, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {FunctionId, Utils, UnsignedEncryptedInput} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {PortAccount, PortApp} from "./PortFixtures.sol";

abstract contract PortSetup is Test {
    // The ERC's Core constants.
    bytes4 internal constant CORE_ID = 0x556d2088;
    bytes4 internal constant ERC165_ID = 0x01ffc9a7;
    bytes32 internal constant ACCOUNT_RETIRED_TOPIC = 0xb78e4ea3a4535888e05cd4dd5c1b469a528e4f3e743356314e71ca2b340fa0eb;
    // This port's locations.
    bytes32 internal constant RETIREMENT_LOCATION = 0xfb6f17ca58407a16d354df28099d1c3b0fae80bca895f989456c75e03a668600;
    bytes32 internal constant ACL_STORAGE = 0x98828dfd28e689e059a6351976306890867bc600c945a965dfec4b1356484b00;
    uint8 internal constant T64 = 5; // Utils.EUINT64_TFHE

    event AccountRetired(address indexed account, address indexed successor);

    address internal admin = makeAddr("admin");
    address internal verifier;
    uint256 internal verifierKey;

    TaskManager internal tm;
    ACL internal acl;
    address internal aclImplementation;
    ACPShareRegistry internal shareRegistry;
    ACPTimestampRevoker internal revoker;
    PortApp internal app;

    function setUp() public virtual {
        (verifier, verifierKey) = makeAddrAndKey("input-verifier");
        (tm, acl, aclImplementation) = _deployStack(address(new ACL()));

        vm.startPrank(admin);
        revoker = new ACPTimestampRevoker();
        acl.setDefaultRevokerContract(address(revoker));
        ACPShareRegistry registryImplementation = new ACPShareRegistry();
        shareRegistry = ACPShareRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImplementation), abi.encodeCall(ACPShareRegistry.initialize, (admin))
                )
            )
        );
        shareRegistry.setRetirementRegistry(address(acl));
        acl.setShareRegistry(address(shareRegistry));
        vm.stopPrank();

        // FHE.sol resolves the TaskManager through the address book at its fixed address.
        CoFHEAddressBook bookImplementation = new CoFHEAddressBook();
        vm.etch(COFHE_ADDRESS_BOOK, address(bookImplementation).code);
        CoFHEAddressBook(COFHE_ADDRESS_BOOK).initialize(admin);
        vm.prank(admin);
        CoFHEAddressBook(COFHE_ADDRESS_BOOK).setTm(TASK_MANAGER_ID, address(tm));

        app = new PortApp();
        vm.label(address(acl), "ACL proxy");
        vm.label(address(tm), "TaskManager proxy");
        vm.label(address(app), "PortApp");
    }

    /// @dev A TaskManager and an ACL behind proxies, linked both ways, with the admin holding the roles the tests use.
    function _deployStack(address aclImpl) internal returns (TaskManager t, ACL a, address impl) {
        vm.startPrank(admin);
        TaskManager tmImplementation = new TaskManager();
        t = TaskManager(
            address(new ERC1967Proxy(address(tmImplementation), abi.encodeCall(TaskManager.initialize, (admin, 0))))
        );
        a = ACL(address(new ERC1967Proxy(aclImpl, abi.encodeCall(ACL.initialize, (admin, 0, address(t))))));
        t.grantRole(t.CONFIG_MANAGER_ROLE(), admin);
        t.grantRole(t.VERIFIER_SIGNER_MANAGER_ROLE(), admin);
        t.grantRole(t.PAUSER_ROLE(), admin);
        t.grantRole(t.ACCESS_LIST_MANAGER_ROLE(), admin);
        t.setACLContract(address(a));
        t.setVerifierSigner(verifier);
        a.grantRole(a.UPGRADER_ROLE(), admin);
        vm.stopPrank();
        impl = aclImpl;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Encrypted inputs and handles
    // ---------------------------------------------------------------------------------------------------------

    /// @dev The handle batchVerifyInputs derives from a raw ciphertext hash (security zone 0, euint64).
    function _handle(uint256 raw) internal pure returns (uint256) {
        return TMCommon.appendMetadata(raw, 0, T64, false);
    }

    /// @dev The verifier's signature over a one-input batch bound to `sender` and the consuming contract.
    function _signInput(uint256 raw, address sender, address consumer) internal view returns (bytes memory) {
        bytes32 h0 = keccak256(abi.encodePacked(raw, T64, uint8(0), sender, block.chainid, consumer));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierKey, keccak256(abi.encodePacked(h0)));
        return abi.encodePacked(r, s, v);
    }

    /// @dev The ABI-encoded input FHE.asEuint64(bytes) takes.
    function _encodedInput(uint256 raw, address sender, address consumer) internal view returns (bytes memory) {
        return abi.encode(raw, uint8(0), T64, _signInput(raw, sender, consumer));
    }

    /// @dev The call by which `consumer` verifies one fresh input through `t` and gets a transient right on it, granted
    ///      by the TaskManager itself (the engine's own grant). The handle is `_handle(raw)`.
    function _verifyInputData(TaskManager t, address consumer, address sender, uint256 raw)
        internal
        view
        returns (PortAccount.Call memory)
    {
        UnsignedEncryptedInput[] memory inputs = new UnsignedEncryptedInput[](1);
        inputs[0] = UnsignedEncryptedInput(raw, 0, T64);
        return PortAccount.Call(
            address(t),
            abi.encodeCall(TaskManager.batchVerifyInputs, (inputs, sender, _signInput(raw, sender, consumer)))
        );
    }

    function _createTaskData(FunctionId f, uint256 lhs, uint256 rhs) internal pure returns (bytes memory) {
        uint256[] memory operands = new uint256[](2);
        operands[0] = lhs;
        operands[1] = rhs;
        return abi.encodeCall(TaskManager.createTask, (T64, f, operands, new uint256[](0)));
    }

    /// @dev The handle createTask returns for a binary operation on two euint64 operands (security zone 0).
    function _output(FunctionId f, uint256 lhs, uint256 rhs) internal pure returns (uint256) {
        uint256[] memory operands = new uint256[](2);
        operands[0] = lhs;
        operands[1] = rhs;
        return TMCommon.calcPlaceholderKey(T64, 0, operands, f);
    }

    // ---------------------------------------------------------------------------------------------------------
    // One-transaction sequences (Foundry's isolation makes each top-level call its own transaction)
    // ---------------------------------------------------------------------------------------------------------

    PortAccount.Call[] internal pending;

    function _add(address target, bytes memory data) internal returns (uint256 index) {
        pending.push(PortAccount.Call(target, data));
        return pending.length - 1;
    }

    function _add(PortAccount.Call memory c) internal returns (uint256 index) {
        pending.push(c);
        return pending.length - 1;
    }

    /// @dev Runs the pending calls through `who` in one transaction and clears them.
    function _run(PortAccount who) internal returns (PortAccount.Result[] memory results) {
        PortAccount.Call[] memory calls = pending;
        delete pending;
        vm.prank(ownerOf[who]);
        results = who.executeAll(calls);
    }

    function _ok(PortAccount.Result memory r, string memory what) internal pure {
        if (!r.ok) {
            revert(string.concat(what, ": reverted"));
        }
    }

    function _bool(PortAccount.Result memory r, string memory what) internal pure returns (bool) {
        _ok(r, what);
        return abi.decode(r.ret, (bool));
    }

    function _reverted(PortAccount.Result memory r, bytes memory expected, string memory what) internal pure {
        if (r.ok) {
            revert(string.concat(what, ": did not revert"));
        }
        if (keccak256(r.ret) != keccak256(expected)) {
            revert(string.concat(what, ": reverted with other data"));
        }
    }

    /// @dev A user deposits a fresh input into the app: the app and the user then hold the handle persistently.
    function _deposit(address user, uint256 raw) internal returns (uint256 handle) {
        bytes memory input = _encodedInput(raw, user, address(app));
        vm.prank(user);
        handle = uint256(euint64.unwrap(app.deposit(input)));
    }

    /// @dev Owners are kept here so that no external call sits between a `vm.expectRevert` and the call it targets.
    mapping(PortAccount account => address owner) internal ownerOf;

    function _exec(PortAccount who, address target, bytes memory data) internal returns (bytes memory) {
        vm.prank(ownerOf[who]);
        return who.execute(target, data);
    }

    function _batch(PortAccount who, PortAccount.Call[] memory calls) internal {
        vm.prank(ownerOf[who]);
        who.executeBatch(calls);
    }

    function _newAccount(string memory label) internal returns (PortAccount account, uint256 key) {
        address owner;
        (owner, key) = makeAddrAndKey(string.concat(label, "-owner"));
        account = new PortAccount(owner);
        ownerOf[account] = owner;
        vm.label(address(account), label);
    }

    /// @dev `who` deposits a fresh input into the app: the app and `who` then hold the handle persistently.
    function _depositAs(PortAccount who, uint256 raw) internal returns (uint256 handle) {
        bytes memory input = _encodedInput(raw, address(who), address(app));
        handle = uint256(abi.decode(_exec(who, address(app), abi.encodeCall(PortApp.deposit, (input))), (bytes32)));
    }

    function _retire(address who) internal {
        vm.prank(who);
        acl.retireAccount();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Permits (ACP, EIP-712 domain "ACL" version "2" on the ACL proxy)
    // ---------------------------------------------------------------------------------------------------------

    function _domainSeparator(ACL a) internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address verifyingContract, , ) =
            a.eip712Domain();
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

    function _sign(ACL a, uint256 key, bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", _domainSeparator(a), structHash)));
        return abi.encodePacked(r, s, v);
    }

    /// @dev A self permit (no recipient) of `issuer`, signed with `key` (the issuer's, or its ERC-1271 owner's).
    function _selfPermit(ACL a, address issuer, uint256 key, uint8 scope) internal view returns (ACP memory p) {
        p.issuer = issuer;
        p.expiration = uint64(block.timestamp + 1 days);
        p.scope = scope;
        p.sealingKey = keccak256("sealing key");
        p.issuerSignature = _sign(a, key, _issuerSelfHash(p));
    }

    /// @dev A shared permit from `issuer` to `recipient`, completed by the recipient.
    function _sharedPermit(ACL a, address issuer, uint256 issuerKey, address recipient, uint256 recipientKey)
        internal
        view
        returns (ACP memory p)
    {
        p.issuer = issuer;
        p.expiration = uint64(block.timestamp + 1 days);
        p.recipient = recipient;
        p.scope = SCOPE_GLOBAL;
        p.issuerSignature = _sign(a, issuerKey, _issuerSharedHash(p));
        p.sealingKey = keccak256("recipient sealing key");
        p.recipientSignature = _sign(
            a,
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
}
