import React from 'react';
import type { ScanResult } from '../../engine/types';
import { useI18n } from '../../i18n';

interface Props {
  scans: ScanResult[];
}

const LEVEL_COLOR: Record<string, string> = {
  low:      '#3fb950',
  medium:   '#d29922',
  high:     '#db6d28',
  critical: '#f85149',
};

const LEVEL_BG: Record<string, string> = {
  low:      'rgba(63,185,80,0.08)',
  medium:   'rgba(210,153,34,0.08)',
  high:     'rgba(219,109,40,0.08)',
  critical: 'rgba(248,81,73,0.08)',
};

export default function RecentScans({ scans }: Props) {
  const { t } = useI18n();
  const recent = scans.slice(0, 3);

  const handleExport = () => {
    const json = JSON.stringify(scans, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeginel-scans-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-aeginel-text">{t('history.title')}</h3>
        {scans.length > 0 && (
          <button
            onClick={handleExport}
            className="text-[9px] text-aeginel-muted hover:text-aeginel-blue transition-colors px-1.5 py-0.5 rounded-md hover:bg-aeginel-surface2 flex items-center gap-1"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {t('history.export')}
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aeginel-border)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="text-[9px] text-aeginel-muted">{t('history.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recent.map((scan) => {
            const color = LEVEL_COLOR[scan.level];
            const bg = LEVEL_BG[scan.level];
            return (
              <div
                key={scan.id}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 border transition-colors"
                style={{
                  borderLeft: `3px solid ${color}`,
                  borderRight: '1px solid rgba(48,54,61,0.6)',
                  borderTop: '1px solid rgba(48,54,61,0.6)',
                  borderBottom: '1px solid rgba(48,54,61,0.6)',
                  background: bg,
                }}
              >
                <span
                  className="text-sm font-bold number-hero flex-shrink-0 w-6 text-right"
                  style={{ color }}
                >
                  {scan.score}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-aeginel-text truncate">{scan.site}</div>
                  {scan.categories.length > 0 && (
                    <div className="text-[8px] text-aeginel-muted truncate">{scan.categories[0]}</div>
                  )}
                </div>

                <span className="text-[8px] text-aeginel-muted flex-shrink-0">{fmt(scan.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
