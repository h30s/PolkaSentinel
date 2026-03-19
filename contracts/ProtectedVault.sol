// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SentinelProtected} from "./libraries/SentinelProtected.sol";

/// @title ProtectedVault — Demo DeFi vault protected SOLELY by PolkaSentinel
/// @notice This vault uses the SAME vulnerable pattern as VulnerableVault
///         (external call BEFORE state update, no ReentrancyGuard).
///         The ONLY protection is PolkaSentinel's onlyGuarded modifier.
///         This proves that PolkaSentinel alone stops the attack.
contract ProtectedVault is SentinelProtected, Pausable {
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;
    address public owner;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event FlashLoanExecuted(address indexed borrower, uint256 amount);

    constructor(address _sentinel) SentinelProtected(_sentinel) {
        owner = msg.sender;
    }

    /// @notice Deposit native tokens (PAS) into the vault
    function deposit() external payable {
        require(msg.value > 0, "ProtectedVault: zero deposit");
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw native tokens — protected SOLELY by PolkaSentinel
    /// @dev INTENTIONALLY uses the vulnerable pattern (external call BEFORE state update)
    ///      and has NO ReentrancyGuard. This proves PolkaSentinel alone stops reentrancy.
    ///      Compare with VulnerableVault which has the same code but no onlyGuarded.
    function withdraw(uint256 amount) external onlyGuarded(amount) whenNotPaused {
        require(balances[msg.sender] >= amount, "ProtectedVault: insufficient balance");

        // VULNERABLE PATTERN: external call BEFORE state update
        // Same as VulnerableVault — the ONLY difference is onlyGuarded above
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ProtectedVault: transfer failed");

        // State update AFTER external call
        unchecked {
            balances[msg.sender] -= amount;
            totalDeposits -= amount;
        }

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Flash loan — protected by PolkaSentinel
    function flashLoan(uint256 amount, address callback) external onlyGuarded(amount) whenNotPaused {
        require(address(this).balance >= amount, "ProtectedVault: insufficient liquidity");

        uint256 balanceBefore = address(this).balance;

        (bool success, ) = callback.call{value: amount}("");
        require(success, "ProtectedVault: flash loan callback failed");

        require(address(this).balance >= balanceBefore, "ProtectedVault: flash loan not repaid");

        emit FlashLoanExecuted(msg.sender, amount);
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    function pause() external {
        require(msg.sender == owner, "ProtectedVault: not owner");
        _pause();
    }

    function unpause() external {
        require(msg.sender == owner, "ProtectedVault: not owner");
        _unpause();
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
    }
}
