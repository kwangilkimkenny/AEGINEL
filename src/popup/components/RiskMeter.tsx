import React from 'react';
import type { ScanResult } from '../../engine/types';
import { useI18n } from '../../i18n';

interface Props {
  lastScan: ScanResult | null;
}

const CX = 90, CY = 78, R = 62;
const ARC_LEN = Math.PI * R;

function arcPath(): string {
  return `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
}

function thumbPos(score: number): { x: number; y: number } {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const angle = Math.PI * (1 - pct);
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
  };
}

export default function RiskMeter({ lastScan }: Props) {
  const { t } = useI18n();

  const LEVEL_CFG: Record<string, { color: string; bg: string; label: string }> = {
    low:      { color: '#3fb950', bg: 'rgba(63,185,80,0.12)',   label: t('risk.low') },
    medium:   { color: '#d29922', bg: 'rgba(210,153,34,0.12)',  label: t('risk.medium') },
    high:     { color: '#db6d28', bg: 'rgba(219,109,40,0.12)',  label: t('risk.high') },
    critical: { color: '#f85149', bg: 'rgba(248,81,73,0.12)',   label: t('risk.critical') },
  };

  const score = lastScan?.score ?? 0;
  const level = lastScan?.level ?? 'low';
  const cfg = lastScan ? LEVEL_CFG[level] : { color: '#30363d', bg: 'transparent', label: t('risk.noScans') };
  const pct = Math.min(score, 100) / 100;
  const fillLen = ARC_LEN * pct;
  const thumb = thumbPos(score);
  const path = arcPath();

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-aeginel-text">{t('risk.title')}</span>
        {lastScan && (
          <span className="text-[9px] text-aeginel-muted">
            {lastScan.totalLatencyMs.toFixed(0)}ms
          </span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 180 90" overflow="visible" className="w-full" style={{ maxHeight: '100px' }}>
          <defs>
            <filter id="aeginel-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="aeginel-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path d={path} fill="none" stroke="#21262d" strokeWidth="8" strokeLinecap="round" />

          {/* Progress fill */}
          {score > 0 && (
            <path
              d={path}
              fill="none"
              stroke={cfg.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${ARC_LEN + 10}`}
              filter="url(#aeginel-glow)"
              style={{ transition: 'stroke-dasharray 0.65s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          )}

          {/* Thumb dot */}
          {score > 0 && score < 100 && (
            <circle
              cx={thumb.x} cy={thumb.y} r="5"
              fill={cfg.color}
              filter="url(#aeginel-glow-strong)"
              style={{ transition: 'cx 0.65s cubic-bezier(0.4,0,0.2,1), cy 0.65s cubic-bezier(0.4,0,0.2,1)' }}
            />
          )}

          {/* Score number */}
          <text
            x={CX} y={CY - 10} textAnchor="middle"
            fill={lastScan ? cfg.color : '#30363d'}
            fontSize="26" fontWeight="800"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}
          >
            {score}
          </text>
          <text x={CX} y={CY + 1} textAnchor="middle" fill="#8b949e" fontSize="9"
            fontFamily="-apple-system, sans-serif">
            / 100
          </text>
        </svg>

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
            <span className="text-[10px] text-aeginel-muted">{t('risk.waiting')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
