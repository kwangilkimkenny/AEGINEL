import React from 'react';

interface Props {
  enabled: boolean;
  siteName: string;
  totalScans: number;
  threatsBlocked: number;
  piiProtected: number;
  onToggle: () => void;
}

export default function StatusCard({ enabled, siteName, totalScans, threatsBlocked, piiProtected, onToggle }: Props) {
  return (
    <div className={`rounded-md p-2 border ${enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-aeginel-green' : 'bg-gray-400'}`} />
          <span className="text-[11px] font-semibold">{enabled ? 'Protected' : 'Disabled'}</span>
          {siteName && (
            <span className="text-[9px] text-aeginel-muted px-1 py-px bg-white rounded border border-aeginel-border">{siteName}</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-aeginel-green' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[16px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="SCANS" value={totalScans} color="text-aeginel-text" />
        <StatBox label="BLOCKED" value={threatsBlocked} color="text-aeginel-red" />
        <StatBox label="PII" value={piiProtected} color="text-blue-600" />
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded px-1.5 py-1 text-center border border-aeginel-border">
      <div className={`text-sm font-bold leading-tight ${color}`}>{value}</div>
      <div className="text-[8px] text-aeginel-muted uppercase tracking-wider leading-tight">{label}</div>
    </div>
  );
}
