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
  harmful_content: 'Harmful',
  jailbreak: 'Jailbreak',
  prompt_injection: 'Injection',
  data_extraction: 'Extraction',
  social_engineering: 'Social Eng.',
  script_evasion: 'Evasion',
  encoding_attack: 'Encoding',
  multi_turn: 'Multi-turn',
  self_harm: 'Self Harm',
  pii_exposure: 'PII',
};

export default function WeeklyReport() {
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_WEEKLY_REPORT' }).then((res) => {
      if (res?.payload) setReport(res.payload);
    });
  }, []);

  if (!report) {
    return (
      <div className="rounded-md p-2 border border-aeginel-border bg-aeginel-card">
        <h3 className="text-[11px] font-semibold mb-1">Weekly Report</h3>
        <p className="text-[9px] text-aeginel-muted text-center py-2">Loading...</p>
      </div>
    );
  }

  const { thisWeek, period } = report;
  const hasActivity = thisWeek.totalScans > 0;

  const shareText = [
    `AEGINEL Weekly Report (${period.start} ~ ${period.end})`,
    `Scans: ${thisWeek.totalScans} | Threats blocked: ${thisWeek.threatsBlocked} | PII protected: ${thisWeek.piiProtected}`,
    thisWeek.topCategories.length > 0
      ? `Top threats: ${thisWeek.topCategories.map(([c, n]) => `${CAT_LABELS[c] ?? c}(${n})`).join(', ')}`
      : '',
    `Protected by AEGINEL — AI Safety Guard`,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-md p-2 border border-aeginel-border bg-aeginel-card">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[11px] font-semibold">Weekly Report</h3>
        <span className="text-[8px] text-aeginel-muted">{period.start} ~ {period.end}</span>
      </div>

      {!hasActivity ? (
        <p className="text-[9px] text-aeginel-muted text-center py-2">No activity this week yet.</p>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <MiniStat label="SCANS" value={thisWeek.totalScans} color="text-aeginel-text" />
            <MiniStat label="BLOCKED" value={thisWeek.threatsBlocked} color="text-aeginel-red" />
            <MiniStat label="PII" value={thisWeek.piiProtected} color="text-blue-600" />
          </div>

          {/* Top Categories */}
          {thisWeek.topCategories.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] font-semibold text-aeginel-muted block mb-0.5">Top Threats</span>
              <div className="flex flex-wrap gap-1">
                {thisWeek.topCategories.map(([cat, count]) => (
                  <span key={cat} className="text-[8px] bg-red-50 text-aeginel-red border border-red-200 rounded-full px-1.5 py-px">
                    {CAT_LABELS[cat] ?? cat} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Site Breakdown */}
          {thisWeek.siteBreakdown.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] font-semibold text-aeginel-muted block mb-0.5">Sites</span>
              <div className="space-y-px">
                {thisWeek.siteBreakdown.map(([site, count]) => (
                  <div key={site} className="flex items-center justify-between text-[9px]">
                    <span className="text-aeginel-text truncate">{site}</span>
                    <span className="text-aeginel-muted ml-1">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share Button */}
          <button
            onClick={handleCopy}
            className="w-full text-[10px] py-1 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Report to Share'}
          </button>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded px-1.5 py-1 text-center border border-aeginel-border">
      <div className={`text-sm font-bold leading-tight ${color}`}>{value}</div>
      <div className="text-[8px] text-aeginel-muted uppercase tracking-wider leading-tight">{label}</div>
    </div>
  );
}
