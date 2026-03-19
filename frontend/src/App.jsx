import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Demo from './pages/Demo';
import GasComparison from './pages/GasComparison';
import Integration from './pages/Integration';

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
    >
      {children}
    </NavLink>
  );
}

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-sentinel-bg flex flex-col">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-sentinel-bg/80 backdrop-blur-xl border-b border-sentinel-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 group">
            {/* Inline shield logo */}
            <svg width="28" height="28" viewBox="0 0 100 100" className="group-hover:scale-110 transition-transform">
              <path
                d="M50 10 L80 23 L80 50 Q80 76 50 90 Q20 76 20 50 L20 23 Z"
                fill="rgba(0,255,136,0.1)"
                stroke="#00ff88"
                strokeWidth="4"
              />
              <path
                d="M35 50 L45 60 L65 38"
                fill="none"
                stroke="#00ff88"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-sentinel-safe">Polka</span>
              <span className="text-sentinel-text">Sentinel</span>
            </span>
          </NavLink>
          <div className="flex items-center gap-1">
            <NavItem to="/dashboard">Dashboard</NavItem>
            <NavItem to="/demo">Demo</NavItem>
            <NavItem to="/gas">Gas</NavItem>
            <NavItem to="/integration">Integrate</NavItem>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-sentinel-border py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-sentinel-muted font-mono">
            PolkaSentinel v1.0.0 — AI-Powered Smart Contract Guardian
          </p>
          <p className="text-xs text-sentinel-muted">
            Built for Polkadot Hackathon 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/gas" element={<GasComparison />} />
        <Route path="/integration" element={<Integration />} />
      </Routes>
    </Layout>
  );
}
