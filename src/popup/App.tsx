import React, { useEffect, useState } from 'react';
import StatusCard from './components/StatusCard';
import RiskMeter from './components/RiskMeter';
import RecentScans from './components/RecentScans';
import SettingsPanel from './components/SettingsPanel';
import type { AeginelConfig, ScanResult } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import { t, setLocale } from '../i18n';
import type { StatusResponseMessage, ConfigResponseMessage, HistoryResponseMessage } from '../shared/messages';

export default function App() {
  const [config, setConfig] = useState<AeginelConfig>(DEFAULT_CONFIG);
  const [totalScans, setTotalScans] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [piiProtected, setPiiProtected] = useState(0);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [siteName, setSiteName] = useState('');
  const [, forceRender] = useState(0);

  // Load initial data
  useEffect(() => {
    // Get active tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const hostname = new URL(tabs[0].url).hostname;
          if (hostname.includes('chatgpt') || hostname.includes('openai')) setSiteName('ChatGPT');
          else if (hostname.includes('claude')) setSiteName('Claude');
          else if (hostname.includes('gemini')) setSiteName('Gemini');
          else setSiteName(hostname);
        } catch {
          setSiteName('');
        }
      }
    });

    // Get status
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }).then((res: StatusResponseMessage) => {
      if (res?.payload) {
        setTotalScans(res.payload.totalScans);
        setThreatsBlocked(res.payload.threatsBlocked);
        setLastScan(res.payload.lastScan);
      }
    });

    // Get config
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }).then((res: ConfigResponseMessage) => {
      if (res?.payload) {
        setConfig(res.payload);
        setLocale(res.payload.language);
        forceRender(n => n + 1);
      }
    });

    // Get history
    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }).then((res: HistoryResponseMessage) => {
      if (res?.payload) setHistory(res.payload);
    });

    // Get proxy stats
    chrome.runtime.sendMessage({ type: 'GET_PROXY_STATS' }).then((res) => {
      if (res?.totalProtected != null) setPiiProtected(res.totalProtected);
    });
  }, []);

  const handleToggle = () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig });
  };

  const handleUpdateConfig = (partial: Partial<AeginelConfig>) => {
    const newConfig = { ...config, ...partial };
    if (partial.layers) newConfig.layers = { ...config.layers, ...partial.layers };
    if (partial.pii) newConfig.pii = { ...config.pii, ...partial.pii };
    if (partial.piiProxy) newConfig.piiProxy = { ...config.piiProxy, ...partial.piiProxy };
    setConfig(newConfig);
    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig });

    // If language changed, update locale and re-render
    if (partial.language) {
      setLocale(partial.language);
      forceRender(n => n + 1);
    }
  };

  const handleClearHistory = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    setHistory([]);
    setTotalScans(0);
    setThreatsBlocked(0);
    setLastScan(null);
  };

  return (
    <div className="px-4 py-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-aeginel-green flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="text-sm font-bold text-aeginel-text">AEGINEL</h1>
        </div>
        <span className="text-[10px] text-aeginel-muted">v1.0.0</span>
      </div>

      <StatusCard
        enabled={config.enabled}
        siteName={siteName}
        totalScans={totalScans}
        threatsBlocked={threatsBlocked}
        piiProtected={piiProtected}
        onToggle={handleToggle}
      />

      <RiskMeter lastScan={lastScan} />

      <RecentScans scans={history} />

      <SettingsPanel
        config={config}
        onUpdate={handleUpdateConfig}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
