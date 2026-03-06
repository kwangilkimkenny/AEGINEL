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
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };

  const color = colors[level];
  // Arc from -135 to 135 degrees (270 degree sweep)
  const angle = -135 + (score / 100) * 270;
  const rad = (angle * Math.PI) / 180;
  const r = 70;
  const cx = 90, cy = 90;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  // Arc path for the background
  const arcPath = describeArc(cx, cy, r, -135, 135);
  const filledPath = score > 0 ? describeArc(cx, cy, r, -135, angle) : '';

  return (
    <div className="bg-aeginel-card rounded-xl p-4 border border-aeginel-border flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110">
        {/* Background arc */}
        <path d={arcPath} fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
        {/* Filled arc */}
        {filledPath && (
          <path d={filledPath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* Score text */}
        <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="32" fontWeight="bold">
          {score}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#94a3b8" fontSize="11">
          / 100
        </text>
        {/* Needle dot */}
        {score > 0 && (
          <circle cx={x} cy={y} r="5" fill={color} />
        )}
      </svg>
      <div className="text-xs text-aeginel-muted mt-1">
        {lastScan
          ? `${lastScan.categories.map(c => t(`categories.${c}`)).join(', ') || t('history.clean')} — ${lastScan.totalLatencyMs.toFixed(1)}ms`
          : t('risk.noScans')}
      </div>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
