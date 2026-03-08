import React from 'react';
import type { ScanResult } from '../../engine/types';

interface Props {
  lastScan: ScanResult | null;
}

const LEVEL_COLORS: Record<string, string> = {
  low: '#16a34a',
  medium: '#ca8a04',
  high: '#ea580c',
  critical: '#dc2626',
};

const LEVEL_BG: Record<string, string> = {
  low: 'bg-green-50 border-green-200',
  medium: 'bg-yellow-50 border-yellow-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200',
};

const LEVEL_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function RiskMeter({ lastScan }: Props) {
  const score = lastScan?.score ?? 0;
  const level = lastScan?.level ?? 'low';
  const color = LEVEL_COLORS[level];
  const pct = Math.min(score, 100);

  return (
    <div className={`rounded-md p-2 border ${lastScan ? LEVEL_BG[level] : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold">Risk Score</span>
        <div className="flex items-center gap-1">
          {lastScan && (
            <span className="text-[9px] text-aeginel-muted">{LEVEL_LABELS[level]}</span>
          )}
          <span className="text-sm font-bold" style={{ color }}>
            {score}<span className="text-[9px] text-aeginel-muted font-normal">/100</span>
          </span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-aeginel-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {lastScan && (
        <div className="text-[9px] text-aeginel-muted mt-0.5 truncate">
          {lastScan.categories.join(', ') || 'Clean'} — {lastScan.totalLatencyMs.toFixed(0)}ms
        </div>
      )}
    </div>
  );
}
