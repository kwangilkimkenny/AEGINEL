import React from 'react';
import { useI18n } from '../../i18n';

interface Props {
  enabled: boolean;
  siteName: string;
  totalScans: number;
  threatsBlocked: number;
  piiProtected: number;
  todayScans: number;
  weekScans: number;
  onToggle: () => void;
}

export default function StatusCard({
  enabled, siteName, totalScans, threatsBlocked, piiProtected, todayScans, weekScans,
}: Props) {
  const { t } = useI18n();

  const subText = todayScans > 0
    ? `${todayScans} ${t('stats.today')}`
    : weekScans > 0
      ? `${weekScans} ${t('stats.thisWeek')}`
      : undefined;

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface p-3 animate-slide-up">
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-300"
            style={enabled
              ? { background: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.3)', color: '#3fb950' }
              : { background: 'var(--aeginel-surface2)', border: '1px solid var(--aeginel-border)', color: 'var(--aeginel-muted)' }
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${enabled ? 'bg-aeginel-green status-dot-active' : 'bg-aeginel-muted'}`}
            />
            {enabled ? t('status.protected') : t('status.disabled')}
          </div>

          {/* Site pill */}
          {siteName && (
            <span className="text-[9px] text-aeginel-muted px-2 py-0.5 bg-aeginel-surface2 rounded-md border border-aeginel-border">
              {siteName}
            </span>
          )}
        </div>
      </div>

      {/* Stats bento grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatBox
          label={t('stats.scans')}
          value={totalScans}
          sub={subText}
          color="var(--aeginel-text)"
          icon={
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--aeginel-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          }
        />
        <StatBox
          label={t('stats.piiProtected')}
          value={piiProtected}
          color="#58a6ff"
          icon={
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          }
        />
      </div>
    </div>
  );
}

function StatBox({
  label, value, color, sub, icon,
}: {
  label: string; value: number; color: string; sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-aeginel-surface2 rounded-lg p-2 text-center border border-aeginel-border/60 hover:border-aeginel-border transition-colors">
      <div className="flex justify-center mb-1">{icon}</div>
      <div
        className="text-[15px] font-bold leading-none number-hero"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[8px] text-aeginel-muted leading-tight mt-1 tracking-wide">{label}</div>
      {sub && <div className="text-[7px] leading-tight mt-0.5" style={{ color: 'rgba(139,148,158,0.6)' }}>{sub}</div>}
    </div>
  );
}
