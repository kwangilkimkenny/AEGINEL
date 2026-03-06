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
    <div className="bg-aeginel-card rounded-xl p-4 border border-aeginel-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${enabled ? 'bg-aeginel-green/20' : 'bg-gray-600/20'}`}>
            {enabled ? '\u{1F6E1}\uFE0F' : '\u23F8\uFE0F'}
          </div>
          <div>
            <h2 className="font-semibold text-sm">{enabled ? t('status.protected') : t('status.disabled')}</h2>
            <p className="text-xs text-aeginel-muted">{siteName || t('status.noSite')}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-aeginel-green' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-aeginel-bg rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold">{totalScans}</div>
          <div className="text-[10px] text-aeginel-muted uppercase tracking-wide">{t('stats.scans')}</div>
        </div>
        <div className="bg-aeginel-bg rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-aeginel-red">{threatsBlocked}</div>
          <div className="text-[10px] text-aeginel-muted uppercase tracking-wide">{t('stats.blocked')}</div>
        </div>
        <div className="bg-aeginel-bg rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-blue-400">{piiProtected}</div>
          <div className="text-[10px] text-aeginel-muted uppercase tracking-wide">{t('stats.piiProtected')}</div>
        </div>
      </div>
    </div>
  );
}
