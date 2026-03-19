import React from 'react';

const ShieldSVG = ({ status = 'active', size = 120 }) => {
  const colors = {
    active: { fill: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
    warning: { fill: '#ffaa00', glow: 'rgba(255,170,0,0.5)' },
    danger: { fill: '#ff3366', glow: 'rgba(255,51,102,0.5)' },
    inactive: { fill: '#64748b', glow: 'rgba(100,116,139,0.3)' },
  };

  const c = colors[status] || colors.active;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="animate-shield-spin"
      style={{ filter: `drop-shadow(0 0 15px ${c.glow})` }}
    >
      <defs>
        <linearGradient id={`shieldGrad-${status}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c.fill} stopOpacity="0.9" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M50 5 L85 20 L85 50 Q85 80 50 95 Q15 80 15 50 L15 20 Z"
        fill="none"
        stroke={c.fill}
        strokeWidth="2"
        opacity="0.3"
      />
      {/* Shield body */}
      <path
        d="M50 10 L80 23 L80 50 Q80 76 50 90 Q20 76 20 50 L20 23 Z"
        fill={`url(#shieldGrad-${status})`}
        opacity="0.15"
      />
      {/* Shield border */}
      <path
        d="M50 10 L80 23 L80 50 Q80 76 50 90 Q20 76 20 50 L20 23 Z"
        fill="none"
        stroke={c.fill}
        strokeWidth="2.5"
      />
      {/* Inner check or X */}
      {status === 'active' && (
        <path
          d="M35 50 L45 60 L65 38"
          fill="none"
          stroke={c.fill}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {status === 'danger' && (
        <g stroke={c.fill} strokeWidth="4" strokeLinecap="round">
          <line x1="37" y1="37" x2="63" y2="63" />
          <line x1="63" y1="37" x2="37" y2="63" />
        </g>
      )}
      {status === 'warning' && (
        <g>
          <line x1="50" y1="35" x2="50" y2="55" stroke={c.fill} strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="65" r="3" fill={c.fill} />
        </g>
      )}
      {status === 'inactive' && (
        <line x1="35" y1="50" x2="65" y2="50" stroke={c.fill} strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
};

export default function ShieldStatus({ status = 'active', label, stats }) {
  const statusLabels = {
    active: 'ACTIVE — PROTECTING',
    warning: 'ELEVATED THREAT LEVEL',
    danger: 'ATTACK DETECTED',
    inactive: 'OFFLINE',
  };

  const statusColors = {
    active: 'text-sentinel-safe',
    warning: 'text-sentinel-warning',
    danger: 'text-sentinel-danger',
    inactive: 'text-sentinel-muted',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <ShieldSVG status={status} size={120} />
      <div className="text-center">
        <p className={`font-mono text-sm font-bold tracking-widest ${statusColors[status]}`}>
          {label || statusLabels[status]}
        </p>
        {stats && (
          <div className="mt-3 flex gap-6 justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-sentinel-text font-mono">{stats.scanned}</p>
              <p className="text-xs text-sentinel-muted uppercase tracking-wider">Scanned</p>
            </div>
            <div className="w-px bg-sentinel-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-sentinel-danger font-mono">{stats.blocked}</p>
              <p className="text-xs text-sentinel-muted uppercase tracking-wider">Blocked</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
