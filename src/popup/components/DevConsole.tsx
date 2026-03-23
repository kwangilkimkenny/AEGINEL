import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DevLogEntry } from '../../engine/types';

const TYPE_COLORS: Record<DevLogEntry['type'], string> = {
  scan: '#58a6ff',
  aegis: '#d2a8ff',
  health: '#3fb950',
  error: '#f85149',
};

const TYPE_LABELS: Record<DevLogEntry['type'], string> = {
  scan: 'SCAN',
  aegis: 'AEGIS',
  health: 'HEALTH',
  error: 'ERROR',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DevConsole() {
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<DevLogEntry['type'] | 'all'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'GET_DEV_LOGS' }).then((res) => {
      if (res?.payload) setLogs(res.payload);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_DEV_LOGS' }).then(() => setLogs([])).catch(() => {});
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as DevLogEntry['type'] | 'all')}
          className="bg-aeginel-surface2 rounded px-1.5 py-0.5 text-[9px] text-aeginel-text focus:outline-none"
          style={{ border: '1px solid #30363d' }}
        >
          <option value="all">All</option>
          <option value="scan">Scan</option>
          <option value="aegis">Aegis</option>
          <option value="health">Health</option>
          <option value="error">Error</option>
        </select>

        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
          style={{
            background: autoRefresh ? 'rgba(63,185,80,0.15)' : 'rgba(139,148,158,0.1)',
            border: `1px solid ${autoRefresh ? 'rgba(63,185,80,0.3)' : '#30363d'}`,
            color: autoRefresh ? '#3fb950' : '#8b949e',
          }}
        >
          {autoRefresh ? 'Live' : 'Paused'}
        </button>

        <button
          onClick={fetchLogs}
          className="text-[9px] px-1.5 py-0.5 rounded text-aeginel-muted hover:text-aeginel-text transition-colors"
          style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #30363d' }}
        >
          Refresh
        </button>

        <div className="flex-1" />

        <span className="text-[8px] text-aeginel-muted">{filtered.length} entries</span>

        <button
          onClick={handleClear}
          className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)', color: '#f85149' }}
        >
          Clear
        </button>
      </div>

      {/* Log list */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: '#0d1117',
          border: '1px solid #21262d',
          maxHeight: '260px',
          overflowY: 'auto',
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-aeginel-muted">No logs yet.</p>
            <p className="text-[8px] text-aeginel-muted/60 mt-1">Logs appear here when scans are performed.</p>
          </div>
        ) : (
          filtered.map((log, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={`${log.timestamp}-${idx}`}
                className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                style={{ borderBottom: '1px solid #161b22' }}
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              >
                {/* Summary row */}
                <div className="flex items-start gap-1.5 px-2 py-1">
                  <span className="text-[8px] text-aeginel-muted/50 flex-shrink-0 pt-px leading-[14px]">
                    {formatTime(log.timestamp)}
                  </span>
                  <span
                    className="text-[8px] font-bold flex-shrink-0 pt-px leading-[14px] rounded px-1"
                    style={{
                      color: TYPE_COLORS[log.type],
                      background: `${TYPE_COLORS[log.type]}15`,
                    }}
                  >
                    {TYPE_LABELS[log.type]}
                  </span>
                  <span className="text-[9px] text-aeginel-text/80 leading-[14px] break-all">
                    {log.summary}
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && log.details && (
                  <div
                    className="px-2 pb-2 pt-0 ml-[60px]"
                    style={{ fontSize: '9px', lineHeight: '15px' }}
                  >
                    {Object.entries(log.details).map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <span className="text-aeginel-muted/60 flex-shrink-0">{key}:</span>
                        <span
                          className="break-all"
                          style={{
                            color:
                              key === 'blocked' && value === true
                                ? '#f85149'
                                : key === 'finalScore' && typeof value === 'number' && value >= 70
                                  ? '#f0883e'
                                  : '#8b949e',
                          }}
                        >
                          {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
