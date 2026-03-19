//! Hand-crafted decision tree classifier for non-reentrancy threat patterns
//!
//! This is the EXACT same logic as GuardianProxy._classifySolidity() in Solidity.
//! Both implementations must produce identical results for the same input.
//!
//! IMPORTANT: Reentrancy is handled by a HARD REVERT in guard() before the tree
//! is even reached. The tree only classifies non-reentrancy patterns:
//! - New contract attacks (flash loan style)
//! - Large vault drain patterns
//! - Suspicious per-block behavior
//!
//! Tree structure:
//!
//! Root: sender_is_contract == 1?
//! ├── YES: sender_first_seen_gap == 0? (brand new contract)
//! │   ├── YES: vault_balance_ratio > 300?
//! │   │   ├── YES → CRITICAL (91) [node 9: new contract draining]
//! │   │   └── NO → SUSPICIOUS (55) [node 7: new contract, small]
//! │   └── NO: vault_balance_ratio > 700?
//! │       ├── YES → SUSPICIOUS (60) [node 8: known contract, huge]
//! │       └── NO → SAFE (85) [node 11: known contract, normal]
//! └── NO: vault_balance_ratio > 900?
//!     ├── YES → SUSPICIOUS (45) [node 10: EOA draining >90%]
//!     └── NO → SAFE (95) [node 11: normal EOA]

use crate::features::*;
use crate::ThreatResult;

// Thresholds — derived from real exploit analysis
const VAULT_DRAIN_HIGH: u64 = 300;       // 30.0% — Euler flash loan threshold
const VAULT_DRAIN_EXTREME: u64 = 700;    // 70.0% — Known contract extreme threshold
const VAULT_DRAIN_FULL: u64 = 900;       // 90.0% — EOA near-full drain

/// Classify a 10-feature vector using the decision tree.
/// Reentrancy is NOT handled here — it's a hard revert in guard().
pub fn classify(f: &[u64; 10]) -> ThreatResult {
    // Root: sender_is_contract > 0?
    if f[F_SENDER_IS_CONTRACT] > 0 {
        // === CONTRACT CALLER BRANCH ===

        // sender_first_seen_gap == 0? (brand new contract)
        if f[F_SENDER_FIRST_SEEN_GAP] == 0 {
            // vault_balance_ratio > 300? (draining >30%)
            if f[F_VAULT_BALANCE_RATIO] > VAULT_DRAIN_HIGH {
                return ThreatResult {
                    threat_level: 2,
                    confidence: 91,
                    signature_id: 9, // new contract draining vault
                };
            }
            return ThreatResult {
                threat_level: 1,
                confidence: 55,
                signature_id: 7, // new contract, small amount
            };
        }

        // Known contract — vault_balance_ratio > 700?
        if f[F_VAULT_BALANCE_RATIO] > VAULT_DRAIN_EXTREME {
            return ThreatResult {
                threat_level: 1,
                confidence: 60,
                signature_id: 8, // known contract, very large
            };
        }

        return ThreatResult {
            threat_level: 0,
            confidence: 85,
            signature_id: 11, // known contract, normal
        };
    }

    // === EOA CALLER BRANCH ===

    if f[F_VAULT_BALANCE_RATIO] > VAULT_DRAIN_FULL {
        return ThreatResult {
            threat_level: 1,
            confidence: 45,
            signature_id: 10, // EOA draining >90%
        };
    }

    ThreatResult {
        threat_level: 0,
        confidence: 95,
        signature_id: 11, // normal user withdrawal
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // === SAFE ===

    #[test]
    fn test_safe_normal_eoa() {
        let f: [u64; 10] = [0, 1000, 68, 0x2e1a7d4d, 0, 5000, 0, 0, 50, 10000];
        let r = classify(&f);
        assert_eq!(r.threat_level, 0);
        assert_eq!(r.confidence, 95);
    }

    #[test]
    fn test_safe_known_contract_small() {
        let f: [u64; 10] = [0, 5000, 68, 0x2e1a7d4d, 1, 1000, 0, 0, 100, 8000];
        let r = classify(&f);
        assert_eq!(r.threat_level, 0);
        assert_eq!(r.confidence, 85);
    }

    // === CRITICAL ===

    #[test]
    fn test_critical_new_contract_draining() {
        let f: [u64; 10] = [0, 10_000_000, 256, 0, 1, 0, 0, 0, 600, 500];
        let r = classify(&f);
        assert_eq!(r.threat_level, 2);
        assert_eq!(r.confidence, 91);
        assert_eq!(r.signature_id, 9);
    }

    // === SUSPICIOUS ===

    #[test]
    fn test_suspicious_new_contract_small() {
        let f: [u64; 10] = [0, 500, 68, 0, 1, 0, 0, 0, 50, 200];
        let r = classify(&f);
        assert_eq!(r.threat_level, 1);
        assert_eq!(r.confidence, 55);
    }

    #[test]
    fn test_suspicious_known_contract_huge() {
        let f: [u64; 10] = [0, 30_000_000, 68, 0, 1, 5000, 0, 0, 750, 8000];
        let r = classify(&f);
        assert_eq!(r.threat_level, 1);
        assert_eq!(r.confidence, 60);
    }

    #[test]
    fn test_suspicious_eoa_draining_90pct() {
        let f: [u64; 10] = [0, 45_000_000, 68, 0, 0, 1000, 0, 0, 950, 5000];
        let r = classify(&f);
        assert_eq!(r.threat_level, 1);
        assert_eq!(r.confidence, 45);
    }

    // === FULL BRANCH COVERAGE ===

    #[test]
    fn test_all_tree_paths() {
        let cases: Vec<([u64; 10], u8, &str)> = vec![
            ([0, 10_000_000, 256, 0, 1, 0, 0, 0, 600, 500], 2, "new contract drain"),
            ([0, 500, 68, 0, 1, 0, 0, 0, 50, 200], 1, "new contract small"),
            ([0, 30_000_000, 68, 0, 1, 5000, 0, 0, 750, 8000], 1, "known contract huge"),
            ([0, 5000, 68, 0, 1, 1000, 0, 0, 100, 8000], 0, "known contract normal"),
            ([0, 45_000_000, 68, 0, 0, 1000, 0, 0, 950, 5000], 1, "EOA >90%"),
            ([0, 1000, 68, 0, 0, 5000, 0, 0, 50, 10000], 0, "normal EOA"),
        ];

        for (i, (features, expected, desc)) in cases.iter().enumerate() {
            let r = classify(features);
            assert_eq!(
                r.threat_level, *expected,
                "Case {} ('{}') failed: expected {}, got {}",
                i, desc, expected, r.threat_level
            );
        }
    }

    // === SAFETY ===

    #[test]
    fn test_deterministic() {
        let f: [u64; 10] = [0, 10_000_000, 256, 0, 1, 0, 0, 0, 600, 500];
        let r1 = classify(&f);
        let r2 = classify(&f);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_max_values_no_panic() {
        let f = [u64::MAX; 10];
        let r = classify(&f);
        assert!(r.threat_level <= 2);
        assert!(r.confidence <= 100);
    }

    #[test]
    fn test_all_zeros_safe() {
        let f = [0u64; 10];
        let r = classify(&f);
        assert_eq!(r.threat_level, 0);
    }
}
