import React from 'react';
import type { ScanResult } from '../../engine/types';
import { t } from '../../i18n';

interface Props {
  scans: ScanResult[];
}

const levelDot: Record<string, string> = {
  low: 'bg-aeginel-green',
  medium: 'bg-aeginel-yellow',
  high: 'bg-aeginel-orange',
  critical: 'bg-aeginel-red',
};

export default function RecentScans({ scans }: Props) {
  const recent = scans.slice(0, 3);

  return (
    <div className="rounded-lg p-3 border border-aeginel-border bg-aeginel-card">
      <h3 className="text-xs font-semibold mb-1.5">{t('history.title')}</h3>
      {recent.length === 0 ? (
        <p className="text-[10px] text-aeginel-muted text-center py-2">{t('history.empty')}</p>
      ) : (
        <div className="space-y-1">
          {recent.map((scan) => (
            <div key={scan.id} className="flex items-center gap-1.5 text-[11px] bg-white rounded px-2 py-1 border border-aeginel-border">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${levelDot[scan.level]}`} />
              <span className="font-medium w-6 text-right">{scan.score}</span>
              <span className="text-aeginel-muted truncate flex-1">{scan.site}</span>
              <span className="text-aeginel-muted text-[10px]">{formatTime(scan.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
