import React from 'react';
import type { ScanResult } from '../../engine/types';
import { t } from '../../i18n';

interface Props {
  lastScan: ScanResult | null;
}

export default function RiskMeter({ lastScan }: Props) {
  const score = lastScan?.score ?? 0;
  const level = lastScan?.level ?? 'low';

  const colors: Record<string, string> = {
    low: '#16a34a',
    medium: '#ca8a04',
    high: '#ea580c',
    critical: '#dc2626',
  };

  const bgColors: Record<string, string> = {
    low: 'bg-green-50 border-green-200',
    medium: 'bg-yellow-50 border-yellow-200',
    high: 'bg-orange-50 border-orange-200',
    critical: 'bg-red-50 border-red-200',
  };

  const color = colors[level];

  // Compact horizontal bar instead of arc
  const pct = Math.min(score, 100);

  return (
    <div className={`rounded-lg p-3 border ${lastScan ? bgColors[level] : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{t('risk.noScans').replace(/\..*/, '') || 'Risk Score'}</span>
        <span className="text-lg font-bold" style={{ color }}>
          {score}<span className="text-[10px] text-aeginel-muted font-normal">/100</span>
        </span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-aeginel-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {lastScan && (
        <div className="text-[10px] text-aeginel-muted mt-1">
          {lastScan.categories.map(c => t(`categories.${c}`)).join(', ') || t('history.clean')}
          {' \u2014 '}
          {lastScan.totalLatencyMs.toFixed(0)}ms
        </div>
      )}
    </div>
  );
}
