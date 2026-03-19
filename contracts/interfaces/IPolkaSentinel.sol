// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPolkaSentinel {
    struct ThreatReport {
        uint8 threatLevel;     // 0=SAFE, 1=SUSPICIOUS, 2=CRITICAL
        uint8 confidence;      // 0-100
        uint32 signatureId;    // which tree leaf was reached
        address sender;
        uint256 timestamp;
        bool blocked;
    }

    /// @notice Analyze a transaction and return threat assessment
    /// @param txData The original function calldata (msg.data from the protected function)
    /// @param withdrawAmount The value being withdrawn/transferred
    /// @param vaultBalance The current total balance of the calling vault
    /// @return allowed Whether the transaction should proceed
    /// @return threatLevel 0=SAFE, 1=SUSPICIOUS, 2=CRITICAL
    /// @return confidence 0-100 confidence score
    function guard(
        bytes calldata txData,
        uint256 withdrawAmount,
        uint256 vaultBalance
    ) external returns (bool allowed, uint8 threatLevel, uint8 confidence);

    /// @notice Reset guard depth after protected function completes
    function guardComplete() external;

    function getReport(bytes32 txHash) external view returns (ThreatReport memory);

    function getStats() external view returns (uint256 totalScanned, uint256 totalBlocked);

    event TransactionScanned(
        address indexed sender,
        address indexed protocol,
        uint8 threatLevel,
        uint8 confidence
    );

    event ThreatDetected(
        address indexed attacker,
        uint32 signatureId,
        uint8 threatLevel
    );

    event TransactionBlocked(
        address indexed attacker,
        string reason
    );

    event CircuitBreakerActivated(
        address indexed protocol,
        uint256 timestamp
    );

    event ProtocolRegistered(address indexed protocol);
}
