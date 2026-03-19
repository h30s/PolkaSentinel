// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VulnerableVault — INTENTIONALLY INSECURE vault for demo purposes
/// @notice Identical to ProtectedVault but WITHOUT PolkaSentinel protection.
///         Used in the side-by-side test to prove the attack is REAL.
///         This vault WILL be drained by the reentrancy attacker.
/// @dev DO NOT USE IN PRODUCTION. This exists only to demonstrate what happens
///      without PolkaSentinel protection.
contract VulnerableVault {
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "VulnerableVault: zero deposit");
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw — NO PROTECTION, NO ReentrancyGuard
    /// @dev This is intentionally vulnerable to reentrancy.
    ///      The external call happens BEFORE the balance update,
    ///      which is the classic reentrancy vulnerability pattern (The DAO hack).
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "VulnerableVault: insufficient balance");

        // VULNERABILITY: external call BEFORE state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "VulnerableVault: transfer failed");

        // State update happens AFTER the external call — too late if re-entered
        // Using unchecked to simulate pre-Solidity-0.8 behavior where underflow was silent
        unchecked {
            balances[msg.sender] -= amount;
            totalDeposits -= amount;
        }

        emit Withdrawn(msg.sender, amount);
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
    }
}
