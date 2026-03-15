import React from 'react';
import type { ScanResult } from '../../engine/types';

interface Props {
  lastScan: ScanResult | null;
}

const LEVEL_CFG: Record<string, { color: string; bg: string; label: string }> = {
  low:      { color: '#3fb950', bg: 'rgba(63,185,80,0.12)',   label: 'Low Risk' },
  medium:   { color: '#d29922', bg: 'rgba(210,153,34,0.12)',  label: 'Medium Risk' },
  high:     { color: '#db6d28', bg: 'rgba(219,109,40,0.12)',  label: 'High Risk' },
  critical: { color: '#f85149', bg: 'rgba(248,81,73,0.12)',   label: 'Critical' },
};

// SVG arc helpers — semicircle top arc, left to right
const CX = 80, CY = 72, R = 58;
const ARC_LEN = Math.PI * R; // ≈ 182.2

function arcPath(): string {
  return `M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${CX + R} ${CY}`;
}

function thumbPos(score: number): { x: number; y: number } {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const angle = Math.PI * (1 - pct); // π → 0 as score goes 0 → 100
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
  };
}

export default function RiskMeter({ lastScan }: Props) {
  const score = lastScan?.score ?? 0;
  const level = lastScan?.level ?? 'low';
  const cfg = lastScan ? LEVEL_CFG[level] : { color: '#30363d', bg: 'transparent', label: 'No scan yet' };
  const pct = Math.min(score, 100) / 100;
  const fillLen = ARC_LEN * pct;
  const thumb = thumbPos(score);
  const path = arcPath();

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-aeginel-text">Risk Score</span>
        {lastScan && (
          <span className="text-[9px] text-aeginel-muted">
            {lastScan.totalLatencyMs.toFixed(0)}ms
          </span>
        )}
      </div>

      {/* SVG arc gauge */}
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 160 82" className="w-full" style={{ maxHeight: '88px' }}>
          <defs>
            <filter id="aeginel-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="aeginel-glow-strong" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path
            d={path}
            fill="none"
            stroke="#21262d"
            strokeWidth="9"
            strokeLinecap="round"
          />

          {/* Progress fill */}
          {score > 0 && (
            <path
              d={path}
              fill="none"
              stroke={cfg.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${ARC_LEN + 4}`}
              filter="url(#aeginel-glow)"
              style={{
                transition: 'stroke-dasharray 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          )}

          {/* Thumb dot */}
          {score > 0 && score < 100 && (
            <circle
              cx={thumb.x}
              cy={thumb.y}
              r="5"
              fill={cfg.color}
              filter="url(#aeginel-glow-strong)"
              style={{
                transition: 'cx 0.65s cubic-bezier(0.4,0,0.2,1), cy 0.65s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          )}

          {/* Score number */}
          <text
            x="80" y="65"
            textAnchor="middle"
            fill={lastScan ? cfg.color : '#30363d'}
            fontSize="24"
            fontWeight="800"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}
          >
            {score}
          </text>
          <text x="80" y="76" textAnchor="middle" fill="#8b949e" fontSize="9"
            fontFamily="-apple-system, sans-serif">
            / 100
          </text>
        </svg>

        {/* Level badge + categories row */}
        <div className="flex items-center gap-2 -mt-1 flex-wrap justify-center">
          {lastScan ? (
            <>
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  color: cfg.color,
                  background: cfg.bg,
                  border: `1px solid ${cfg.color}40`,
                }}
              >
                {cfg.label}
              </span>
              {lastScan.categories.length > 0 && (
                <span className="text-[9px] text-aeginel-muted truncate max-w-[160px]">
                  {lastScan.categories.slice(0, 2).join(' · ')}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] text-aeginel-muted">Waiting for scan…</span>
          )}
        </div>
      </div>
    </div>
  );
}
