import React, { useEffect, useState } from 'react';

interface MlStatusData {
  ready: boolean;
  loading: boolean;
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
      <div className="flex items-center gap-1 text-[9px] text-aeginel-muted px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-aeginel-green" />
        ML Model Ready
        {status.loadDurationMs > 0 && (
          <span className="text-[8px]">({(status.loadDurationMs / 1000).toFixed(1)}s)</span>
        )}
      </div>
    );
  }

  if (status.loading) {
    return (
      <div className="flex items-center gap-1 text-[9px] text-blue-500 px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Loading ML Model...
      </div>
    );
  }

  if (status.lastError) {
    return (
      <div className="flex items-center gap-1 text-[9px] text-aeginel-muted px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-aeginel-orange" />
        ML: Rule-based only
      </div>
    );
  }

  return null;
}
