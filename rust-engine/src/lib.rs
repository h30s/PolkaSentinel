//! PolkaSentinel Engine — On-chain decision tree classifier
//!
//! This crate implements the 13-node hand-crafted decision tree that classifies
//! transactions as SAFE, SUSPICIOUS, or CRITICAL based on 10 real on-chain features.
//!
//! Architecture:
//! - Solidity GuardianProxy collects 10 features from on-chain data
//! - Features are ABI-encoded as uint64[10] and sent to this engine
//! - Engine runs the decision tree and returns ThreatResult
//!
//! Designed for PVM/RISC-V (no_std compatible when std feature is disabled)

#![cfg_attr(not(feature = "std"), no_std)]

pub mod classifier;
pub mod signatures;

/// Feature vector indices — matches Solidity GuardianProxy exactly
pub mod features {
    pub const F_REENTRANCY_FLAG: usize = 0;
    pub const F_MSG_VALUE: usize = 1;
    pub const F_CALLDATA_SIZE: usize = 2;
    pub const F_FUNCTION_SELECTOR: usize = 3;
    pub const F_SENDER_IS_CONTRACT: usize = 4;
    pub const F_SENDER_FIRST_SEEN_GAP: usize = 5;
    pub const F_WITHDRAWALS_THIS_BLOCK: usize = 6;
    pub const F_CUMULATIVE_VALUE_THIS_BLOCK: usize = 7;
    pub const F_VAULT_BALANCE_RATIO: usize = 8;
    pub const F_CONTRACT_AGE: usize = 9;
}

/// Threat classification result
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ThreatResult {
    /// 0 = SAFE, 1 = SUSPICIOUS, 2 = CRITICAL
    pub threat_level: u8,
    /// Confidence score 0-100
    pub confidence: u8,
    /// Which decision tree leaf was reached (maps to attack type)
    pub signature_id: u32,
}

/// Main entry point — analyze a feature vector and return threat classification
///
/// This is what Solidity calls via the PVM cross-VM interface.
/// Input: 10 u64 values (ABI-decoded from Solidity's uint256[10])
/// Output: ThreatResult struct
pub fn analyze(feature_vector: &[u64; 10]) -> ThreatResult {
    classifier::decision_tree::classify(feature_vector)
}

/// Decode features from raw ABI-encoded bytes (as sent from Solidity)
/// Each uint256 is 32 bytes, so 10 features = 320 bytes
pub fn decode_features(data: &[u8]) -> [u64; 10] {
    let mut features = [0u64; 10];
    if data.len() < 320 {
        return features; // Return safe defaults for invalid input
    }
    for i in 0..10 {
        // Each Solidity uint256 is 32 bytes, big-endian
        // We read the last 8 bytes of each 32-byte slot as u64
        let offset = i * 32 + 24; // Skip first 24 bytes of each uint256
        if offset + 8 <= data.len() {
            features[i] = u64::from_be_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
                data[offset + 4],
                data[offset + 5],
                data[offset + 6],
                data[offset + 7],
            ]);
        }
    }
    features
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_safe_normal_eoa() {
        let features: [u64; 10] = [0, 1000, 68, 0x2e1a7d4d, 0, 5000, 0, 0, 50, 10000];
        let result = analyze(&features);
        assert_eq!(result.threat_level, 0); // SAFE
        assert!(result.confidence >= 90);
    }

    #[test]
    fn test_analyze_critical_new_contract_drain() {
        // New contract (is_contract=1, gap=0) draining >30% (ratio=600)
        // Note: reentrancy is now a hard revert in guard(), not handled by tree
        let features: [u64; 10] = [0, 10_000_000, 256, 0, 1, 0, 0, 0, 600, 500];
        let result = analyze(&features);
        assert_eq!(result.threat_level, 2); // CRITICAL
        assert_eq!(result.confidence, 91);
    }

    #[test]
    fn test_decode_features_valid() {
        let mut data = vec![0u8; 320];
        // Set feature[0] = 1 (reentrancy flag)
        data[31] = 1;
        // Set feature[8] = 800 (vault_balance_ratio) — slot 8 starts at byte 256
        data[8 * 32 + 30] = 0x03; // 800 = 0x0320
        data[8 * 32 + 31] = 0x20;

        let features = decode_features(&data);
        assert_eq!(features[0], 1);
        assert_eq!(features[8], 800);
    }

    #[test]
    fn test_decode_features_too_short() {
        let data = [0u8; 16];
        let features = decode_features(&data);
        assert_eq!(features, [0u64; 10]); // Safe defaults
    }
}
