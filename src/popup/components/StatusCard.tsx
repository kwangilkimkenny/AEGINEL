import React from 'react';
import { t } from '../../i18n';

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
    <div className={`rounded-lg p-3 border ${enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-aeginel-green' : 'bg-gray-400'}`} />
          <span className="text-xs font-semibold">
            {enabled ? t('status.protected') : t('status.disabled')}
          </span>
          {siteName && (
            <span className="text-[10px] text-aeginel-muted px-1.5 py-0.5 bg-white rounded border border-aeginel-border">
              {siteName}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-aeginel-green' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label={t('stats.scans')} value={totalScans} color="text-aeginel-text" />
        <StatBox label={t('stats.blocked')} value={threatsBlocked} color="text-aeginel-red" />
        <StatBox label={t('stats.piiProtected')} value={piiProtected} color="text-blue-600" />
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-md px-2 py-1.5 text-center border border-aeginel-border">
      <div className={`text-base font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-aeginel-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}
