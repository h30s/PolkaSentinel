// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPolkaSentinel} from "../interfaces/IPolkaSentinel.sol";

/// @title SentinelProtected
/// @notice Abstract contract that any DeFi protocol inherits to get PolkaSentinel protection.
/// @dev The onlyGuarded modifier provides TWO protections:
///      1. Reentrancy blocking: guard() sets _guardDepth per-caller. If re-entry calls guard()
///         again while depth > 0, it HARD REVERTS — same mechanism as OpenZeppelin's ReentrancyGuard
///         but built into PolkaSentinel. No separate nonReentrant needed.
///      2. Threat classification: 10-feature decision tree detects new-contract attacks,
///         large vault drains, suspicious per-block patterns, and more.
abstract contract SentinelProtected {
    IPolkaSentinel public immutable sentinel;

    constructor(address _sentinel) {
        require(_sentinel != address(0), "SentinelProtected: zero address");
        sentinel = IPolkaSentinel(_sentinel);
    }

    /// @notice Modifier that provides reentrancy protection + threat classification.
    ///         guard() is called BEFORE the function body — it sets _guardDepth and classifies.
    ///         guardComplete() is called AFTER — it resets _guardDepth.
    ///         Re-entry during the function body triggers guard() again, which sees
    ///         _guardDepth > 0 and HARD REVERTS immediately.
    /// @param amount The withdrawal/transfer amount for this operation
    modifier onlyGuarded(uint256 amount) {
        (bool allowed, , ) = sentinel.guard(msg.data, amount, address(this).balance);
        require(allowed, "PolkaSentinel: CRITICAL_THREAT_BLOCKED");
        _;
        sentinel.guardComplete();
    }
}
