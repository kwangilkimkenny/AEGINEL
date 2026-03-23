import React, { useEffect, useState } from 'react';

interface WeeklyReportData {
  period: { start: string; end: string };
  thisWeek: {
    totalScans: number;
    threatsBlocked: number;
    piiProtected: number;
    topCategories: [string, number][];
    siteBreakdown: [string, number][];
  };
  allTime: {
    totalScans: number;
    threatsBlocked: number;
  };
}

const CAT_LABELS: Record<string, string> = {
  pii_exposure:       'PII Detected',
  korean_rrn:         'Korean RRN',
  credit_card:        'Credit Card',
  email:              'Email',
  phone_kr:           'Phone (KR)',
  phone_intl:         'Phone (Intl)',
  ssn:                'SSN',
  passport:           'Passport',
};

export default function WeeklyReport() {
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_WEEKLY_REPORT' }).then((res) => {
      if (res?.payload) setReport(res.payload);
    }).catch(() => {});
  }, []);

  if (!report) return null;

  const { thisWeek, period } = report;
  const hasActivity = thisWeek.totalScans > 0;

  const shareText = [
    `AEGINEL Weekly Report (${period.start} ~ ${period.end})`,
    `Scans: ${thisWeek.totalScans} | PII Protected: ${thisWeek.piiProtected}`,
    thisWeek.topCategories.length > 0
      ? `Categories: ${thisWeek.topCategories.map(([c, n]) => `${CAT_LABELS[c] ?? c}(${n})`).join(', ')}`
      : '',
    `Protected by Aegis Personal`,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-aeginel-surface2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-[11px] font-semibold text-aeginel-text">Weekly Report</span>
          {hasActivity && (
            <span
              className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.2)', color: '#3fb950' }}
            >
              {thisWeek.totalScans}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-aeginel-muted">{period.start.slice(5)} ~ {period.end.slice(5)}</span>
          <svg
            width="9" height="9" viewBox="0 0 10 10"
            className={`text-aeginel-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-aeginel-border space-y-2.5 animate-fade-in">
          {!hasActivity ? (
            <p className="text-[10px] text-aeginel-muted text-center py-3">No activity this week yet.</p>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-1.5">
                <MiniStat label="Scans"         value={thisWeek.totalScans}    color="#e6edf3" />
                <MiniStat label="PII Protected"  value={thisWeek.piiProtected}  color="#58a6ff" />
              </div>

              {/* Top categories */}
              {thisWeek.topCategories.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold text-aeginel-muted mb-1.5 uppercase tracking-wide">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {thisWeek.topCategories.map(([cat, count]) => (
                      <span
                        key={cat}
                        className="text-[8px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', color: '#58a6ff' }}
                      >
                        {CAT_LABELS[cat] ?? cat} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Site breakdown with mini bars */}
              {thisWeek.siteBreakdown.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold text-aeginel-muted mb-1.5 uppercase tracking-wide">Sites</p>
                  <div className="space-y-1.5">
                    {thisWeek.siteBreakdown.map(([site, count]) => {
                      const pct = thisWeek.totalScans > 0
                        ? Math.max((count / thisWeek.totalScans) * 100, 4)
                        : 4;
                      return (
                        <div key={site} className="flex items-center gap-2">
                          <span className="text-[9px] text-aeginel-muted truncate w-24 flex-shrink-0">{site}</span>
                          <div className="flex-1 h-1 bg-aeginel-surface2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: 'rgba(63,185,80,0.5)' }}
                            />
                          </div>
                          <span className="text-[8px] text-aeginel-muted w-4 text-right flex-shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="w-full text-[10px] py-1.5 rounded-lg border font-medium transition-all"
                style={copied
                  ? { background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', color: '#3fb950' }
                  : { background: '#21262d', border: '1px solid #30363d', color: '#8b949e' }
                }
              >
                {copied ? '✓ Copied!' : 'Copy Report'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-aeginel-surface2 rounded-lg px-2 py-1.5 text-center border border-aeginel-border/50">
      <div className="text-sm font-bold leading-none number-hero" style={{ color }}>{value}</div>
      <div className="text-[8px] text-aeginel-muted leading-tight mt-0.5">{label}</div>
    </div>
  );
}
