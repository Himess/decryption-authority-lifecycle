// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";
import {aclAdd, fhevmExecutorAdd, kmsVerifierAdd} from "@fhevm-host-contracts/addresses/FHEVMHostAddresses.sol";
import {FHEVMExecutor} from "@fhevm-host-contracts/contracts/FHEVMExecutor.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ObserverAccess} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ObserverAccess.sol";
import {ERC7984ProfileA} from "../src/ERC7984ProfileA.sol";

/// @dev The local host stack the test deploys (HostContractsDeployerTestUtils addresses).
function localCoprocessor() pure returns (CoprocessorConfig memory) {
    return CoprocessorConfig({ACLAddress: aclAdd, CoprocessorAddress: fhevmExecutorAdd, KMSVerifierAddress: kmsVerifierAdd});
}

/// @notice Stock OpenZeppelin ERC-7984 with its stock observer extension, and a test mint. No Profile A.
contract StockObserverToken is ERC7984ObserverAccess {
    constructor() ERC7984("Stock Observer Token", "SOT", "") {
        FHE.setCoprocessor(localCoprocessor());
    }

    function mint(address to, uint64 amount) external returns (euint64) {
        return _mint(to, FHE.asEuint64(amount));
    }
}

/// @notice The same token with the Profile A extension: the only difference is `ERC7984ProfileA` in the bases.
contract ProfileAStockToken is ERC7984ProfileA {
    constructor() ERC7984("Profile A Stock Token", "PAT", "") {
        FHE.setCoprocessor(localCoprocessor());
    }

    function mint(address to, uint64 amount) external returns (euint64) {
        return _mint(to, FHE.asEuint64(amount));
    }
}

/// @dev Same shape as Zama's MockInputVerifier (fhevmExecutor.t.sol): returns the handle, never reverts.
contract StockMockInputVerifier {
    function verifyInput(FHEVMExecutor.ContextUserInputs memory, bytes32 inputHandle, bytes memory)
        external
        pure
        returns (bytes32)
    {
        return inputHandle;
    }
}
