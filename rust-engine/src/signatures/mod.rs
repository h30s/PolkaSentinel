//! Attack signature definitions
//!
//! This module documents the attack patterns that the decision tree detects.
//! The actual detection is done by the decision tree (classifier/decision_tree.rs)
//! using the 10-feature vector. These signatures describe WHAT the tree detects
//! and WHY each threshold was chosen.

/// Known attack signature identifiers (map to decision tree leaf nodes)
pub mod ids {
    /// Reentrancy + large vault drain (>50%). Leaf node 12.
    /// Based on: The DAO hack ($60M, 2016) — recursive calls draining 30%+ per cycle.
    pub const SIG_REENTRANCY_DRAIN: u32 = 12;

    /// Reentrancy + multiple withdrawals in same block. Leaf node 4.
    /// Pattern: attacker's receive() re-enters withdraw() multiple times in one tx.
    pub const SIG_REENTRANCY_MULTI: u32 = 4;

    /// Reentrancy detected but limited scope. Leaf node 3.
    /// Could be a benign callback pattern or failed attack attempt.
    pub const SIG_REENTRANCY_LOW: u32 = 3;

    /// New contract (deployed this block) draining >30% of vault. Leaf node 9.
    /// Based on: Flash loan attacks deploy fresh contracts for each exploit.
    /// Euler Finance ($197M, 2023) used a contract deployed in the same tx.
    pub const SIG_NEW_CONTRACT_DRAIN: u32 = 9;

    /// New contract with small withdrawal. Leaf node 7.
    /// Unusual but not definitively malicious.
    pub const SIG_NEW_CONTRACT_SMALL: u32 = 7;

    /// Known contract making very large withdrawal (>70%). Leaf node 8.
    /// Could be a legitimate liquidation or an exploit from a compromised contract.
    pub const SIG_KNOWN_CONTRACT_LARGE: u32 = 8;

    /// EOA draining >90% of vault. Leaf node 10.
    /// Unusual for normal usage — might be a compromised key or legitimate full exit.
    pub const SIG_EOA_LARGE_DRAIN: u32 = 10;

    /// Normal transaction. Leaf node 11.
    /// No suspicious patterns detected.
    pub const SIG_SAFE: u32 = 11;
}

/// Human-readable description for each signature
pub fn describe_signature(id: u32) -> &'static str {
    match id {
        12 => "CRITICAL: Reentrancy attack with large vault drain (>50%)",
        4 => "CRITICAL: Reentrancy with multiple withdrawals in same block",
        3 => "SUSPICIOUS: Reentrancy detected but limited scope",
        9 => "CRITICAL: New contract draining vault (>30%)",
        7 => "SUSPICIOUS: New contract with small withdrawal",
        8 => "SUSPICIOUS: Known contract with very large withdrawal (>70%)",
        10 => "SUSPICIOUS: EOA draining >90% of vault",
        11 => "SAFE: Normal transaction",
        _ => "UNKNOWN: Unrecognized signature ID",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_signatures_have_descriptions() {
        let known_ids = [12, 4, 3, 9, 7, 8, 10, 11];
        for id in known_ids {
            let desc = describe_signature(id);
            assert!(!desc.starts_with("UNKNOWN"), "Missing description for signature {}", id);
        }
    }
}
