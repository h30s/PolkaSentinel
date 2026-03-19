# PolkaSentinel

**The First On-Chain Transaction Guardian for Polkadot**

A real-time security engine that detects and blocks DeFi exploits using a Rust-powered decision tree classifier on PVM, callable from any Solidity contract via a single modifier.

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
The `guard()` function tracks call depth per-caller. If a protected function's external call re-enters `guard()`, it detects `_guardDepth > 0` and **hard reverts immediately** — same mechanism as OpenZeppelin's ReentrancyGuard but built into the guardian. No separate `nonReentrant` needed.

**Layer 2 — Multi-Signal Threat Classification:**
The GuardianProxy collects **10 real-time features** from on-chain data (sender contract analysis, vault drain ratios, per-block withdrawal tracking, first-seen age) and runs a decision tree classifier that detects patterns ReentrancyGuard alone cannot:
- New contract deployed this block trying to drain >30% of vault → CRITICAL
- Known contract attempting >70% drain → SUSPICIOUS
- EOA draining >90% → SUSPICIOUS

Both layers run on-chain with zero off-chain dependency. The Rust decision tree engine on PVM provides the classification (with Solidity fallback).

### The Proof

We deployed two identical vaults — one protected by PolkaSentinel, one without protection — and attacked both with the same reentrancy exploit:

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
│  │    PVM RUST ENGINE                   │   │
│  │    13-node decision tree             │   │
│  │    → SAFE / SUSPICIOUS / CRITICAL    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Result: CRITICAL? → revert (funds safe)    │
│          SAFE?     → execute normally       │
└─────────────────────────────────────────────┘
```

## Features Collected (All Real, All On-Chain)

| # | Feature | Source | Why |
|---|---|---|---|
| 0 | `reentrancy_flag` | Storage counter | Detects re-entry like OZ ReentrancyGuard |
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
| Security Engine | Rust (no_std compatible), 13-node hand-crafted decision tree |
| PVM Target | PolkaVM RISC-V via revive compiler |
| Testing | Hardhat, ethers.js, Chai |
| Frontend | React 18, Vite, TailwindCSS, ethers.js v6 |
| Deployment | Polkadot Hub Testnet (Passet Hub) |

## Track

**Track 2: PVM Smart Contracts** — Polkadot Solidity Hackathon 2026

Hits all three Track 2 categories:
- **PVM experiments** — Rust decision tree compiled to PVM, called from Solidity
- **Polkadot native Assets** — Monitors and protects native PAS token transfers
- **Native functionality via precompiles** — Uses PVM calling convention

**OpenZeppelin Sponsor Track** — Uses Pausable, AccessControl, ReentrancyGuard as core components

## Project Structure

```
polkasentinel/
├── contracts/
│   ├── GuardianProxy.sol          # Core: feature collection + classifier + enforcement
│   ├── ProtectedVault.sol         # Demo vault with PolkaSentinel protection
│   ├── VulnerableVault.sol        # Demo vault WITHOUT protection (for side-by-side proof)
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
│   └── PolkaSentinel.test.js      # 36 tests including side-by-side proof
└── hardhat.config.js
```

## Quick Start

### Prerequisites
- Node.js >= 18
- Rust >= 1.70

### Install & Test

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/polkasentinel.git
cd polkasentinel

# Install dependencies
npm install

# Run all 36 Solidity tests
npx hardhat test

# Run 18 Rust engine tests
cd rust-engine && cargo test && cd ..

# Deploy locally
npx hardhat run scripts/deploy.js

# Run full attack demo
npx hardhat run scripts/demo-attack.js
```

### Deploy to Polkadot Hub Testnet

```bash
# Configure .env
cp .env.example .env
# Add your PRIVATE_KEY and testnet RPC

# Deploy
npx hardhat run scripts/deploy.js --network polkadotHub

# Run demo on testnet
npx hardhat run scripts/demo-attack.js --network polkadotHub
```

### Frontend

```bash
cd frontend
npm install
npm run dev
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
36 passing (Solidity)
18 passing (Rust)

Gas Report:
  Protected withdrawal:   174,189 gas
  Unprotected withdrawal: 40,143 gas
  Sentinel overhead:      134,046 gas
  classifyView (pure):    24,600 gas
```

## Deployed Contract Addresses

See `deployed-addresses.json` after deployment, or `testnet-results.json` for full demo results with transaction hashes.

## Team

- Built for Polkadot Solidity Hackathon 2026
- Track 2: PVM Smart Contracts

## License

MIT
