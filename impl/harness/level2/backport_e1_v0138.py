"""Apply the E1 Successor extension (Level 2) to the ACL v0.4.1 backport of the v0.13 line -> ACL v0.4.2.

The E1 code is the same as on main (ACL v0.9.0, lifecycle/level2 50147ff); only the version constants, the
reinitializer and the v0.13.8 file context differ (this line has no `isDelegatedForUserDecryption` view).
Every replacement must match exactly once. Usage: python -I backport_e1_v0138.py <host-contracts/contracts dir>
"""
import sys

d = sys.argv[1]


def apply(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        n = s.count(old)
        assert n == 1, (path.split("/")[-1], old[:80], n)
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8", newline="\n").write(s)
    print("edited", path.split("/")[-1])


EVENTS = """    event AccountRetired(address indexed account, address indexed successor);

    /// @notice                 Emitted when an account designates a successor (E1).
    /// @param account          The designating account.
    /// @param successor        The designated successor.
    /// @param confirmableAt    The UNIX timestamp from which the designation can be confirmed.
    event SuccessorDesignated(address indexed account, address indexed successor, uint64 confirmableAt);

    /// @notice             Emitted when a designated successor accepts the designation (E1).
    /// @param account      The designating account.
    /// @param successor    The accepting successor.
    event SuccessionAccepted(address indexed account, address indexed successor);

    /// @notice             Emitted when an account cancels its pending successor designation (E1).
    /// @param account      The designating account.
    /// @param successor    The successor whose designation was cancelled.
    event SuccessorDesignationCancelled(address indexed account, address indexed successor);

    /// @notice             Emitted when an account confirms its successor, which is locked from then on (E1).
    /// @param account      The designating account.
    /// @param successor    The confirmed successor.
    event SuccessorConfirmed(address indexed account, address indexed successor);

    /// @notice             Emitted when a confirmed successor resigns (E1).
    /// @param account      The account whose successor resigned.
    /// @param successor    The resigning successor.
    event SuccessionResigned(address indexed account, address indexed successor);

    /// @notice             Emitted when an account raises its successor delay (E1, per-account delay).
    /// @param account      The account.
    /// @param delay        The new delay, in seconds.
    event SuccessorDelayRaised(address indexed account, uint64 delay);
}"""

apply(d + "/ACLEvents.sol", [("    event AccountRetired(address indexed account, address indexed successor);\n}", EVENTS)])

E1_FUNCTIONS = '''
    /**
     * @notice Designates `successor` as the caller's successor (E1): the one account that may keep reading the
     *         caller's data after the caller retires. The designation takes effect only once the successor has
     *         accepted it and the caller has confirmed it, at or after `confirmableAt`.
     * @dev Pause-gated. Reverts with `SenderRetired` if the caller is retired, `SuccessorAlreadyConfirmed` if the
     *      caller already has a confirmed successor, and `SuccessorInvalid` if `successor` is the null address, the
     *      caller itself or a retired account. Replaces any pending designation and clears its acceptance.
     *      `confirmableAt` is fixed here: the current timestamp plus the caller's effective delay.
     *      Clients must not treat a successor as a payment address, and must show pending designations.
     *      On this line the gateway verifies the delegate's ECDSA signature, so a successor must be an ECDSA EOA.
     * @param successor The account to designate.
     */
    function designateSuccessor(address successor) public virtual whenNotPaused {
        ACLRetirementStorage storage $ = _retired();
        if ($.retired[msg.sender]) {
            revert SenderRetired(msg.sender);
        }
        Succession storage succession = $.succession[msg.sender];
        address confirmed = succession.confirmed;
        if (confirmed != address(0)) {
            revert SuccessorAlreadyConfirmed(confirmed);
        }
        if (successor == address(0) || successor == msg.sender || $.retired[successor]) {
            revert SuccessorInvalid(successor);
        }
        uint64 confirmableAt = uint64(block.timestamp) + _effectiveSuccessorDelay($, msg.sender);
        succession.pending = successor;
        succession.confirmableAt = confirmableAt;
        succession.accepted = false;
        emit SuccessorDesignated(msg.sender, successor, confirmableAt);
    }

    /**
     * @notice Accepts the caller's pending designation as `account`'s successor (E1). Acceptance is mandatory and is
     *         a transaction from the successor itself: an address no key controls, such as a key-derived address,
     *         can never accept.
     * @dev Pause-gated. Reverts with `NotPendingSuccessor` unless the caller is `account`'s pending successor,
     *      `AccountAlreadyRetired` if `account` is retired, and `SenderRetired` if the caller is retired.
     * @param account The account that designated the caller.
     */
    function acceptSuccession(address account) public virtual whenNotPaused {
        ACLRetirementStorage storage $ = _retired();
        Succession storage succession = $.succession[account];
        if (succession.pending != msg.sender) {
            revert NotPendingSuccessor(msg.sender);
        }
        if ($.retired[account]) {
            revert AccountAlreadyRetired(account);
        }
        if ($.retired[msg.sender]) {
            revert SenderRetired(msg.sender);
        }
        succession.accepted = true;
        emit SuccessionAccepted(account, msg.sender);
    }

    /**
     * @notice Cancels the caller's pending successor designation (E1). A confirmed successor is not affected.
     * @dev Not pause-gated. Reverts with `SenderRetired` if the caller is retired (retirement already voided any
     *      pending designation) and `NoPendingSuccessor` if no designation is pending.
     */
    function cancelSuccessorDesignation() public virtual {
        ACLRetirementStorage storage $ = _retired();
        if ($.retired[msg.sender]) {
            revert SenderRetired(msg.sender);
        }
        Succession storage succession = $.succession[msg.sender];
        address pending = succession.pending;
        if (pending == address(0)) {
            revert NoPendingSuccessor(msg.sender);
        }
        _clearPendingSuccessor(succession);
        emit SuccessorDesignationCancelled(msg.sender, pending);
    }

    /**
     * @notice Confirms the caller's pending successor (E1). From then on the successor is locked: the caller can
     *         neither replace nor cancel it, and only the successor can clear it (`resignSuccession`).
     * @dev Pause-gated. Reverts with `SenderRetired` if the caller is retired, `NoPendingSuccessor` if no designation
     *      is pending, `SuccessionNotAccepted` if the successor has not accepted, `SuccessorNotYetConfirmable`
     *      before `confirmableAt`, and `SuccessorInvalid` if the pending successor is retired.
     */
    function confirmSuccessor() public virtual whenNotPaused {
        ACLRetirementStorage storage $ = _retired();
        if ($.retired[msg.sender]) {
            revert SenderRetired(msg.sender);
        }
        Succession storage succession = $.succession[msg.sender];
        address pending = succession.pending;
        if (pending == address(0)) {
            revert NoPendingSuccessor(msg.sender);
        }
        if (!succession.accepted) {
            revert SuccessionNotAccepted(pending);
        }
        uint64 confirmableAt = succession.confirmableAt;
        if (block.timestamp < confirmableAt) {
            revert SuccessorNotYetConfirmable(pending, confirmableAt);
        }
        if ($.retired[pending]) {
            revert SuccessorInvalid(pending);
        }
        succession.confirmed = pending;
        _clearPendingSuccessor(succession);
        emit SuccessorConfirmed(msg.sender, pending);
    }

    /**
     * @notice Resigns the caller's role as `account`'s confirmed successor (E1). Callable at any time, including
     *         after `account` has retired and while the contract is paused.
     * @dev Reverts with `NotSuccessor` unless the caller is `account`'s confirmed successor.
     * @param account The account whose successor the caller is.
     */
    function resignSuccession(address account) public virtual {
        Succession storage succession = _retired().succession[account];
        if (succession.confirmed != msg.sender) {
            revert NotSuccessor(msg.sender);
        }
        succession.confirmed = address(0);
        emit SuccessionResigned(account, msg.sender);
    }

    /**
     * @notice Raises the caller's successor delay to `delay` seconds for future designations (E1, per-account
     *         delay). Raise-only; a pending designation keeps its `confirmableAt`.
     * @dev Not pause-gated. Reverts with `SenderRetired` if the caller is retired and `SuccessorDelayInvalid` unless
     *      `delay` is strictly greater than the caller's effective delay and at most 365 days.
     * @param delay The new delay, in seconds.
     */
    function raiseSuccessorDelay(uint64 delay) public virtual {
        ACLRetirementStorage storage $ = _retired();
        if ($.retired[msg.sender]) {
            revert SenderRetired(msg.sender);
        }
        if (delay <= _effectiveSuccessorDelay($, msg.sender) || delay > MAX_SUCCESSOR_DELAY) {
            revert SuccessorDelayInvalid(delay);
        }
        $.successorDelayOf[msg.sender] = delay;
        emit SuccessorDelayRaised(msg.sender, delay);
    }
'''

GETTERS = '''
    /**
     * @notice Returns the registry-wide successor delay D (E1), in seconds.
     * @return delay The delay, 7 days.
     */
    function successorDelay() public pure virtual returns (uint64) {
        return SUCCESSOR_DELAY;
    }

    /**
     * @notice Returns `account`'s effective successor delay (E1): the larger of D and any delay it raised it to.
     * @param account Address of the account.
     * @return delay The effective delay, in seconds.
     */
    function successorDelayOf(address account) public view virtual returns (uint64) {
        return _effectiveSuccessorDelay(_retired(), account);
    }

    /**
     * @notice Returns `account`'s confirmed successor (E1), or the null address. The successor has no right while
     *         `account` is active; once `account` retires, it reads `account`'s data through the delegated view.
     * @param account Address of the account.
     * @return successor The confirmed successor.
     */
    function successorOf(address account) public view virtual returns (address) {
        return _retired().succession[account].confirmed;
    }

    /**
     * @notice Returns `account`'s pending successor designation (E1), if any.
     * @param account Address of the account.
     * @return successor The pending successor, or the null address.
     * @return confirmableAt The UNIX timestamp from which the designation can be confirmed.
     * @return accepted Whether the pending successor has accepted.
     */
    function pendingSuccessorOf(
        address account
    ) public view virtual returns (address successor, uint64 confirmableAt, bool accepted) {
        Succession storage succession = _retired().succession[account];
        return (succession.pending, succession.confirmableAt, succession.accepted);
    }
'''

HELPERS = '''
    /// @dev Whether `delegate` is the confirmed successor of `account` (E1). Callers check retirement first.
    function _isConfirmedSuccessor(
        ACLRetirementStorage storage $r,
        address account,
        address delegate
    ) private view returns (bool) {
        address successor = $r.succession[account].confirmed;
        return successor != address(0) && successor == delegate;
    }

    /// @dev The effective successor delay of `account`: the larger of `SUCCESSOR_DELAY` and its raised delay.
    function _effectiveSuccessorDelay(ACLRetirementStorage storage $r, address account) private view returns (uint64) {
        uint64 raised = $r.successorDelayOf[account];
        return raised > SUCCESSOR_DELAY ? raised : SUCCESSOR_DELAY;
    }

    /// @dev Clears a pending designation (successor, `confirmableAt`, acceptance); the confirmed successor is kept.
    function _clearPendingSuccessor(Succession storage succession) private {
        succession.pending = address(0);
        succession.confirmableAt = 0;
        succession.accepted = false;
    }
'''

apply(d + "/ACL.sol", [
    (
        "    error HandlesListIsEmpty();\n",
        "    error HandlesListIsEmpty();\n\n"
        "    /**\n"
        "     * @notice Returned if `cancelSuccessorDesignation` or `confirmSuccessor` finds no pending successor designation.\n"
        "     * @param account The account without a pending designation.\n"
        "     */\n"
        "    error NoPendingSuccessor(address account);\n",
    ),
    (
        "    /// @notice Returned if the sender address is not allowed to pause the contract.\n    error NotPauser(address sender);\n",
        "    /// @notice Returned if the sender address is not allowed to pause the contract.\n    error NotPauser(address sender);\n\n"
        "    /**\n"
        "     * @notice Returned if `acceptSuccession` is called by an address that is not the account's pending successor.\n"
        "     * @param caller The caller.\n"
        "     */\n"
        "    error NotPendingSuccessor(address caller);\n\n"
        "    /**\n"
        "     * @notice Returned if `resignSuccession` is called by an address that is not the account's confirmed successor.\n"
        "     * @param caller The caller.\n"
        "     */\n"
        "    error NotSuccessor(address caller);\n",
    ),
    (
        "     *         (outside the FHEVMExecutor branch) or `delegateForUserDecryption`.\n"
        "     * @param sender The address of the retired account.\n"
        "     */\n"
        "    error SenderRetired(address sender);\n",
        "     *         (outside the FHEVMExecutor branch) or `delegateForUserDecryption`; or a succession function frozen by\n"
        "     *         retirement: `designateSuccessor`, `acceptSuccession` (retired caller), `cancelSuccessorDesignation`,\n"
        "     *         `confirmSuccessor` or `raiseSuccessorDelay`.\n"
        "     * @param sender The address of the retired account.\n"
        "     */\n"
        "    error SenderRetired(address sender);\n\n"
        "    /**\n"
        "     * @notice Returned if `confirmSuccessor` is called before the pending successor has accepted the designation.\n"
        "     * @param successor The pending successor.\n"
        "     */\n"
        "    error SuccessionNotAccepted(address successor);\n\n"
        "    /**\n"
        "     * @notice Returned if `designateSuccessor` is called by an account that already has a confirmed successor.\n"
        "     *         A confirmed successor is locked: only the successor can clear it, through `resignSuccession`.\n"
        "     * @param successor The confirmed successor.\n"
        "     */\n"
        "    error SuccessorAlreadyConfirmed(address successor);\n\n"
        "    /**\n"
        "     * @notice Returned if `raiseSuccessorDelay` is called with a delay that is not strictly greater than the\n"
        "     *         caller's effective delay, or that exceeds 365 days.\n"
        "     * @param delay The rejected delay, in seconds.\n"
        "     */\n"
        "    error SuccessorDelayInvalid(uint64 delay);\n\n"
        "    /**\n"
        "     * @notice Returned if a designated or pending successor is invalid: the null address, the account itself, or a\n"
        "     *         retired account.\n"
        "     * @param successor The rejected successor.\n"
        "     */\n"
        "    error SuccessorInvalid(address successor);\n\n"
        "    /**\n"
        "     * @notice Returned if `confirmSuccessor` is called before the designation's `confirmableAt` timestamp.\n"
        "     * @param successor The pending successor.\n"
        "     * @param confirmableAt The UNIX timestamp from which the designation can be confirmed.\n"
        "     */\n"
        "    error SuccessorNotYetConfirmable(address successor, uint64 confirmableAt);\n",
    ),
    (
        "     * @dev Append-only: later lifecycle extensions add their fields here, in the same namespace.\n"
        "     */\n"
        "    /// @custom:storage-location erc7201:fhevm.storage.ACLRetirement\n"
        "    struct ACLRetirementStorage {\n"
        "        mapping(address account => bool isRetired) retired;\n"
        "    }\n",
        "     * @dev Append-only: later lifecycle extensions add their fields here, in the same namespace.\n"
        "     *      `succession` and `successorDelayOf` were appended by the E1 extension (ACL v0.4.2).\n"
        "     */\n"
        "    /// @custom:storage-location erc7201:fhevm.storage.ACLRetirement\n"
        "    struct ACLRetirementStorage {\n"
        "        mapping(address account => bool isRetired) retired;\n"
        "        mapping(address account => Succession succession) succession;\n"
        "        /// Raise-only per-account successor delay, in seconds; 0 means the registry-wide `SUCCESSOR_DELAY`.\n"
        "        mapping(address account => uint64 delay) successorDelayOf;\n"
        "    }\n",
    ),
    (
        "    /**\n"
        "     * @notice Retirement state, kept in its own ERC-7201 namespace",
        "    /**\n"
        "     * @notice Successor record of an account (Decryption Authority Lifecycle, extension E1).\n"
        "     * @dev Two slots: `pending`, `confirmableAt` and `accepted` share the first, `confirmed` is the second.\n"
        "     *      Lifecycle: designate (account) -> accept (successor) -> confirm (account, at or after `confirmableAt`)\n"
        "     *      -> locked. A confirmed successor gains a read right over the account's data only once the account\n"
        "     *      retires, and only the successor can clear it (`resignSuccession`).\n"
        "     */\n"
        "    struct Succession {\n"
        "        /// @notice The designated successor awaiting acceptance and confirmation, or the null address.\n"
        "        address pending;\n"
        "        /// @notice The UNIX timestamp from which the pending designation can be confirmed, fixed at designation.\n"
        "        uint64 confirmableAt;\n"
        "        /// @notice Whether the pending successor has accepted the designation.\n"
        "        bool accepted;\n"
        "        /// @notice The confirmed successor, or the null address.\n"
        "        address confirmed;\n"
        "    }\n\n"
        "    /**\n"
        "     * @notice Retirement state, kept in its own ERC-7201 namespace",
    ),
    ("    uint256 private constant PATCH_VERSION = 1;", "    uint256 private constant PATCH_VERSION = 2;"),
    ("    uint64 private constant REINITIALIZER_VERSION = 6;", "    uint64 private constant REINITIALIZER_VERSION = 7;"),
    (
        "    bytes4 private constant RETIREMENT_STORAGE_LOCATION_SELECTOR = 0xc89c7ccd;\n",
        "    bytes4 private constant RETIREMENT_STORAGE_LOCATION_SELECTOR = 0xc89c7ccd;\n\n"
        "    /// @notice ERC-165 interface id of the E1 Successor extension (`IDecryptionAuthoritySuccession`).\n"
        "    bytes4 private constant DAL_SUCCESSION_INTERFACE_ID = 0x7dc5e209;\n\n"
        "    /// @notice ERC-165 interface id of the E1 per-account delay (`IDecryptionAuthoritySuccessionDelay`).\n"
        "    bytes4 private constant DAL_SUCCESSION_DELAY_INTERFACE_ID = 0xc61ca396;\n\n"
        "    /// @notice Registry-wide successor delay D, in seconds. The extension requires D >= 7 days.\n"
        "    uint64 private constant SUCCESSOR_DELAY = 7 days;\n\n"
        "    /// @notice Upper bound of a per-account raised successor delay, in seconds.\n"
        "    uint64 private constant MAX_SUCCESSOR_DELAY = 365 days;\n",
    ),
    (
        "     * @notice Re-initializes the contract from V4 (ACL v0.4.0). Retirement state needs no initialization.\n"
        "     */\n"
        "    /// @custom:oz-upgrades-unsafe-allow missing-initializer-call\n"
        "    /// @custom:oz-upgrades-validate-as-initializer\n"
        "    function reinitializeV5() public virtual reinitializer(REINITIALIZER_VERSION) {}\n",
        "     * @notice Re-initializes the contract from ACL v0.4.1. Succession state needs no initialization.\n"
        "     */\n"
        "    /// @custom:oz-upgrades-unsafe-allow missing-initializer-call\n"
        "    /// @custom:oz-upgrades-validate-as-initializer\n"
        "    function reinitializeV6() public virtual reinitializer(REINITIALIZER_VERSION) {}\n",
    ),
    (
        "     *      restricts oracle access only (the account still acts on-chain); it is as final as this chain's governance.\n"
        "     */\n"
        "    function retireAccount() public virtual {\n"
        "        ACLRetirementStorage storage $ = _retired();\n"
        "        if ($.retired[msg.sender]) {\n"
        "            revert AccountAlreadyRetired(msg.sender);\n"
        "        }\n"
        "        $.retired[msg.sender] = true;\n"
        "        emit AccountRetired(msg.sender, address(0));\n"
        "    }\n",
        "     *      restricts oracle access only (the account still acts on-chain); it is as final as this chain's governance.\n"
        "     *      Succession (E1): retirement voids any pending successor designation and freezes the succession record;\n"
        "     *      a successor confirmed beforehand gains the read right of the delegated view (see\n"
        "     *      `isHandleDelegatedForUserDecryption`). The event carries that confirmed successor, or the null address.\n"
        "     */\n"
        "    function retireAccount() public virtual {\n"
        "        ACLRetirementStorage storage $ = _retired();\n"
        "        if ($.retired[msg.sender]) {\n"
        "            revert AccountAlreadyRetired(msg.sender);\n"
        "        }\n"
        "        $.retired[msg.sender] = true;\n"
        "        Succession storage succession = $.succession[msg.sender];\n"
        "        if (succession.pending != address(0)) {\n"
        "            _clearPendingSuccessor(succession);\n"
        "        }\n"
        "        emit AccountRetired(msg.sender, succession.confirmed);\n"
        "    }\n" + E1_FUNCTIONS,
    ),
    (
        "     *         Returns 0 if the delegator, the delegate or the contract is retired.\n     */",
        "     *         Returns 0 if the delegator, the delegate or the contract is retired. It describes delegation rows\n"
        "     *         only: a confirmed successor's read right (E1) is not a delegation, so it also gets 0 here; read\n"
        "     *         `successorOf` and the delegated view for it.\n     */",
    ),
    (
        "     *      delegation entries. Returns false if the delegator, the delegate or the contract is retired.\n",
        "     *      delegation entries. Returns false if the delegate or the contract is retired. For a retired delegator,\n"
        "     *      only its confirmed successor (E1) gets true, as if it held an active, non-expiring wildcard delegation;\n"
        "     *      this covers handles granted to the delegator after its retirement (stragglers), whose raw pair is read\n"
        "     *      here. Every other delegate gets false, and there is no transitivity.\n",
    ),
    (
        "        ACLRetirementStorage storage $r = _retired();\n"
        "        if ($r.retired[delegator] || $r.retired[delegate] || $r.retired[contractAddress]) {\n"
        "            return false;\n"
        "        }\n"
        "        ACLStorage storage $ = _getACLStorage();\n"
        "        if (!$.persistedAllowedPairs[handle][delegator] || !$.persistedAllowedPairs[handle][contractAddress]) {\n"
        "            return false;\n"
        "        }\n",
        "        ACLRetirementStorage storage $r = _retired();\n"
        "        if ($r.retired[delegate] || $r.retired[contractAddress]) {\n"
        "            return false;\n"
        "        }\n"
        "        ACLStorage storage $ = _getACLStorage();\n"
        "        if (!$.persistedAllowedPairs[handle][delegator] || !$.persistedAllowedPairs[handle][contractAddress]) {\n"
        "            return false;\n"
        "        }\n"
        "        if ($r.retired[delegator]) {\n"
        "            return _isConfirmedSuccessor($r, delegator, delegate);\n"
        "        }\n",
    ),
    (
        "    function isAccountRetired(address account) public view virtual returns (bool) {\n"
        "        return _retired().retired[account];\n"
        "    }\n",
        "    function isAccountRetired(address account) public view virtual returns (bool) {\n"
        "        return _retired().retired[account];\n"
        "    }\n" + GETTERS,
    ),
    (
        "     * @dev True for ERC-165 itself (0x01ffc9a7) and for the Decryption Authority Lifecycle Core (0x556d2088).\n"
        "     * @param interfaceId The interface identifier.\n"
        "     * @return supported Whether the interface is supported.\n"
        "     */\n"
        "    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {\n"
        "        return interfaceId == ERC165_INTERFACE_ID || interfaceId == DAL_CORE_INTERFACE_ID;\n"
        "    }\n",
        "     * @dev True for ERC-165 itself (0x01ffc9a7), the Decryption Authority Lifecycle Core (0x556d2088), the E1\n"
        "     *      Successor extension (0x7dc5e209) and its per-account delay (0xc61ca396).\n"
        "     * @param interfaceId The interface identifier.\n"
        "     * @return supported Whether the interface is supported.\n"
        "     */\n"
        "    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {\n"
        "        return\n"
        "            interfaceId == ERC165_INTERFACE_ID ||\n"
        "            interfaceId == DAL_CORE_INTERFACE_ID ||\n"
        "            interfaceId == DAL_SUCCESSION_INTERFACE_ID ||\n"
        "            interfaceId == DAL_SUCCESSION_DELAY_INTERFACE_ID;\n"
        "    }\n",
    ),
    (
        "        return $.userDecryptionDelegations[delegator][delegate][contractAddress].expirationDate > block.timestamp;\n"
        "    }\n",
        "        return $.userDecryptionDelegations[delegator][delegate][contractAddress].expirationDate > block.timestamp;\n"
        "    }\n" + HELPERS,
    ),
])
