import React, { useState } from 'react';

const CODE_SNIPPETS = {
  solidity: {
    label: 'Solidity',
    language: 'solidity',
    code: `import {IGuardian} from "polkasentinel/IGuardian.sol";
contract MyVault is IGuardian {
    address guardian = 0x...GuardianProxy;
}`,
    fullExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IGuardian} from "polkasentinel/IGuardian.sol";

contract ProtectedVault {
    IGuardian public immutable guardian;
    mapping(address => uint256) public balances;

    constructor(address _guardian) {
        guardian = IGuardian(_guardian);
    }

    modifier guarded() {
        (bool allowed, uint8 threat, ) = guardian.guard(
            msg.data,
            msg.value,
            gasleft()
        );
        require(allowed, "PolkaSentinel: blocked");
        _;
    }

    function deposit() external payable guarded {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external guarded {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);
    }
}`,
  },
  javascript: {
    label: 'JavaScript (ethers.js)',
    language: 'javascript',
    code: `import { Contract } from "ethers";
const guardian = new Contract(addr, abi, signer);
const [allowed, threat] = await guardian.guard(data, value, gas);`,
    fullExample: `import { ethers } from "ethers";

// Connect to GuardianProxy
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const GUARDIAN_ABI = [
  "function guard(bytes data, uint256 value, uint256 gas) returns (bool, uint8, uint8)",
  "function getStats() view returns (uint256, uint256)",
  "function classifyView(uint256[10] features) view returns (uint8, uint8, uint32)",
  "function paused() view returns (bool)",
];

const guardian = new ethers.Contract(
  "0x...GuardianProxy",
  GUARDIAN_ABI,
  signer
);

// Check threat level before sending a transaction
async function checkTransaction(txData, value) {
  const [allowed, threat, confidence] = await guardian.guard(
    txData,
    value,
    300000 // gas limit
  );

  if (!allowed) {
    console.error(\`Transaction blocked! Threat: \${threat}, Confidence: \${confidence}\`);
    return false;
  }

  console.log("Transaction approved by PolkaSentinel");
  return true;
}

// Get protection stats
const [totalScanned, totalBlocked] = await guardian.getStats();
console.log(\`Scanned: \${totalScanned}, Blocked: \${totalBlocked}\`);`,
  },
  rust: {
    label: 'Rust (ink!)',
    language: 'rust',
    code: `use polkasentinel::Guardian;
let guardian = Guardian::new(proxy_addr);
let (allowed, threat) = guardian.guard(&data, value, gas);`,
    fullExample: `#![cfg_attr(not(feature = "std"), no_std)]

use ink::prelude::vec::Vec;
use ink::primitives::AccountId;

#[ink::contract]
mod protected_vault {
    use super::*;

    #[ink(storage)]
    pub struct ProtectedVault {
        guardian: AccountId,
        balances: ink::storage::Mapping<AccountId, Balance>,
    }

    impl ProtectedVault {
        #[ink(constructor)]
        pub fn new(guardian: AccountId) -> Self {
            Self {
                guardian,
                balances: Default::default(),
            }
        }

        #[ink(message, payable)]
        pub fn deposit(&mut self) {
            // Guardian check happens at proxy level
            let caller = self.env().caller();
            let value = self.env().transferred_value();
            let balance = self.balances.get(caller).unwrap_or(0);
            self.balances.insert(caller, &(balance + value));
        }

        #[ink(message)]
        pub fn withdraw(&mut self, amount: Balance) {
            let caller = self.env().caller();
            let balance = self.balances.get(caller).unwrap_or(0);
            assert!(balance >= amount, "Insufficient balance");
            self.balances.insert(caller, &(balance - amount));
            self.env().transfer(caller, amount).unwrap();
        }
    }
}`,
  },
};

const INTEGRATION_STEPS = [
  {
    step: '01',
    title: 'Deploy GuardianProxy',
    description: 'Deploy the PolkaSentinel GuardianProxy contract with pre-trained neural network weights.',
    command: 'npx hardhat run scripts/deploy.js --network moonbeam',
  },
  {
    step: '02',
    title: 'Add the Guard Modifier',
    description: 'Import IGuardian and add the guarded() modifier to functions you want to protect.',
    command: 'import {IGuardian} from "polkasentinel/IGuardian.sol";',
  },
  {
    step: '03',
    title: 'Configure Thresholds',
    description: 'Set threat thresholds and confidence levels for your security policy.',
    command: 'guardian.setThreshold(1, 80); // Block threats >= SUSPICIOUS with 80% confidence',
  },
];

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-mono
                   bg-sentinel-border/50 text-sentinel-muted hover:text-sentinel-safe
                   hover:bg-sentinel-safe/10 transition-all opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="bg-sentinel-bg border border-sentinel-border rounded-lg p-4 overflow-x-auto">
        <code className="font-mono text-xs leading-relaxed text-sentinel-text whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

export default function Integration() {
  const [activeTab, setActiveTab] = useState('solidity');
  const [showFull, setShowFull] = useState(false);
  const snippet = CODE_SNIPPETS[activeTab];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          <span className="text-sentinel-safe">3-Line</span> Integration
        </h1>
        <p className="text-sentinel-muted">
          Protect your smart contract with just 3 lines of code
        </p>
      </div>

      {/* Quick Start */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Quick Start</h2>
          <div className="flex gap-1 bg-sentinel-bg rounded-lg p-1">
            {Object.entries(CODE_SNIPPETS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setShowFull(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === key
                    ? 'bg-sentinel-safe/10 text-sentinel-safe border border-sentinel-safe/20'
                    : 'text-sentinel-muted hover:text-sentinel-text'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3-line snippet */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sentinel-safe font-mono text-xs font-bold tracking-wider">
              3 LINES — THAT'S IT
            </span>
          </div>
          <CodeBlock code={snippet.code} language={snippet.language} />
        </div>

        {/* Full example toggle */}
        <button
          onClick={() => setShowFull(!showFull)}
          className="text-xs text-sentinel-muted hover:text-sentinel-safe transition-colors font-mono"
        >
          {showFull ? '[-] Hide full example' : '[+] Show full example'}
        </button>
        {showFull && (
          <div className="mt-3 animate-fade-in">
            <CodeBlock code={snippet.fullExample} language={snippet.language} />
          </div>
        )}
      </div>

      {/* Integration Steps */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Integration Steps</h2>
        <div className="space-y-6">
          {INTEGRATION_STEPS.map((item, i) => (
            <div key={item.step} className="flex gap-4 animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-sentinel-safe/10 border border-sentinel-safe/30 flex items-center justify-center font-mono text-sm font-bold text-sentinel-safe">
                  {item.step}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sentinel-text">{item.title}</h3>
                <p className="text-sm text-sentinel-muted mt-1">{item.description}</p>
                <div className="mt-2 bg-sentinel-bg rounded-lg border border-sentinel-border px-4 py-2">
                  <code className="font-mono text-xs text-sentinel-safe">{item.command}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guardian ABI Reference */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">GuardianProxy ABI</h2>
        <div className="space-y-3">
          {[
            {
              fn: 'guard(bytes data, uint256 value, uint256 gas)',
              returns: '(bool allowed, uint8 threat, uint8 confidence)',
              desc: 'Main entry point. Extracts features, runs inference, returns verdict.',
            },
            {
              fn: 'classifyView(uint256[10] features)',
              returns: '(uint8 threat, uint8 confidence, uint32 gasUsed)',
              desc: 'Read-only classification. Useful for pre-flight checks.',
            },
            {
              fn: 'getStats()',
              returns: '(uint256 totalScanned, uint256 totalBlocked)',
              desc: 'Returns cumulative protection statistics.',
            },
            {
              fn: 'paused()',
              returns: '(bool)',
              desc: 'Check if guardian is paused (emergency circuit breaker).',
            },
          ].map((item) => (
            <div key={item.fn} className="bg-sentinel-bg rounded-lg border border-sentinel-border p-4">
              <div className="flex flex-wrap items-start gap-2">
                <code className="font-mono text-xs text-sentinel-safe">{item.fn}</code>
                <span className="text-sentinel-muted font-mono text-xs">&rarr;</span>
                <code className="font-mono text-xs text-sentinel-warning">{item.returns}</code>
              </div>
              <p className="text-xs text-sentinel-muted mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported Networks */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Supported Networks</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Moonbeam', status: 'live', chain: 'Polkadot' },
            { name: 'Moonriver', status: 'live', chain: 'Kusama' },
            { name: 'Astar', status: 'soon', chain: 'Polkadot' },
            { name: 'Acala EVM+', status: 'soon', chain: 'Polkadot' },
          ].map((net) => (
            <div key={net.name} className="bg-sentinel-bg rounded-lg border border-sentinel-border p-3 text-center">
              <p className="font-semibold text-sm text-sentinel-text">{net.name}</p>
              <p className="text-[10px] text-sentinel-muted mt-0.5">{net.chain}</p>
              <span
                className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  net.status === 'live'
                    ? 'bg-sentinel-safe/10 text-sentinel-safe border border-sentinel-safe/20'
                    : 'bg-sentinel-warning/10 text-sentinel-warning border border-sentinel-warning/20'
                }`}
              >
                {net.status === 'live' ? 'LIVE' : 'COMING SOON'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
