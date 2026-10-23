// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Brings the vendored verifier into this project's build, so that its artifact is produced with the settings of
// foundry.toml (the upstream repository's own).
import {MLDSA44Verifier} from "mldsa/MLDSA44Verifier.sol";
