import React, { useState, useEffect } from 'react';

const GAS_DATA = [
  {
    operation: 'deposit()',
    unprotected: 45102,
    protected: 93318,
    overhead: 48216,
    description: 'Standard ETH deposit to vault',
  },
  {
    operation: 'withdraw(uint256)',
    unprotected: 51998,
    protected: 100745,
    overhead: 48747,
    description: 'Normal withdrawal request',
  },
  {
    operation: 'transfer(address,uint256)',
    unprotected: 21000,
    protected: 69150,
    overhead: 48150,
    description: 'Simple token transfer',
  },
  {
    operation: 'approve(address,uint256)',
    unprotected: 46000,
    protected: 94200,
    overhead: 48200,
    description: 'Token spending approval',
  },
  {
    operation: 'swap(uint256,uint256)',
    unprotected: 120000,
    protected: 168500,
    overhead: 48500,
    description: 'DEX token swap',
  },
  {
    operation: 'attack() [BLOCKED]',
    unprotected: 'N/A',
    protected: 78441,
    overhead: '---',
    description: 'Reentrancy attack (reverted)',
  },
];

const COST_COMPARISON = {
  auditCost: 50000,
  averageLoss: 2000000,
  sentinelOverheadPerTx: 0.0012,
  txPerDay: 1000,
  monthlyCost: 36,
};

function AnimatedNumber({ target, duration = 1500 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (typeof target !== 'number') return;
    const steps = 40;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <>{value.toLocaleString()}</>;
}

function GasBar({ value, max, color }) {
  const width = typeof value === 'number' ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-sentinel-bg rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function GasComparison() {
  const maxGas = Math.max(...GAS_DATA.filter((d) => typeof d.protected === 'number').map((d) => d.protected));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          Gas <span className="text-sentinel-safe">Comparison</span>
        </h1>
        <p className="text-sentinel-muted">
          Understanding the cost of on-chain AI protection
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Average Overhead</p>
          <p className="text-3xl font-bold font-mono text-sentinel-safe">~48k</p>
          <p className="text-xs text-sentinel-muted mt-1">gas per guarded transaction</p>
        </div>
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Cost Per Tx</p>
          <p className="text-3xl font-bold font-mono text-sentinel-warning">$0.0012</p>
          <p className="text-xs text-sentinel-muted mt-1">at current gas prices</p>
        </div>
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Protection Value</p>
          <p className="text-3xl font-bold font-mono text-sentinel-danger">$2M+</p>
          <p className="text-xs text-sentinel-muted mt-1">avg loss prevented per exploit</p>
        </div>
      </div>

      {/* Gas Table */}
      <div className="card overflow-hidden">
        <h2 className="text-lg font-semibold mb-4">Detailed Gas Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sentinel-muted text-xs uppercase tracking-wider border-b border-sentinel-border">
                <th className="text-left py-3 px-4">Operation</th>
                <th className="text-right py-3 px-4">Unprotected</th>
                <th className="text-right py-3 px-4">Protected</th>
                <th className="text-right py-3 px-4">Overhead</th>
                <th className="text-left py-3 px-4 w-48">Comparison</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {GAS_DATA.map((row, i) => (
                <tr
                  key={row.operation}
                  className="border-b border-sentinel-border/50 hover:bg-white/[0.02] transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <td className="py-3 px-4">
                    <div>
                      <span className={`font-medium ${row.operation.includes('BLOCKED') ? 'text-sentinel-danger' : 'text-sentinel-text'}`}>
                        {row.operation}
                      </span>
                      <p className="text-sentinel-muted text-[10px] font-sans mt-0.5">{row.description}</p>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-sentinel-muted">
                    {typeof row.unprotected === 'number' ? (
                      <AnimatedNumber target={row.unprotected} />
                    ) : (
                      row.unprotected
                    )}
                  </td>
                  <td className="text-right py-3 px-4 text-sentinel-safe">
                    {typeof row.protected === 'number' ? (
                      <AnimatedNumber target={row.protected} />
                    ) : (
                      row.protected
                    )}
                  </td>
                  <td className="text-right py-3 px-4 text-sentinel-warning">
                    {typeof row.overhead === 'number' ? (
                      <>+<AnimatedNumber target={row.overhead} /></>
                    ) : (
                      row.overhead
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <GasBar value={row.unprotected} max={maxGas} color="bg-sentinel-muted" />
                      <GasBar
                        value={row.protected}
                        max={maxGas}
                        color={row.operation.includes('BLOCKED') ? 'bg-sentinel-danger' : 'bg-sentinel-safe'}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-6 text-xs text-sentinel-muted px-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 rounded bg-sentinel-muted" />
            <span>Unprotected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 rounded bg-sentinel-safe" />
            <span>Protected (PolkaSentinel)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 rounded bg-sentinel-danger" />
            <span>Attack Blocked</span>
          </div>
        </div>
      </div>

      {/* ROI Comparison */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Cost-Benefit Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Traditional */}
          <div className="bg-sentinel-bg rounded-lg border border-sentinel-border p-5">
            <h3 className="text-sentinel-muted text-sm font-semibold uppercase tracking-wider mb-4">
              Traditional Audit
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Upfront Cost</span>
                <span className="font-mono text-sentinel-danger">$50,000+</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Coverage</span>
                <span className="font-mono text-sentinel-warning">Point-in-time</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Response Time</span>
                <span className="font-mono text-sentinel-warning">2-4 weeks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Zero-day Protection</span>
                <span className="font-mono text-sentinel-danger">None</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Runtime Protection</span>
                <span className="font-mono text-sentinel-danger">None</span>
              </div>
            </div>
          </div>

          {/* PolkaSentinel */}
          <div className="bg-sentinel-bg rounded-lg border border-sentinel-safe/30 p-5 shadow-[0_0_15px_rgba(0,255,136,0.05)]">
            <h3 className="text-sentinel-safe text-sm font-semibold uppercase tracking-wider mb-4">
              PolkaSentinel Guardian
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Monthly Cost</span>
                <span className="font-mono text-sentinel-safe">~$36</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Coverage</span>
                <span className="font-mono text-sentinel-safe">Continuous</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Response Time</span>
                <span className="font-mono text-sentinel-safe">12ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Zero-day Protection</span>
                <span className="font-mono text-sentinel-safe">AI-Adaptive</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">Runtime Protection</span>
                <span className="font-mono text-sentinel-safe">Pre-execution</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overhead breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Where Does the Gas Go?</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Feature Extraction', gas: '12,400', pct: '26%', desc: 'Parse calldata into 10 features' },
            { label: 'Neural Network', gas: '28,300', pct: '59%', desc: '3-layer inference (10->16->8->3)' },
            { label: 'Decision Logic', gas: '4,200', pct: '9%', desc: 'Threshold check & revert logic' },
            { label: 'Proxy Overhead', gas: '3,316', pct: '6%', desc: 'Delegatecall & bookkeeping' },
          ].map((item, i) => (
            <div key={item.label} className="bg-sentinel-bg rounded-lg border border-sentinel-border p-4 text-center">
              <p className="text-2xl font-bold font-mono text-sentinel-safe">{item.pct}</p>
              <p className="text-sm font-semibold text-sentinel-text mt-1">{item.label}</p>
              <p className="text-xs text-sentinel-muted mt-0.5 font-mono">{item.gas} gas</p>
              <p className="text-[10px] text-sentinel-muted mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
