import React, { useEffect, useState } from 'react';

interface MlStatusData {
  ready: boolean;
  loading: boolean;
  standby?: boolean;
  retryCount: number;
  lastError: string | null;
  loadDurationMs: number;
}

export default function MlStatus() {
  const [status, setStatus] = useState<MlStatusData | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_ML_STATUS' }).then((res) => {
      if (res && typeof res.ready === 'boolean') setStatus(res);
    }).catch(() => {});
  }, []);

  if (!status) return null;

  if (status.ready) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.25)', color: '#3fb950' }}
        title={`ML model loaded in ${(status.loadDurationMs / 1000).toFixed(1)}s`}
      >
        <span className="w-1 h-1 rounded-full bg-aeginel-green flex-shrink-0" />
        ML
      </div>
    );
  }

  if (status.loading) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.25)', color: '#58a6ff' }}
        title="Loading ML model..."
      >
        <span className="w-1 h-1 rounded-full bg-aeginel-blue flex-shrink-0 animate-pulse" />
        ML
      </div>
    );
  }

  if (status.standby) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.25)', color: '#8b949e' }}
        title="ML standby — loads on first input"
      >
        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#8b949e' }} />
        ML
      </div>
    );
  }

  if (status.lastError) {
    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{ background: 'rgba(219,109,40,0.1)', border: '1px solid rgba(219,109,40,0.25)', color: '#db6d28' }}
        title={`ML error — rule-based only: ${status.lastError}`}
      >
        <span className="w-1 h-1 rounded-full bg-aeginel-orange flex-shrink-0" />
        RL
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.25)', color: '#8b949e' }}
      title="ML standby — loads on first input"
    >
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#8b949e' }} />
      ML
    </div>
  );
}
