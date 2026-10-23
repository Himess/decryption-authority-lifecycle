// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console2} from "forge-std/Test.sol";
import {PQWallet} from "../src/PQWallet.sol";
import {IMLDSAVerifier} from "mldsa/IMLDSAVerifier.sol";

/// @notice A call target that records who called it.
contract Recorder {
    event Recorded(address indexed caller, uint256 value);

    uint256 public last;
    address public lastCaller;

    function record(uint256 value) external {
        last = value;
        lastCaller = msg.sender;
        emit Recorded(msg.sender, value);
    }

    function fail() external pure {
        revert("Recorder: fail");
    }
}

/// @notice Phase 5, B0: PQWallet as a deployed contract and as an EIP-7702 delegate (TEST ONLY).
///         The ML-DSA-44 signatures are the fixed vectors of script/make_vectors.py (test keys from public labels),
///         so the accounts sit at fixed addresses: the wallet through deployCodeTo, the delegated account from a
///         fixed test private key.
contract PQWalletTest is Test {
    address internal constant HELPER = address(0xF1600);
    address internal constant BLOB1 = address(0xB10B1);
    address internal constant BLOB2 = address(0xB10B2);
    address internal constant WALLET = address(0xb0001);
    address internal constant TARGET = address(0x7a26e7);
    uint256 internal constant EOA_KEY = 0xA11CE;
    bytes4 internal constant MAGIC = 0x1626ba7e;
    bytes4 internal constant REJECT = 0xffffffff;

    string internal vectors;
    IMLDSAVerifier internal verifier;
    PQWallet internal wallet;
    Recorder internal recorder;
    bytes32 internal pkHash1;

    function setUp() public {
        vectors = vm.readFile("test/vectors/pqwallet_vectors.json");
        string memory helperHex =
            vm.trim(vm.readFile("../p3-operator-ratification/vendor/evm-ml-dsa-verifier-cca262b5/helpers/f1600_170.hex"));
        vm.etch(HELPER, vm.parseBytes(string.concat("0x", helperHex)));
        verifier = IMLDSAVerifier(deployCode("MLDSA44Verifier.sol:MLDSA44Verifier", abi.encode(HELPER)));
        vm.etch(BLOB1, vm.parseJsonBytes(vectors, ".keys.k1.blob"));
        vm.etch(BLOB2, vm.parseJsonBytes(vectors, ".keys.k2.blob"));
        pkHash1 = vm.parseJsonBytes32(vectors, ".keys.k1.pkHash");
        deployCodeTo("PQWallet.sol:PQWallet", abi.encode(verifier, BLOB1, pkHash1), WALLET);
        deployCodeTo("PQWallet.t.sol:Recorder", "", TARGET);
        wallet = PQWallet(payable(WALLET));
        recorder = Recorder(TARGET);
        assertEq(vm.parseJsonAddress(vectors, ".wallet"), WALLET);
        assertEq(vm.parseJsonAddress(vectors, ".target"), TARGET);
        assertEq(vm.parseJsonAddress(vectors, ".eoa"), vm.addr(EOA_KEY));
        assertEq(block.chainid, vm.parseJsonUint(vectors, ".chainId"));
    }

    function _exec(uint256 i) internal view returns (bytes memory data, bytes memory sig, bytes32 digest) {
        string memory p = string.concat(".execute[", vm.toString(i), "]");
        data = vm.parseJsonBytes(vectors, string.concat(p, ".data"));
        sig = vm.parseJsonBytes(vectors, string.concat(p, ".sig"));
        digest = vm.parseJsonBytes32(vectors, string.concat(p, ".digest"));
    }

    // ------------------------------------------------------------------ ERC-1271

    function test_isValidSignature_acceptsItsKey() public view {
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        assertEq(wallet.isValidSignature(h, vm.parseJsonBytes(vectors, ".isValidSignature.sig_k1")), MAGIC);
    }

    function test_isValidSignature_rejectsOtherKey() public view {
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        assertEq(wallet.isValidSignature(h, vm.parseJsonBytes(vectors, ".isValidSignature.sig_k2")), REJECT);
    }

    function test_isValidSignature_rejectsOtherHash() public view {
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        bytes memory sig = vm.parseJsonBytes(vectors, ".isValidSignature.sig_k1");
        assertEq(wallet.isValidSignature(bytes32(uint256(h) ^ 1), sig), REJECT);
    }

    function test_isValidSignature_rejectsCorruptedSignature() public view {
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        bytes memory sig = vm.parseJsonBytes(vectors, ".isValidSignature.sig_k1");
        sig[100] = bytes1(uint8(sig[100]) ^ 0x01);
        assertEq(wallet.isValidSignature(h, sig), REJECT);
    }

    function test_isValidSignature_rejectsEcdsaAndEmpty() public view {
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EOA_KEY, h);
        assertEq(wallet.isValidSignature(h, abi.encodePacked(r, s, v)), REJECT);
        assertEq(wallet.isValidSignature(h, ""), REJECT);
    }

    // ------------------------------------------------------------------ execute

    function test_executeDigest_matchesTheVectors() public view {
        (bytes memory data,, bytes32 digest) = _exec(0);
        assertEq(wallet.executeDigest(TARGET, data), digest);
    }

    function test_execute_relayedByAnyone() public {
        (bytes memory data, bytes memory sig,) = _exec(0);
        address relayer = makeAddr("relayer");
        vm.expectEmit(true, true, false, true, WALLET);
        emit PQWallet.Executed(0, TARGET, keccak256(data));
        vm.prank(relayer);
        wallet.execute(TARGET, data, sig);
        assertEq(recorder.last(), 42);
        assertEq(recorder.lastCaller(), WALLET);
        assertEq(wallet.nonce(), 1);
    }

    function test_execute_inOrder() public {
        (bytes memory d0, bytes memory s0,) = _exec(0);
        (bytes memory d1, bytes memory s1,) = _exec(1);
        wallet.execute(TARGET, d0, s0);
        wallet.execute(TARGET, d1, s1);
        assertEq(recorder.last(), 43);
        assertEq(wallet.nonce(), 2);
    }

    function test_execute_replayRejected() public {
        (bytes memory data, bytes memory sig,) = _exec(0);
        wallet.execute(TARGET, data, sig);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(TARGET, data, sig);
    }

    function test_execute_outOfOrderRejected() public {
        (bytes memory d1, bytes memory s1,) = _exec(1);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(TARGET, d1, s1);
    }

    function test_execute_otherDataRejected() public {
        (, bytes memory s0,) = _exec(0);
        (bytes memory d1,,) = _exec(1);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(TARGET, d1, s0);
    }

    function test_execute_otherTargetRejected() public {
        (bytes memory d0, bytes memory s0,) = _exec(0);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(address(0xdead), d0, s0);
    }

    function test_execute_otherKeyRejected() public {
        (bytes memory d, bytes memory s,) = _exec(3);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(TARGET, d, s);
    }

    function test_execute_ecdsaRejected() public {
        (bytes memory d0,, bytes32 digest) = _exec(0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EOA_KEY, digest);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        wallet.execute(TARGET, d0, abi.encodePacked(r, s, v));
    }

    function test_execute_targetRevertBubblesAndKeepsNonce() public {
        (bytes memory data, bytes memory sig,) = _exec(4);
        vm.expectRevert(abi.encodeWithSelector(PQWallet.CallFailed.selector, abi.encodeWithSignature("Error(string)", "Recorder: fail")));
        wallet.execute(TARGET, data, sig);
        assertEq(wallet.nonce(), 0);
    }

    function test_gas_oneExecute() public {
        (bytes memory data, bytes memory sig,) = _exec(0);
        uint256 before = gasleft();
        wallet.execute(TARGET, data, sig);
        uint256 used = before - gasleft();
        console2.log("B0 execute, execution gas inside the test (no intrinsic or calldata cost):", used);
        assertGt(used, 1_000_000);
        assertLt(used, 2_000_000);
    }

    // ------------------------------------------------------------------ keys and initialization

    function test_initialize_onlyTheAccountItself() public {
        vm.expectRevert(abi.encodeWithSelector(PQWallet.NotSelf.selector, address(this)));
        wallet.initialize(BLOB2, bytes32(0));
        vm.prank(WALLET);
        vm.expectRevert(PQWallet.AlreadyInitialized.selector);
        wallet.initialize(BLOB2, bytes32(0));
        (address blob, bytes32 h) = wallet.key();
        assertEq(blob, BLOB1);
        assertEq(h, pkHash1);
    }

    function test_codeWithoutKey_acceptsNothing() public {
        PQWallet template = new PQWallet(verifier, address(0), bytes32(0));
        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        assertEq(template.isValidSignature(h, vm.parseJsonBytes(vectors, ".isValidSignature.sig_k1")), REJECT);
        (bytes memory d0, bytes memory s0,) = _exec(0);
        vm.expectRevert(PQWallet.SignatureRejected.selector);
        template.execute(TARGET, d0, s0);
    }

    function test_receivesEther() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = WALLET.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(WALLET.balance, 1 ether);
    }

    // ------------------------------------------------------------------ as an EIP-7702 delegate

    function test_7702_delegateInitializeAndUse() public {
        PQWallet template = new PQWallet(verifier, address(0), bytes32(0));
        address eoa = vm.addr(EOA_KEY);
        vm.signAndAttachDelegation(address(template), EOA_KEY);
        // The account itself sets its key (its ECDSA key still authorizes it at this point).
        vm.prank(eoa);
        PQWallet(payable(eoa)).initialize(BLOB1, pkHash1);
        assertEq(eoa.code, abi.encodePacked(hex"ef0100", address(template)));
        (address blob,) = PQWallet(payable(eoa)).key();
        assertEq(blob, BLOB1);

        bytes32 h = vm.parseJsonBytes32(vectors, ".isValidSignature.hash");
        assertEq(PQWallet(payable(eoa)).isValidSignature(h, vm.parseJsonBytes(vectors, ".isValidSignature.sig_k1")), MAGIC);
        (bytes memory data, bytes memory sig, bytes32 digest) = _exec(2);
        assertEq(PQWallet(payable(eoa)).executeDigest(TARGET, data), digest);
        vm.prank(makeAddr("relayer"));
        PQWallet(payable(eoa)).execute(TARGET, data, sig);
        assertEq(recorder.last(), 7);
        assertEq(recorder.lastCaller(), eoa);
        // The template itself has no key and no nonce change.
        assertEq(template.nonce(), 0);
    }

    function test_7702_someoneElseCannotInitialize() public {
        PQWallet template = new PQWallet(verifier, address(0), bytes32(0));
        address eoa = vm.addr(EOA_KEY);
        vm.signAndAttachDelegation(address(template), EOA_KEY);
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PQWallet.NotSelf.selector, attacker));
        PQWallet(payable(eoa)).initialize(BLOB2, bytes32(0));
    }
}
