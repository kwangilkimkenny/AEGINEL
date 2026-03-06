import React from 'react';
import type { ScanResult } from '../../engine/types';
import { t } from '../../i18n';

interface Props {
  scans: ScanResult[];
}

const levelColors: Record<string, string> = {
  low: 'bg-aeginel-green/20 text-aeginel-green',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-aeginel-red/20 text-aeginel-red',
};

export default function RecentScans({ scans }: Props) {
  const recent = scans.slice(0, 10);

  if (recent.length === 0) {
    return (
      <div className="bg-aeginel-card rounded-xl p-4 border border-aeginel-border">
        <h3 className="text-sm font-semibold mb-2">{t('history.title')}</h3>
        <p className="text-xs text-aeginel-muted text-center py-4">{t('history.empty')}</p>
      </div>
    );
  }

  return (
    <div className="bg-aeginel-card rounded-xl p-4 border border-aeginel-border">
      <h3 className="text-sm font-semibold mb-2">{t('history.title')}</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {recent.map((scan) => (
          <div key={scan.id} className="flex items-center gap-2 text-xs bg-aeginel-bg rounded-lg px-3 py-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${levelColors[scan.level]}`}>
              {scan.score}
            </span>
            <span className="text-aeginel-muted truncate flex-1">{scan.site}</span>
            <span className="text-aeginel-muted truncate max-w-[120px]">
              {scan.categories.length > 0 ? t(`categories.${scan.categories[0]}`) : t('history.clean')}
            </span>
            <span className="text-aeginel-muted text-[10px]">
              {formatTime(scan.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
