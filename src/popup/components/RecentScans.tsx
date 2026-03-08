import React from 'react';
import type { ScanResult } from '../../engine/types';

interface Props {
  scans: ScanResult[];
}

const LEVEL_DOT: Record<string, string> = {
  low: 'bg-aeginel-green',
  medium: 'bg-aeginel-yellow',
  high: 'bg-aeginel-orange',
  critical: 'bg-aeginel-red',
};

export default function RecentScans({ scans }: Props) {
  const recent = scans.slice(0, 3);

  return (
    <div className="rounded-md p-2 border border-aeginel-border bg-aeginel-card">
      <h3 className="text-[11px] font-semibold mb-1">Recent Scans</h3>
      {recent.length === 0 ? (
        <p className="text-[9px] text-aeginel-muted text-center py-1.5">No scans yet</p>
      ) : (
        <div className="space-y-0.5">
          {recent.map((scan) => (
            <div key={scan.id} className="flex items-center gap-1 text-[10px] bg-white rounded px-1.5 py-0.5 border border-aeginel-border">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LEVEL_DOT[scan.level]}`} />
              <span className="font-medium w-5 text-right">{scan.score}</span>
              <span className="text-aeginel-muted truncate flex-1">{scan.site}</span>
              <span className="text-aeginel-muted text-[9px]">{fmt(scan.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
