// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.25;

/**
 * @title Erc1271GasMeter (TEST ONLY, used via eth_call)
 * @notice Measures what `account.isValidSignature(hash, sig)` costs and whether it completes
 *         under a given gas budget. `gasUsed` is the gasleft() delta around the STATICCALL, i.e.
 *         the callee's execution plus the CALL overhead (cold account access, argument memory).
 *         It does NOT include the 21,000 intrinsic gas or calldata cost of a top-level call;
 *         the off-chain verifier in Zama's connector applies its cap to a top-level eth_call, so
 *         scripts also record eth_estimateGas of a direct call for the like-for-like number.
 */
contract Erc1271GasMeter {
    bytes4 internal constant IS_VALID_SIGNATURE_SELECTOR = 0x1626ba7e;

    /// @param gasCap gas forwarded to the STATICCALL; 0 forwards everything but a small reserve.
    function measure(address account, bytes32 hash, bytes calldata sig, uint256 gasCap)
        external
        view
        returns (bool callSucceeded, bytes4 returnedMagic, uint256 gasUsed)
    {
        bytes memory data = abi.encodeWithSelector(IS_VALID_SIGNATURE_SELECTOR, hash, sig);
        uint256 forward = gasCap == 0 ? gasleft() - 30_000 : gasCap;
        uint256 before = gasleft();
        (bool ok, bytes memory ret) = account.staticcall{gas: forward}(data);
        gasUsed = before - gasleft();
        callSucceeded = ok;
        if (ok && ret.length >= 32) {
            bytes32 word;
            assembly ("memory-safe") {
                word := mload(add(ret, 32))
            }
            returnedMagic = bytes4(word);
        }
    }
}
