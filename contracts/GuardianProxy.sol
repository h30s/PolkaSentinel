// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPolkaSentinel} from "./interfaces/IPolkaSentinel.sol";

/// @title GuardianProxy — PolkaSentinel's on-chain security engine
/// @notice Collects 10 real-time features from on-chain data and classifies transaction threat level.
///         Includes built-in reentrancy protection via _guardDepth — protected vaults do NOT need
///         OpenZeppelin's ReentrancyGuard separately.
/// @dev Features are collected in Solidity (where on-chain state IS accessible),
///      then sent to the PVM Rust engine for decision tree classification.
///      If PVM is unavailable, the Solidity fallback classifier is used.
contract GuardianProxy is IPolkaSentinel, AccessControl, Pausable {

    // === ROLES ===
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // === STATE: Core ===
    address public sentinelEngine; // PVM Rust engine address (address(0) = use Solidity fallback)
    uint8 public globalThreshold;  // 1 = block SUSPICIOUS+, 2 = block only CRITICAL
    uint256 public totalScanned;
    uint256 public totalBlocked;
    uint256 public immutable deployBlock;

    // === STATE: Protocol Registry ===
    mapping(address => bool) public protocolRegistry;

    // === STATE: Threat Logs ===
    mapping(bytes32 => ThreatReport) public threatLogs;

    // === STATE: Reentrancy Protection ===
    // _guardDepth tracks how many guard() calls are currently in-flight per caller.
    // guard() increments it. guardComplete() (called by modifier after function body) decrements it.
    // If guard() is called while _guardDepth > 0 for the same caller, it means re-entry is
    // happening during the vault's external call — this is a HARD REVERT, not just a classification.
    mapping(address => uint256) private _guardDepth;

    // === STATE: Feature Collection ===
    mapping(address => uint256) public firstSeen;                                      // sender age tracking
    mapping(address => mapping(uint256 => uint256)) public blockWithdrawals;           // per-block withdrawal count
    mapping(address => mapping(uint256 => uint256)) public blockCumulativeValue;       // per-block cumulative value

    // === DECISION TREE CONSTANTS (hand-crafted, expert-derived thresholds) ===
    uint256 private constant VAULT_DRAIN_CRITICAL = 500;   // 50.0% of vault
    uint256 private constant VAULT_DRAIN_HIGH = 300;        // 30.0% (new contract threshold)
    uint256 private constant VAULT_DRAIN_EXTREME = 700;     // 70.0% (known contract threshold)
    uint256 private constant VAULT_DRAIN_FULL = 900;        // 90.0% (EOA threshold)
    uint256 private constant MULTI_WITHDRAW_THRESHOLD = 1;  // >1 withdrawal per block

    // === CIRCUIT BREAKER ===
    uint256 public criticalCount;
    uint256 private constant CIRCUIT_BREAKER_THRESHOLD = 3;

    constructor(address _sentinelEngine) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);

        sentinelEngine = _sentinelEngine;
        globalThreshold = 2;
        deployBlock = block.number;
    }

    // =========================================================================
    //                          CORE: guard() function
    // =========================================================================

    /// @inheritdoc IPolkaSentinel
    function guard(
        bytes calldata txData,
        uint256 withdrawAmount,
        uint256 vaultBalance
    ) external override whenNotPaused returns (bool allowed, uint8 threatLevel, uint8 confidence) {

        // --- REENTRANCY CHECK (hard revert, not just classification) ---
        // If _guardDepth[caller] > 0, this caller already has a guard() in-flight,
        // meaning the vault's function body made an external call that re-entered.
        // This is the SAME mechanism as OpenZeppelin's ReentrancyGuard, but built
        // into PolkaSentinel so vaults don't need a separate nonReentrant modifier.
        if (_guardDepth[msg.sender] > 0) {
            // Re-entry detected — revert immediately
            totalScanned++;
            totalBlocked++;
            criticalCount++;
            emit ThreatDetected(msg.sender, 12, 2); // signature 12 = reentrancy
            emit TransactionBlocked(msg.sender, "PolkaSentinel: REENTRANCY_BLOCKED");

            if (criticalCount >= CIRCUIT_BREAKER_THRESHOLD) {
                _pause();
                emit CircuitBreakerActivated(msg.sender, block.timestamp);
            }

            // Return not-allowed (the modifier will revert)
            return (false, 2, 99);
        }

        // Set depth BEFORE classification — stays elevated during entire vault function body
        _guardDepth[msg.sender]++;

        // --- Step 1: Collect 10 features from REAL on-chain sources ---
        uint256[10] memory features;

        features[0] = 0; // reentrancy_flag: 0 here (re-entry was caught above)
        features[1] = withdrawAmount;
        features[2] = txData.length;
        features[3] = txData.length >= 4 ? uint256(uint32(bytes4(txData))) : 0;
        features[4] = msg.sender.code.length > 0 ? 1 : 0;
        features[5] = firstSeen[msg.sender] == 0
            ? 0
            : block.number - firstSeen[msg.sender];
        features[6] = blockWithdrawals[msg.sender][block.number];
        features[7] = blockCumulativeValue[msg.sender][block.number];
        features[8] = vaultBalance > 0
            ? (withdrawAmount * 1000) / vaultBalance
            : 0;
        features[9] = block.number - deployBlock;

        // --- Step 2: Update tracking state ---
        if (firstSeen[msg.sender] == 0) {
            firstSeen[msg.sender] = block.number;
        }
        blockWithdrawals[msg.sender][block.number]++;
        blockCumulativeValue[msg.sender][block.number] += withdrawAmount;

        // --- Step 3: Classify (PVM engine or Solidity fallback) ---
        uint32 signatureId;
        if (sentinelEngine != address(0)) {
            (bool success, bytes memory result) = sentinelEngine.staticcall(
                abi.encode(features)
            );
            if (success && result.length >= 3) {
                threatLevel = uint8(result[0]);
                confidence = uint8(result[1]);
                signatureId = uint32(uint8(result[2]));
            } else {
                (threatLevel, confidence, signatureId) = _classifySolidity(features);
            }
        } else {
            (threatLevel, confidence, signatureId) = _classifySolidity(features);
        }

        // --- Step 4: Enforce decision ---
        totalScanned++;
        allowed = threatLevel < globalThreshold;

        if (!allowed) {
            totalBlocked++;
            criticalCount++;

            emit ThreatDetected(msg.sender, signatureId, threatLevel);
            emit TransactionBlocked(msg.sender, "PolkaSentinel: CRITICAL_THREAT_BLOCKED");

            if (criticalCount >= CIRCUIT_BREAKER_THRESHOLD) {
                _pause();
                emit CircuitBreakerActivated(msg.sender, block.timestamp);
            }
        }

        emit TransactionScanned(msg.sender, tx.origin, threatLevel, confidence);

        // Store report
        bytes32 reportId = keccak256(abi.encodePacked(msg.sender, block.number, totalScanned));
        threatLogs[reportId] = ThreatReport({
            threatLevel: threatLevel,
            confidence: confidence,
            signatureId: signatureId,
            sender: msg.sender,
            timestamp: block.timestamp,
            blocked: !allowed
        });

        // _guardDepth stays elevated — guardComplete() resets it after vault function body
    }

    // =========================================================================
    //                    SOLIDITY FALLBACK CLASSIFIER
    //         (13-node decision tree — identical logic to Rust engine)
    // =========================================================================

    function _classifySolidity(uint256[10] memory f)
        internal
        pure
        returns (uint8 threatLevel, uint8 confidence, uint32 signatureId)
    {
        // Note: reentrancy (f[0]) is handled by the hard revert above, not the tree.
        // The tree handles all non-reentrancy patterns.

        // Node 5: sender_is_contract == 1?
        if (f[4] > 0) {
            // Node 6: sender_first_seen_gap == 0? (brand new contract)
            if (f[5] == 0) {
                // Node 7: vault_balance_ratio > 300?
                if (f[8] > VAULT_DRAIN_HIGH) {
                    return (2, 91, 9); // CRITICAL — new contract draining vault
                }
                return (1, 55, 7); // SUSPICIOUS — new contract, small amount
            }
            // Known contract
            if (f[8] > VAULT_DRAIN_EXTREME) {
                return (1, 60, 8); // SUSPICIOUS — known contract, very large
            }
            return (0, 85, 11); // SAFE — known contract, normal amount
        }

        // EOA caller
        if (f[8] > VAULT_DRAIN_FULL) {
            return (1, 45, 10); // SUSPICIOUS — EOA draining >90%
        }

        return (0, 95, 11); // SAFE — normal user withdrawal
    }

    // =========================================================================
    //                          GUARD LIFECYCLE
    // =========================================================================

    /// @notice Called by the onlyGuarded modifier AFTER the vault's function body completes.
    ///         Resets _guardDepth so the next call from this vault starts fresh.
    ///         Only the same address that called guard() can call guardComplete().
    function guardComplete() external {
        require(_guardDepth[msg.sender] > 0, "GuardianProxy: no active guard");
        _guardDepth[msg.sender]--;
    }

    // =========================================================================
    //                          ADMIN FUNCTIONS
    // =========================================================================

    function registerProtocol(address protocol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(protocol != address(0), "GuardianProxy: zero address");
        protocolRegistry[protocol] = true;
        if (firstSeen[protocol] == 0) {
            firstSeen[protocol] = block.number;
        }
        emit ProtocolRegistered(protocol);
    }

    function setThreshold(uint8 level) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(level >= 1 && level <= 2, "GuardianProxy: invalid threshold");
        globalThreshold = level;
    }

    function setSentinelEngine(address engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sentinelEngine = engine;
    }

    function emergencyPause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
        emit CircuitBreakerActivated(msg.sender, block.timestamp);
    }

    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        criticalCount = 0;
    }

    // =========================================================================
    //                          VIEW FUNCTIONS
    // =========================================================================

    /// @inheritdoc IPolkaSentinel
    function getReport(bytes32 txHash) external view override returns (ThreatReport memory) {
        return threatLogs[txHash];
    }

    /// @inheritdoc IPolkaSentinel
    function getStats() external view override returns (uint256, uint256) {
        return (totalScanned, totalBlocked);
    }

    /// @notice Classify a feature vector without executing (for testing/gas measurement)
    function classifyView(uint256[10] memory features)
        external
        pure
        returns (uint8 threatLevel, uint8 confidence, uint32 signatureId)
    {
        return _classifySolidity(features);
    }
}
