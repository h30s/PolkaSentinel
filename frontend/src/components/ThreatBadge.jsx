import React from 'react';

const THREAT_CONFIG = {
  safe: {
    label: 'SAFE',
    color: 'text-sentinel-safe',
    bg: 'bg-sentinel-safe/10',
    border: 'border-sentinel-safe/30',
    glow: 'glow-safe',
    dot: 'bg-sentinel-safe',
  },
  suspicious: {
    label: 'SUSPICIOUS',
    color: 'text-sentinel-warning',
    bg: 'bg-sentinel-warning/10',
    border: 'border-sentinel-warning/30',
    glow: 'glow-warning',
    dot: 'bg-sentinel-warning',
  },
  critical: {
    label: 'CRITICAL',
    color: 'text-sentinel-danger',
    bg: 'bg-sentinel-danger/10',
    border: 'border-sentinel-danger/30',
    glow: 'glow-danger',
    dot: 'bg-sentinel-danger',
  },
  blocked: {
    label: 'BLOCKED',
    color: 'text-sentinel-danger',
    bg: 'bg-sentinel-danger/10',
    border: 'border-sentinel-danger/30',
    glow: 'glow-danger',
    dot: 'bg-sentinel-danger',
  },
  unknown: {
    label: 'UNKNOWN',
    color: 'text-sentinel-muted',
    bg: 'bg-sentinel-muted/10',
    border: 'border-sentinel-muted/30',
    glow: '',
    dot: 'bg-sentinel-muted',
  },
};

export default function ThreatBadge({ level = 'unknown', label, large = false, pulse = false }) {
  const config = THREAT_CONFIG[level] || THREAT_CONFIG.unknown;
  const displayLabel = label || config.label;

  return (
    <span
      className={`
        inline-flex items-center gap-2 font-mono font-bold tracking-wider
        border rounded-full
        ${config.bg} ${config.border} ${config.color} ${config.glow}
        ${large ? 'px-5 py-2 text-base' : 'px-3 py-1 text-xs'}
        transition-all duration-300
      `}
    >
      <span
        className={`
          inline-block rounded-full ${config.dot}
          ${large ? 'w-3 h-3' : 'w-2 h-2'}
          ${pulse ? 'animate-pulse' : ''}
        `}
      />
      {displayLabel}
    </span>
  );
}
