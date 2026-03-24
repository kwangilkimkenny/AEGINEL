import React, { useEffect, useState, useCallback } from 'react';
import StatusCard from './components/StatusCard';
import WeeklyReport from './components/WeeklyReport';
import SettingsPanel from './components/SettingsPanel';
import type { AeginelConfig, ScanResult } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import { setLocale, useI18n } from '../i18n';
import type { StatusResponseMessage, ConfigResponseMessage, HistoryResponseMessage } from '../shared/messages';

const BADGE_VIS_KEY = 'aeginel_badge_visible';
const THEME_KEY = 'aeginel_theme';

type Theme = 'light' | 'dark';

function applyThemeToDOM(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function App() {
  const { t } = useI18n();
  const [config, setConfig] = useState<AeginelConfig>(DEFAULT_CONFIG);
  const [totalScans, setTotalScans] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [piiProtected, setPiiProtected] = useState(0);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [siteName, setSiteName] = useState('');
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [theme, setTheme] = useState<Theme>('light');

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyThemeToDOM(next);
    chrome.storage.local.set({ [THEME_KEY]: next });
  }, [theme]);

  const toggleBadge = useCallback(() => {
    const next = !badgeVisible;
    setBadgeVisible(next);
    chrome.storage.local.set({ [BADGE_VIS_KEY]: next });
  }, [badgeVisible]);

  useEffect(() => {
    chrome.storage.local.get([BADGE_VIS_KEY, THEME_KEY]).then((stored) => {
      setBadgeVisible(stored[BADGE_VIS_KEY] !== false);
      const savedTheme: Theme = stored[THEME_KEY] === 'dark' ? 'dark' : 'light';
      setTheme(savedTheme);
      applyThemeToDOM(savedTheme);
    }).catch(() => {});
  }, []);

  useEffect(() => {
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

    chrome.runtime.sendMessage({ type: 'GET_STATUS' }).then((res: StatusResponseMessage) => {
      if (res?.payload) {
        setTotalScans(res.payload.totalScans);
        setThreatsBlocked(res.payload.threatsBlocked);
        setLastScan(res.payload.lastScan);
      }
    }).catch(() => {});

    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }).then((res: ConfigResponseMessage) => {
      if (res?.payload) {
        setConfig(res.payload);
        setLocale(res.payload.uiLanguage ?? 'auto');
      }
    }).catch(() => {});

    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }).then((res: HistoryResponseMessage) => {
      if (res?.payload) setHistory(res.payload);
    }).catch(() => {});

    chrome.runtime.sendMessage({ type: 'GET_PROXY_STATS' }).then((res) => {
      if (res?.totalProtected != null) setPiiProtected(res.totalProtected);
    }).catch(() => {});
  }, []);

  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
  const todayScans = history.filter((s) => s.timestamp >= startOfToday).length;
  const weekScans = history.filter((s) => s.timestamp >= startOfWeek).length;

  const handleToggle = () => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig });
  };

  const handleUpdateConfig = (partial: Partial<AeginelConfig>) => {
    const newConfig = { ...config, ...partial };
    if (partial.pii) newConfig.pii = { ...config.pii, ...partial.pii };
    if (partial.piiProxy) newConfig.piiProxy = { ...config.piiProxy, ...partial.piiProxy };
    setConfig(newConfig);
    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: newConfig });
    if (partial.uiLanguage) setLocale(partial.uiLanguage);
  };

  const handleClearHistory = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    setHistory([]);
    setTotalScans(0);
    setThreatsBlocked(0);
    setLastScan(null);
  };

  const footerText = todayScans > 0
    ? t(todayScans > 1 ? 'footer.scansToday' : 'footer.scanToday', { count: todayScans })
    : t('footer.noScansToday');

  return (
    <div className="bg-aeginel-bg min-h-full" style={{ width: '380px' }}>

      {/* ── Header ── */}
      <div className="pl-3 pr-5 pt-4 pb-3 flex items-center justify-between border-b border-aeginel-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
            style={config.enabled
              ? { background: '#3fb950', boxShadow: '0 0 12px rgba(63,185,80,0.45)' }
              : { background: 'var(--aeginel-surface2)', border: '1px solid var(--aeginel-border)' }
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={config.enabled ? 'white' : 'var(--aeginel-muted)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-aeginel-text tracking-tight leading-none">{t('guard')}</h1>
            <p className="text-[9px] text-aeginel-muted leading-none mt-0.5 tracking-wide uppercase">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: 'var(--aeginel-surface2)',
              border: '1px solid var(--aeginel-border)',
              color: 'var(--aeginel-muted)',
            }}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
          </button>
          <button
            onClick={handleToggle}
            className="relative w-10 h-[22px] rounded-full transition-all duration-300 flex-shrink-0 p-0 border-0"
            style={config.enabled
              ? { background: '#3fb950', boxShadow: '0 0 8px rgba(63,185,80,0.4)' }
              : { background: 'var(--aeginel-toggle-off-bg)', border: `1px solid var(--aeginel-toggle-off-border)` }
            }
          >
            <span
              className="absolute left-0 top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
              style={{ transform: config.enabled ? 'translateX(21px)' : 'translateX(3px)' }}
            />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-3 py-3 space-y-2">
        <StatusCard
          enabled={config.enabled}
          siteName={siteName}
          totalScans={totalScans}
          threatsBlocked={threatsBlocked}
          piiProtected={piiProtected}
          todayScans={todayScans}
          weekScans={weekScans}
          onToggle={handleToggle}
        />

        {/* Floating badge toggle */}
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-aeginel-surface2 border border-aeginel-border/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={badgeVisible ? '#3fb950' : 'var(--aeginel-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-aeginel-text">{t('floating.showBadge')}</p>
              <p className="text-[8px] text-aeginel-muted">{t('floating.showBadgeDesc')}</p>
            </div>
          </div>
          <button
            onClick={toggleBadge}
            className="relative flex-shrink-0 rounded-full transition-all duration-300 p-0 border-0 overflow-hidden"
            style={{
              width: '32px', height: '18px',
              ...(badgeVisible
                ? { background: '#3fb950', boxShadow: '0 0 6px rgba(63,185,80,0.4)' }
                : { background: 'var(--aeginel-toggle-off-bg)', border: '1px solid var(--aeginel-toggle-off-border)' }
              ),
            }}
          >
            <span
              className="absolute left-0 top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-300"
              style={{ transform: badgeVisible ? 'translateX(15px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        <WeeklyReport />
        <SettingsPanel
          config={config}
          onUpdate={handleUpdateConfig}
          onClearHistory={handleClearHistory}
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 pb-0.5">
          <span className="text-[9px] text-aeginel-muted/50">v{chrome.runtime.getManifest().version}</span>
          <span className="text-[9px] text-aeginel-muted/40">{footerText}</span>
        </div>
      </div>
    </div>
  );
}
