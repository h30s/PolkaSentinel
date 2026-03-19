# PolkaSentinel

**The First On-Chain Transaction Guardian for Polkadot**

A real-time security engine that detects and blocks DeFi exploits using a decision tree classifier — deployed live on Polkadot Hub TestNet.

---

## Live Deployment (Polkadot Hub TestNet — Chain ID: 420420417)

| Contract | Address |
|---|---|
| **GuardianProxy** | `0xeEC1F62F2E03908f47Eb4d5fE7281fD25d387480` |
| **ProtectedVault** | `0x0927a3c71cE3D3DFf2886236efA4622C2de31ECe` |
| **VulnerableVault** | `0x02cDC030bd8917522f339F7faD40FCE2aaE990ee` |
| **ReentrancyAttacker** | `0xb225669E1B22C1296CA291cA17Eb45BCB54d47cd` |

**Network:** Polkadot Hub TestNet
**RPC:** `https://services.polkadothub-rpc.com/testnet`
**Deployer:** `0x9574eB0855781c02f64C562ffF7064d2C6047DF8`
**Deployed:** March 19, 2026

---

## Problem

DeFi protocols have lost **$3B+** to exploits. Current security tools are:
- **Auditors** — catch bugs before deployment, useless at runtime
- **Off-chain bots** — detect attacks after confirmation, can't prevent them
- **AI scorers** — produce scores, don't enforce anything

**No solution exists that detects AND blocks exploits at runtime, on-chain, with zero off-chain dependency.**

## Solution

PolkaSentinel is a **Guardian Modifier** that any DeFi protocol adds to its sensitive functions. It provides two layers of protection:

**Layer 1 — Built-in Reentrancy Protection:**
The `guard()` function tracks call depth per-caller. If a protected function's external call re-enters `guard()`, it detects `_guardDepth > 0` and **hard reverts immediately** — same mechanism as OpenZeppelin's ReentrancyGuard but built into the guardian.

**Layer 2 — Multi-Signal Threat Classification:**
The GuardianProxy collects **10 real-time features** from on-chain data (sender contract analysis, vault drain ratios, per-block withdrawal tracking, first-seen age) and runs a decision tree classifier that detects patterns ReentrancyGuard alone cannot:
- New contract deployed this block trying to drain >30% of vault → CRITICAL
- Known contract attempting >70% drain → SUSPICIOUS
- EOA draining >90% → SUSPICIOUS

Both layers run on-chain with zero off-chain dependency.

### The Proof

We deployed two identical vaults on Polkadot Hub TestNet — one protected by PolkaSentinel, one without — and attacked both with the same reentrancy exploit:

```
╔══════════════════════════════════════════════════════╗
║  Vulnerable Vault:  10.0 ETH → 6.0 ETH  (DRAINED)  ║
║  Protected Vault:   10.0 ETH → 10.0 ETH (SAFE)     ║
╠══════════════════════════════════════════════════════╣
║  Attack: REAL.  Protection: REAL.  On-chain proof.   ║
╚══════════════════════════════════════════════════════╝
```

---

## Architecture

```
User Transaction
       │
       ▼
┌─────────────────────────────────────────────┐
│           SOLIDITY LAYER                    │
│                                             │
│  ProtectedVault ──► GuardianProxy           │
│  (onlyGuarded)      (collects 10 features)  │
│                          │                  │
│  ═══════════════════════╪══════════════════ │
│                          ▼                  │
│  ┌──────────────────────────────────────┐   │
│  │    DECISION TREE CLASSIFIER          │   │
│  │    13-node hand-crafted tree         │   │
│  │    → SAFE / SUSPICIOUS / CRITICAL    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Result: CRITICAL? → revert (funds safe)    │
│          SAFE?     → execute normally       │
└─────────────────────────────────────────────┘

PVM Rust Engine (identical logic, ready for
cross-VM deployment when PVM↔EVM calling is stable)
```

## Features Collected (All Real, All On-Chain)

