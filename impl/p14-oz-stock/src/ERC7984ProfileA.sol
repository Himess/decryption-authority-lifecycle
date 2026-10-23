// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984ObserverAccess} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ObserverAccess.sol";

/**
 * @title ERC7984ProfileA
 * @notice Profile A, rule A1, of the Decryption Authority Lifecycle draft, as an extension of OpenZeppelin's
 *         unmodified ERC-7984 with its observer extension (confidential-contracts 0.5.3). It overrides only the two
 *         identity-gated grant paths:
 *         - `setObserver(account, X)` reverts when `X != 0` and `account` has retired. Clearing stays allowed, so a
 *           retired owner can remove an observer a thief added, and nobody can add one again.
 *         - `setOperator(operator, until)` reverts when `until >= block.timestamp` and the caller has retired. An
 *           ERC-7984 operator is valid while `block.timestamp <= until`, so an expiry equal to now is a grant too.
 *           Revoking (an expiry in the past) stays allowed.
 *         Transfers are untouched (A2), and nothing is asserted after a grant (A3). The retirement bit is read through
 *         `FHE.isAccountRetired`, which reverts against a registry without the lifecycle Core, so the gates fail closed.
 */
abstract contract ERC7984ProfileA is ERC7984ObserverAccess {
    /// @dev An identity-gated grant on behalf of a retired account.
    error ERC7984GrantByRetiredAccount(address account);

    function setObserver(address account, address newObserver) public virtual override {
        if (newObserver != address(0) && FHE.isAccountRetired(account)) {
            revert ERC7984GrantByRetiredAccount(account);
        }
        super.setObserver(account, newObserver);
    }

    function setOperator(address operator, uint48 until) public virtual override {
        if (until >= block.timestamp && FHE.isAccountRetired(msg.sender)) {
            revert ERC7984GrantByRetiredAccount(msg.sender);
        }
        super.setOperator(operator, until);
    }
}
