import React, { useState } from 'react';
import type { AeginelConfig } from '../../engine/types';
import { LANGUAGE_OPTIONS } from '../../i18n';

interface Props {
  config: AeginelConfig;
  onUpdate: (partial: Partial<AeginelConfig>) => void;
  onClearHistory: () => void;
}

const LAYER_KEYS: (keyof AeginelConfig['layers'])[] = [
  'basicKeywords', 'jailbreak', 'injection', 'extraction',
  'socialEngineering', 'koreanEvasion', 'encodingAttacks',
  'multiTurn', 'semanticRisk',
];

const LAYER_LABELS: Record<string, string> = {
  basicKeywords:    'Keywords',
  jailbreak:        'Jailbreak',
  injection:        'Injection',
  extraction:       'Extraction',
  socialEngineering:'Social Eng.',
  koreanEvasion:    'CJK Evasion',
  encodingAttacks:  'Encoding',
  multiTurn:        'Multi-turn',
  semanticRisk:     'Semantic',
};

type Tab = 'detection' | 'privacy' | 'advanced';
const TABS: { key: Tab; label: string }[] = [
  { key: 'detection', label: 'Detection' },
  { key: 'privacy',   label: 'Privacy' },
  { key: 'advanced',  label: 'Advanced' },
];

export default function SettingsPanel({ config, onUpdate, onClearHistory }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('detection');

  const toggleLayer = (key: keyof AeginelConfig['layers']) => {
    onUpdate({ layers: { ...config.layers, [key]: !config.layers[key] } });
  };

  const activeLayerCount = Object.values(config.layers).filter(Boolean).length;

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
          <span className="text-[9px] text-aeginel-muted">{activeLayerCount}/9 layers</span>
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
            {/* ── DETECTION TAB ── */}
            {activeTab === 'detection' && (
              <>
                {/* Layer toggles as chip grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-aeginel-text">Detection Layers</span>
                    <span className="text-[9px] text-aeginel-muted">{activeLayerCount} active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {LAYER_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => toggleLayer(key)}
                        className="text-[9px] px-2 py-1.5 rounded-lg border font-medium transition-all text-left truncate"
                        style={config.layers[key]
                          ? { background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', color: '#3fb950' }
                          : { background: '#21262d', border: '1px solid #30363d', color: '#8b949e' }
                        }
                      >
                        {LAYER_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-aeginel-border" />

                {/* Block Threshold */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-[10px] font-medium text-aeginel-text">Block Threshold</p>
                      <p className="text-[8px] text-aeginel-muted">Score ≥ this value gets blocked</p>
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

                {/* Sensitivity */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-[10px] font-medium text-aeginel-text">Sensitivity</p>
                      <p className="text-[8px] text-aeginel-muted">Score multiplier</p>
                    </div>
                    <span
                      className="text-[13px] font-bold number-hero"
                      style={{ color: '#3fb950' }}
                    >
                      {config.sensitivity.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={config.sensitivity}
                    onChange={(e) => onUpdate({ sensitivity: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

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
              </>
            )}

            {/* ── ADVANCED TAB ── */}
            {activeTab === 'advanced' && (
              <>
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
