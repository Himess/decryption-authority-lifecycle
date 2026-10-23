// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

// Phase 4, P2.1: a confidential vault written against Fhenix's FHE.sol (@fhenixprotocol/cofhe-contracts 1.0.0) for the
// end-to-end run. Balances are euint64 handles the vault and the owner hold; transfers add through the engine; the
// vault acts as a deputy and asks the use view before it moves or discloses a balance on its owner's request.

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract E2EVault {
    error CallerNotAllowed(address caller);

    mapping(address account => euint64 balance) public balanceOf;

    function deposit(externalEuint64 amount, bytes calldata proof) external returns (euint64 v) {
        v = FHE.asEuint64(amount, proof);
        if (euint64.unwrap(balanceOf[msg.sender]) != 0) {
            v = FHE.add(balanceOf[msg.sender], v);
        }
        _keep(msg.sender, v);
    }

    function transferAll(address to) external returns (euint64 v) {
        euint64 b = balanceOf[msg.sender];
        if (!FHE.isAllowed(b, msg.sender)) revert CallerNotAllowed(msg.sender);
        v = euint64.unwrap(balanceOf[to]) != 0 ? FHE.add(balanceOf[to], b) : b;
        balanceOf[msg.sender] = euint64.wrap(0);
        _keep(to, v);
    }

    function disclose() external {
        euint64 b = balanceOf[msg.sender];
        if (!FHE.isAllowed(b, msg.sender)) revert CallerNotAllowed(msg.sender);
        FHE.allowPublic(b);
    }

    function _keep(address owner, euint64 v) private {
        FHE.allowThis(v);
        FHE.allow(v, owner);
        balanceOf[owner] = v;
    }
}