| # | Feature | Source | Why |
|---|---|---|---|
| 0 | `reentrancy_flag` | Storage counter | Detects re-entry |
| 1 | `withdraw_amount` | Function parameter | Transaction value signal |
| 2 | `calldata_size` | `msg.data.length` | Unusual calldata = suspicious |
| 3 | `function_selector` | `bytes4(msg.data)` | Match known dangerous selectors |
| 4 | `sender_is_contract` | `msg.sender.code.length` | 95%+ of exploits use contracts |
| 5 | `sender_first_seen_gap` | Storage mapping | New entities are higher risk |
| 6 | `withdrawals_this_block` | Per-block counter | Multiple withdrawals = reentrancy signal |
| 7 | `cumulative_value_this_block` | Per-block accumulator | Total drain per block |
| 8 | `vault_balance_ratio` | `amount * 1000 / balance` | What % of vault is being drained |
| 9 | `contract_age` | `block.number - deployBlock` | Young contracts are higher risk |

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin (Pausable, AccessControl, ReentrancyGuard) |
| Security Engine | 13-node decision tree classifier (Solidity on-chain + Rust PVM-ready) |
| Testing | Hardhat, ethers.js, Chai (30 Solidity + 15 Rust = 45 tests) |
| Frontend | React 18, Vite, TailwindCSS, ethers.js v6 |
| Deployment | Polkadot Hub TestNet (Chain ID: 420420417) |

## Track

**Track 2: PVM Smart Contracts** — Polkadot Solidity Hackathon 2026

- **PVM experiments** — Rust decision tree engine compiled for PVM (identical logic to Solidity classifier)
- **Polkadot native Assets** — Monitors and protects native PAS token transfers
- **Native functionality** — Designed for PVM cross-VM integration

**OpenZeppelin Sponsor Track** — Uses Pausable, AccessControl, ReentrancyGuard

## Project Structure

```
polkasentinel/
├── contracts/
│   ├── GuardianProxy.sol          # Core: feature collection + classifier + enforcement
│   ├── ProtectedVault.sol         # Demo vault WITH PolkaSentinel protection
│   ├── VulnerableVault.sol        # Demo vault WITHOUT protection (for proof)
│   ├── interfaces/
│   │   └── IPolkaSentinel.sol     # Public interface
│   ├── libraries/
│   │   └── SentinelProtected.sol  # Integration abstract contract
│   └── test/
│       └── ReentrancyAttacker.sol # Real reentrancy exploit contract
├── rust-engine/
│   ├── src/
│   │   ├── lib.rs                 # Entry point + ABI decoding
│   │   ├── classifier/
│   │   │   └── decision_tree.rs   # 13-node decision tree (identical to Solidity)
│   │   └── signatures/
│   │       └── mod.rs             # Attack signature documentation
│   └── Cargo.toml
├── frontend/                      # React dashboard + attack demo
├── scripts/
│   ├── deploy.js                  # Deploy all contracts
│   └── demo-attack.js             # Full attack demo with proof-of-value
├── test/
│   └── PolkaSentinel.test.js      # 30 tests including side-by-side proof
└── hardhat.config.js
```

## Quick Start

### Prerequisites
- Node.js >= 18
- Rust >= 1.70

### Install & Test

```bash
# Clone
git clone https://github.com/pnkr01/polkasentinel.git
cd polkasentinel

# Install dependencies
npm install

# Run 30 Solidity tests
npx hardhat test

# Run 15 Rust engine tests
cd rust-engine && cargo test && cd ..

# Run full attack demo (deploys locally + attacks)
npx hardhat run scripts/demo-attack.js

# Start frontend
cd frontend && npm install && npm run dev
```

### Deploy to Polkadot Hub TestNet

```bash
# Configure .env
cp .env.example .env
# Add your PRIVATE_KEY

# Deploy
npx hardhat run scripts/deploy.js --network polkadotHub
```

## Integration (3 Lines)

Any DeFi protocol on Polkadot Hub can integrate PolkaSentinel:

```solidity
import {SentinelProtected} from "./SentinelProtected.sol";

contract MyVault is SentinelProtected {
    constructor(address sentinel) SentinelProtected(sentinel) {}

    function withdraw(uint256 amount) external onlyGuarded(amount) {
        // Your logic here — only runs if PolkaSentinel says SAFE
    }
}
```

## Test Results

```
30 passing (Solidity)
15 passing (Rust)

Gas Report:
  Protected withdrawal:   172,664 gas
  Unprotected withdrawal: 40,143 gas
  Sentinel overhead:      132,521 gas
  classifyView (pure):    24,600 gas
```

## License

MIT
