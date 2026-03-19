import React, { useState, useEffect } from 'react';
import ShieldStatus from '../components/ShieldStatus';
import ThreatBadge from '../components/ThreatBadge';

const MOCK_EVENTS = [
  { id: 1, time: '00:01:23', action: 'deposit()', threat: 'safe', from: '0x742d...4e3B', gas: '45,231' },
  { id: 2, time: '00:02:45', action: 'withdraw(0.5 ETH)', threat: 'safe', from: '0x892f...1a2C', gas: '52,108' },
  { id: 3, time: '00:03:12', action: 'attack(vault)', threat: 'critical', from: '0xdEaD...bEEf', gas: '78,441' },
  { id: 4, time: '00:03:12', action: 'REENTRANCY BLOCKED', threat: 'blocked', from: '0xdEaD...bEEf', gas: '---' },
  { id: 5, time: '00:04:56', action: 'deposit()', threat: 'safe', from: '0x1234...5678', gas: '45,102' },
  { id: 6, time: '00:05:30', action: 'withdraw(1.0 ETH)', threat: 'safe', from: '0x742d...4e3B', gas: '51,998' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ scanned: 0, blocked: 0 });
  const [visibleEvents, setVisibleEvents] = useState([]);

  useEffect(() => {
    // Animate stats counting up
    const targetScanned = 1247;
    const targetBlocked = 23;
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setStats({
        scanned: Math.round(targetScanned * eased),
        blocked: Math.round(targetBlocked * eased),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Stagger event appearance
    MOCK_EVENTS.forEach((event, i) => {
      setTimeout(() => {
        setVisibleEvents((prev) => [...prev, event]);
      }, 800 + i * 300);
    });
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-sentinel-safe">Polka</span>Sentinel
        </h1>
        <p className="text-sentinel-muted text-lg">
          AI-Powered Smart Contract Guardian for Polkadot
        </p>
      </div>

      {/* Shield + Stats */}
      <div className="card flex flex-col items-center py-10">
        <ShieldStatus
          status="active"
          stats={{ scanned: stats.scanned.toLocaleString(), blocked: stats.blocked }}
        />
        <div className="mt-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sentinel-safe animate-pulse" />
          <span className="font-mono text-xs text-sentinel-safe tracking-widest">
            GUARDIAN ONLINE
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Detection Rate</p>
          <p className="text-3xl font-bold font-mono text-sentinel-safe">99.7%</p>
          <p className="text-xs text-sentinel-muted mt-1">on-chain inference</p>
        </div>
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Avg Response</p>
          <p className="text-3xl font-bold font-mono text-sentinel-warning">12ms</p>
          <p className="text-xs text-sentinel-muted mt-1">pre-execution guard</p>
        </div>
        <div className="card text-center">
          <p className="text-sentinel-muted text-xs uppercase tracking-wider mb-2">Gas Overhead</p>
          <p className="text-3xl font-bold font-mono text-sentinel-text">~48k</p>
          <p className="text-xs text-sentinel-muted mt-1">per guarded call</p>
        </div>
      </div>

      {/* Live Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sentinel-safe animate-pulse" />
            Live Transaction Feed
          </h2>
          <span className="font-mono text-xs text-sentinel-muted">DEMO MODE</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sentinel-muted text-xs uppercase tracking-wider border-b border-sentinel-border">
                <th className="text-left py-2 px-3">Time</th>
                <th className="text-left py-2 px-3">From</th>
                <th className="text-left py-2 px-3">Action</th>
                <th className="text-left py-2 px-3">Gas</th>
                <th className="text-left py-2 px-3">Verdict</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {visibleEvents.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-sentinel-border/50 animate-slide-up hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 px-3 text-sentinel-muted">{event.time}</td>
                  <td className="py-2.5 px-3 text-sentinel-text">{event.from}</td>
                  <td className={`py-2.5 px-3 ${event.threat === 'critical' || event.threat === 'blocked' ? 'text-sentinel-danger' : 'text-sentinel-text'}`}>
                    {event.action}
                  </td>
                  <td className="py-2.5 px-3 text-sentinel-muted">{event.gas}</td>
                  <td className="py-2.5 px-3">
                    <ThreatBadge level={event.threat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture Overview */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          {[
            { step: '01', title: 'Intercept', desc: 'Transaction enters GuardianProxy' },
            { step: '02', title: 'Extract', desc: 'Feature extraction from calldata' },
            { step: '03', title: 'Classify', desc: 'On-chain neural network inference' },
            { step: '04', title: 'Decide', desc: 'Allow, flag, or block execution' },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              <div className="bg-sentinel-bg border border-sentinel-border rounded-lg p-4">
                <p className="font-mono text-sentinel-safe text-xs mb-1">{item.step}</p>
                <p className="font-semibold text-sentinel-text">{item.title}</p>
                <p className="text-xs text-sentinel-muted mt-1">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-2.5 transform -translate-y-1/2 text-sentinel-safe text-lg z-10">
                  &rarr;
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
