import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import type { AeginelConfig, AegisServerConfig, AegisUsageInfo } from '../../engine/types';
import { LANGUAGE_OPTIONS } from '../../i18n';

const DevConsole = lazy(() => import('./DevConsole'));

interface Props {
  config: AeginelConfig;
  onUpdate: (partial: Partial<AeginelConfig>) => void;
  onClearHistory: () => void;
}

type Tab = 'privacy' | 'advanced';
const TABS: { key: Tab; label: string }[] = [
  { key: 'privacy',   label: 'Privacy' },
  { key: 'advanced',  label: 'Advanced' },
];

export default function SettingsPanel({ config, onUpdate, onClearHistory }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('privacy');

  const piiTypeCount = Object.values(config.pii.types).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-aeginel-border bg-aeginel-surface overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-aeginel-surface2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span className="text-[11px] font-semibold text-aeginel-text">Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-aeginel-muted">{piiTypeCount}/7 PII types</span>
          <svg
            width="9" height="9" viewBox="0 0 10 10"
            className={`text-aeginel-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-aeginel-border animate-fade-in">
          {/* Tab bar */}
          <div className="flex gap-0 px-3 pt-2.5 border-b border-aeginel-border">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="text-[10px] font-medium px-3 py-1.5 transition-all relative"
                style={activeTab === key
                  ? { color: '#e6edf3' }
                  : { color: '#8b949e' }
                }
              >
                {label}
                {activeTab === key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: '#3fb950' }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3">
            {/* ── PRIVACY TAB ── */}
            {activeTab === 'privacy' && (
              <>
                <ToggleRow
                  label="PII Detection"
                  desc="Detect personal data in prompts"
                  checked={config.pii.enabled}
                  onChange={() => onUpdate({ pii: { ...config.pii, enabled: !config.pii.enabled } })}
                />

                <div className="h-px bg-aeginel-border" />

                <ToggleRow
                  label="Auto Pseudonymize"
                  desc="Replace PII with fake values before sending"
                  checked={config.piiProxy.enabled}
                  onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, enabled: !config.piiProxy.enabled } })}
                />

                {config.piiProxy.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-aeginel-muted">Proxy Mode</span>
                      <select
                        value={config.piiProxy.mode}
                        onChange={(e) => onUpdate({ piiProxy: { ...config.piiProxy, mode: e.target.value as 'auto' | 'confirm' } })}
                        className="bg-aeginel-surface2 rounded-lg px-2 py-1 text-[10px] text-aeginel-text focus:outline-none"
                        style={{ border: '1px solid #30363d' }}
                      >
                        <option value="auto">Auto</option>
                        <option value="confirm">Confirm</option>
                      </select>
                    </div>

                    <ToggleRow
                      label="Show Notification"
                      desc="Banner when PII is protected"
                      checked={config.piiProxy.showNotification}
                      onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, showNotification: !config.piiProxy.showNotification } })}
                    />
                  </>
                )}

                <div className="h-px bg-aeginel-border" />

                {/* Block Threshold */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-[10px] font-medium text-aeginel-text">Block Threshold</p>
                      <p className="text-[8px] text-aeginel-muted">Score at which input is blocked</p>
                    </div>
                    <span
                      className="text-[13px] font-bold number-hero"
                      style={{ color: '#f85149' }}
                    >
                      {config.blockThreshold}
                    </span>
                  </div>
                  <input
                    type="range" min="20" max="100" step="5"
                    value={config.blockThreshold}
                    onChange={(e) => onUpdate({ blockThreshold: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            {/* ── ADVANCED TAB ── */}
            {activeTab === 'advanced' && (
              <>
                {/* AEGIS Server */}
                <AegisServerPanel
                  config={config.aegisServer}
                  onUpdate={(partial) => {
                    onUpdate({
                      aegisServer: { ...config.aegisServer, ...partial },
                    });
                  }}
                />

                <div className="h-px bg-aeginel-border" />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-aeginel-text">Language</span>
                  <select
                    value={config.language}
                    onChange={(e) => onUpdate({ language: e.target.value })}
                    className="bg-aeginel-surface2 rounded-lg px-2 py-1 text-[10px] text-aeginel-text focus:outline-none"
                    style={{ border: '1px solid #30363d' }}
                  >
                    <option value="auto">Auto</option>
                    {LANGUAGE_OPTIONS.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-aeginel-text">Allowed Sites</span>
                    <span className="text-[8px] text-aeginel-muted">{(config.allowlist ?? []).length} domains</span>
                  </div>
                  <p className="text-[8px] text-aeginel-muted mb-1.5">One domain per line — these sites skip scanning.</p>
                  <textarea
                    value={(config.allowlist ?? []).join('\n')}
                    onChange={(e) => {
                      const domains = e.target.value.split('\n').map((d) => d.trim()).filter(Boolean);
                      onUpdate({ allowlist: domains });
                    }}
                    placeholder={'example.com\nmysite.org'}
                    rows={3}
                    className="w-full bg-aeginel-surface2 rounded-lg px-2.5 py-2 text-[10px] text-aeginel-text resize-none focus:outline-none"
                    style={{ border: '1px solid #30363d' }}
                  />
                </div>

                <button
                  onClick={onClearHistory}
                  className="w-full text-[10px] py-2 rounded-lg font-medium transition-all hover:opacity-90"
                  style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)', color: '#f85149' }}
                >
                  Clear All History
                </button>

                {/* Developer Mode */}
                <div className="pt-2 mt-1" style={{ borderTop: '1px solid #21262d' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-medium text-aeginel-text">Developer Mode</span>
                      <p className="text-[8px] text-aeginel-muted mt-0.5">Show real-time scan logs &amp; debug info</p>
                    </div>
                    <button
                      onClick={() => onUpdate({ devMode: !config.devMode })}
                      className="relative w-9 h-[20px] rounded-full transition-all duration-300 flex-shrink-0 p-0 border-0"
                      style={config.devMode
                        ? { background: '#58a6ff', boxShadow: '0 0 8px rgba(88,166,255,0.4)' }
                        : { background: '#21262d', border: '1px solid #30363d' }
                      }
                    >
                      <span
                        className="absolute left-0 top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-300"
                        style={{ transform: config.devMode ? 'translateX(19px)' : 'translateX(3px)' }}
                      />
                    </button>
                  </div>

                  {config.devMode && (
                    <div className="mt-2">
                      <Suspense fallback={<p className="text-[9px] text-aeginel-muted">Loading console...</p>}>
                        <DevConsole />
                      </Suspense>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative flex-shrink-0 rounded-full transition-all duration-300 p-0 border-0 overflow-hidden"
      style={{
        width: '32px', height: '18px',
        ...(checked
          ? { background: '#3fb950', boxShadow: '0 0 6px rgba(63,185,80,0.4)' }
          : { background: '#21262d', border: '1px solid #30363d' }
        ),
      }}
    >
      <span
        className="absolute left-0 top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-300"
        style={{ transform: checked ? 'translateX(15px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-aeginel-text">{label}</p>
        <p className="text-[8px] text-aeginel-muted">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ── AEGIS Server Panel ── */

type KeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

function AegisServerPanel({
  config,
  onUpdate,
}: {
  config: AegisServerConfig;
  onUpdate: (partial: Partial<AegisServerConfig>) => void;
}) {
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [usage, setUsage] = useState<AegisUsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [urlDraft, setUrlDraft] = useState(config.baseUrl);
  const [keyDraft, setKeyDraft] = useState(config.apiKey);
  const [showKey, setShowKey] = useState(false);

  const isKeyValid = keyStatus === 'valid';

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'AEGIS_GET_USAGE' });
      setUsage(res?.payload ?? null);
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const validateKey = useCallback(async () => {
    if (!urlDraft.trim() || !keyDraft.trim()) return;

    setKeyStatus('validating');
    onUpdate({ baseUrl: urlDraft.trim(), apiKey: keyDraft.trim(), enabled: true });

    await new Promise(r => setTimeout(r, 100));

    try {
      const res = await chrome.runtime.sendMessage({ type: 'AEGIS_GET_USAGE' });
      if (res?.payload) {
        setKeyStatus('valid');
        setUsage(res.payload);
      } else {
        setKeyStatus('invalid');
        setUsage(null);
      }
    } catch {
      setKeyStatus('invalid');
      setUsage(null);
    }
  }, [urlDraft, keyDraft, onUpdate]);

  useEffect(() => {
    if (config.enabled && config.baseUrl && config.apiKey && keyStatus === 'idle') {
      setUrlDraft(config.baseUrl);
      setKeyDraft(config.apiKey);
      setKeyStatus('validating');
      chrome.runtime.sendMessage({ type: 'AEGIS_GET_USAGE' }).then(res => {
        if (res?.payload) {
          setKeyStatus('valid');
          setUsage(res.payload);
        } else {
          setKeyStatus('invalid');
        }
      }).catch(() => setKeyStatus('invalid'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onUrlChange = (val: string) => {
    setUrlDraft(val);
    if (keyStatus !== 'idle') setKeyStatus('idle');
    setUsage(null);
  };
  const onKeyChange = (val: string) => {
    setKeyDraft(val);
    if (keyStatus !== 'idle') setKeyStatus('idle');
    setUsage(null);
  };

  const canVerify = urlDraft.trim().length > 0 && keyDraft.trim().length > 0 && keyStatus !== 'validating';

  const statusConfig: Record<KeyStatus, { color: string; label: string }> = {
    idle: { color: '#8b949e', label: '' },
    validating: { color: '#d29922', label: 'Verifying...' },
    valid: { color: '#3fb950', label: 'Verified' },
    invalid: { color: '#f85149', label: 'Invalid' },
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="text-[10px] font-semibold text-aeginel-text">AEGIS Server</span>
        <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', color: '#58a6ff' }}>
          Enterprise
        </span>
        {keyStatus !== 'idle' && (
          <span className="text-[8px] font-medium" style={{ color: statusConfig[keyStatus].color }}>
            {statusConfig[keyStatus].label}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] text-aeginel-muted">
          Connect to AEGIS server for attack defense
        </p>
        <a
          href="https://aiaegis.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[8px] font-medium shrink-0 hover:opacity-80 transition-opacity"
          style={{ color: '#58a6ff' }}
        >
          aiaegis.io
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      <div>
        <p className="text-[10px] font-medium text-aeginel-text mb-1">Server URL</p>
        <input
          type="url"
          value={urlDraft}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://api.aiaegis.io"
          className="w-full bg-aeginel-surface2 rounded-lg px-2.5 py-2 text-[10px] text-aeginel-text focus:outline-none"
          style={{
            border: `1px solid ${keyStatus === 'invalid' ? 'rgba(248,81,73,0.4)' : '#30363d'}`,
          }}
        />
      </div>

      <div>
        <p className="text-[10px] font-medium text-aeginel-text mb-1">API Key</p>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyDraft}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="aegis_sk_..."
            className="w-full bg-aeginel-surface2 rounded-lg px-2.5 py-2 pr-8 text-[10px] text-aeginel-text focus:outline-none"
            style={{
              border: `1px solid ${keyStatus === 'invalid' ? 'rgba(248,81,73,0.4)' : keyStatus === 'valid' ? 'rgba(63,185,80,0.4)' : '#30363d'}`,
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-aeginel-muted hover:text-aeginel-text"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {showKey ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <button
        onClick={validateKey}
        disabled={!canVerify}
        className="w-full text-[10px] py-2 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-40"
        style={
          keyStatus === 'valid'
            ? { background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', color: '#3fb950' }
            : keyStatus === 'invalid'
              ? { background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }
              : { background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.25)', color: '#58a6ff' }
        }
      >
        {keyStatus === 'validating' ? 'Verifying...'
          : keyStatus === 'valid' ? 'Verified — Key is valid'
          : keyStatus === 'invalid' ? 'Invalid key — check URL and key'
          : 'Verify API Key'}
      </button>

      {keyStatus === 'invalid' && (
        <div className="rounded-lg p-2" style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)' }}>
          <p className="text-[9px]" style={{ color: '#f85149' }}>
            Could not authenticate with the AEGIS server. Check that the URL is correct and the API key is valid (format: aegis_sk_...).
          </p>
        </div>
      )}

      {isKeyValid && (
        <>
          <div className="h-px bg-aeginel-border" />

          {usage && <UsageBar usage={usage} loading={usageLoading} onRefresh={fetchUsage} />}

          <div className="h-px bg-aeginel-border" />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-aeginel-text">API Endpoints</p>
              <span className="text-[8px] text-aeginel-muted">
                {[config.endpoints.judge, config.endpoints.jailbreakDetect, config.endpoints.safetyCheck, config.endpoints.classify, config.endpoints.koreanAnalyze].filter(Boolean).length}/5 active
              </span>
            </div>
            <div className="space-y-1.5">
              <ToggleRow
                label="/v1/judge"
                desc="Primary judgment (recommended)"
                checked={config.endpoints.judge}
                onChange={() => onUpdate({
                  endpoints: { ...config.endpoints, judge: !config.endpoints.judge },
                })}
              />
              <ToggleRow
                label="/v2/jailbreak/detect"
                desc="Dedicated jailbreak detection"
                checked={config.endpoints.jailbreakDetect}
                onChange={() => onUpdate({
                  endpoints: { ...config.endpoints, jailbreakDetect: !config.endpoints.jailbreakDetect },
                })}
              />
              <ToggleRow
                label="/v2/safety/check"
                desc="General safety analysis"
                checked={config.endpoints.safetyCheck}
                onChange={() => onUpdate({
                  endpoints: { ...config.endpoints, safetyCheck: !config.endpoints.safetyCheck },
                })}
              />
              <ToggleRow
                label="/v2/classify"
                desc="Content risk classification"
                checked={config.endpoints.classify}
                onChange={() => onUpdate({
                  endpoints: { ...config.endpoints, classify: !config.endpoints.classify },
                })}
              />
              <ToggleRow
                label="/v3/korean/analyze"
                desc="Korean language analysis"
                checked={config.endpoints.koreanAnalyze}
                onChange={() => onUpdate({
                  endpoints: { ...config.endpoints, koreanAnalyze: !config.endpoints.koreanAnalyze },
                })}
              />
            </div>
          </div>

          <div className="h-px bg-aeginel-border" />

          <div className="rounded-lg p-2" style={{ background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)' }}>
            <p className="text-[9px] text-aeginel-muted">
              AEGIS server provides attack defense (jailbreak, injection, etc.). Server verdict is authoritative.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-aeginel-muted">Timeout</span>
            <select
              value={config.timeoutMs}
              onChange={(e) => onUpdate({ timeoutMs: Number(e.target.value) })}
              className="bg-aeginel-surface2 rounded-lg px-2 py-1 text-[10px] text-aeginel-text focus:outline-none"
              style={{ border: '1px solid #30363d' }}
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
            </select>
          </div>

          <button
            onClick={() => {
              onUpdate({ enabled: false, apiKey: '', baseUrl: '' });
              setKeyDraft('');
              setUrlDraft('');
              setKeyStatus('idle');
              setUsage(null);
            }}
            className="w-full text-[10px] py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', color: '#f85149' }}
          >
            Disconnect
          </button>
        </>
      )}
    </>
  );
}

/* ── Usage Bar ── */

function UsageBar({
  usage,
  loading,
  onRefresh,
}: {
  usage: AegisUsageInfo;
  loading: boolean;
  onRefresh: () => void;
}) {
  const pct = usage.percentUsed;
  const isLow = pct >= 80;
  const isCritical = pct >= 95;

  const barColor = isCritical ? '#f85149' : isLow ? '#d29922' : '#3fb950';
  const bgTint = isCritical
    ? 'rgba(248,81,73,0.08)'
    : isLow
      ? 'rgba(210,153,34,0.08)'
      : 'rgba(63,185,80,0.06)';
  const borderTint = isCritical
    ? 'rgba(248,81,73,0.25)'
    : isLow
      ? 'rgba(210,153,34,0.25)'
      : 'rgba(63,185,80,0.15)';

  return (
    <div
      className="rounded-lg p-2.5 space-y-1.5"
      style={{ background: bgTint, border: `1px solid ${borderTint}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-aeginel-text">API Usage</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[8px] text-aeginel-muted hover:text-aeginel-text transition-colors disabled:opacity-40"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-aeginel-muted">
          {usage.used.toLocaleString()} / {usage.allocated.toLocaleString()} calls
        </span>
        <span className="text-[9px] font-semibold" style={{ color: barColor }}>
          {usage.remaining.toLocaleString()} left
        </span>
      </div>

      {usage.byEndpoint.length > 0 && (
        <div className="pt-1 space-y-0.5">
          {usage.byEndpoint.map(({ endpoint, calls }) => (
            <div key={endpoint} className="flex items-center justify-between">
              <span className="text-[8px] text-aeginel-muted truncate">{endpoint}</span>
              <span className="text-[8px] text-aeginel-muted">{calls.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[8px] text-aeginel-muted text-right">
        {usage.period.start.slice(0, 10)} ~ {usage.period.end.slice(0, 10)}
      </div>

      {isCritical && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[9px] font-medium" style={{ color: '#f85149' }}>
            Quota almost exhausted! {usage.overageAllowed ? 'Overage charges may apply.' : 'API calls will be rejected soon.'}
          </span>
        </div>
      )}
      {isLow && !isCritical && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d29922" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[9px] font-medium" style={{ color: '#d29922' }}>
            {100 - pct}% remaining — consider reducing endpoint usage.
          </span>
        </div>
      )}
    </div>
  );
}
