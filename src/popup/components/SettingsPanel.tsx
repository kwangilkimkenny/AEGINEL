import React from 'react';
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
  basicKeywords: 'Keywords',
  jailbreak: 'Jailbreak',
  injection: 'Injection',
  extraction: 'Extraction',
  socialEngineering: 'Social Eng.',
  koreanEvasion: 'CJK Evasion',
  encodingAttacks: 'Encoding',
  multiTurn: 'Multi-turn',
  semanticRisk: 'Semantic',
};

export default function SettingsPanel({ config, onUpdate, onClearHistory }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [allowlistOpen, setAllowlistOpen] = React.useState(false);

  const toggleLayer = (key: keyof AeginelConfig['layers']) => {
    onUpdate({ layers: { ...config.layers, [key]: !config.layers[key] } });
  };

  return (
    <div className="rounded-md border border-aeginel-border bg-aeginel-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold"
      >
        <span>Settings</span>
        <svg
          width="8" height="8" viewBox="0 0 10 10"
          className={`text-aeginel-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="px-2 pb-2 space-y-2 border-t border-aeginel-border">
          {/* PII Detection */}
          <div className="flex items-center justify-between pt-1.5">
            <span className="text-[10px]">PII Detection</span>
            <Toggle
              checked={config.pii.enabled}
              onChange={() => onUpdate({ pii: { ...config.pii, enabled: !config.pii.enabled } })}
            />
          </div>

          {/* PII Proxy */}
          <div className="space-y-1 border-t border-aeginel-border pt-1.5">
            <span className="text-[10px] font-semibold block">PII Proxy</span>
            <Row label="Auto Pseudonymize">
              <Toggle
                checked={config.piiProxy.enabled}
                onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, enabled: !config.piiProxy.enabled } })}
              />
            </Row>
            {config.piiProxy.enabled && (
              <>
                <Row label="Mode">
                  <select
                    value={config.piiProxy.mode}
                    onChange={(e) => onUpdate({ piiProxy: { ...config.piiProxy, mode: e.target.value as 'auto' | 'confirm' } })}
                    className="bg-white border border-aeginel-border rounded px-1 py-px text-[9px] text-aeginel-text"
                  >
                    <option value="auto">Auto</option>
                    <option value="confirm">Confirm</option>
                  </select>
                </Row>
                <Row label="Notification">
                  <Toggle
                    checked={config.piiProxy.showNotification}
                    onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, showNotification: !config.piiProxy.showNotification } })}
                  />
                </Row>
              </>
            )}
          </div>

          {/* Block Threshold */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]">Block Threshold</span>
              <span className="text-[9px] text-aeginel-muted font-medium">{config.blockThreshold}</span>
            </div>
            <input type="range" min="20" max="100" step="5" value={config.blockThreshold}
              onChange={(e) => onUpdate({ blockThreshold: Number(e.target.value) })}
              className="w-full h-1 bg-aeginel-border rounded-lg appearance-none cursor-pointer mt-0.5"
            />
          </div>

          {/* Sensitivity */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]">Sensitivity</span>
              <span className="text-[9px] text-aeginel-muted font-medium">{config.sensitivity.toFixed(1)}x</span>
            </div>
            <input type="range" min="0.5" max="2.0" step="0.1" value={config.sensitivity}
              onChange={(e) => onUpdate({ sensitivity: Number(e.target.value) })}
              className="w-full h-1 bg-aeginel-border rounded-lg appearance-none cursor-pointer mt-0.5"
            />
          </div>

          {/* Layer Toggles */}
          <div>
            <span className="text-[10px] font-semibold block mb-0.5">Detection Layers</span>
            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
              {LAYER_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[9px] text-aeginel-muted truncate mr-0.5">{LAYER_LABELS[key]}</span>
                  <Toggle checked={config.layers[key]} onChange={() => toggleLayer(key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="text-[10px]">Language</span>
            <select
              value={config.language}
              onChange={(e) => onUpdate({ language: e.target.value })}
              className="bg-white border border-aeginel-border rounded px-1 py-px text-[9px] text-aeginel-text"
            >
              <option value="auto">Auto</option>
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Allowed Sites */}
          <div className="border-t border-aeginel-border pt-1.5">
            <button
              onClick={() => setAllowlistOpen(!allowlistOpen)}
              className="flex items-center justify-between w-full"
            >
              <span className="text-[10px] font-semibold">Allowed Sites</span>
              <svg
                width="8" height="8" viewBox="0 0 10 10"
                className={`text-aeginel-muted transition-transform ${allowlistOpen ? 'rotate-180' : ''}`}
              >
                <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {allowlistOpen && (
              <div className="mt-1">
                <p className="text-[8px] text-aeginel-muted mb-0.5">One domain per line. These sites will be skipped.</p>
                <textarea
                  value={(config.allowlist ?? []).join('\n')}
                  onChange={(e) => {
                    const domains = e.target.value.split('\n').map((d) => d.trim()).filter(Boolean);
                    onUpdate({ allowlist: domains });
                  }}
                  placeholder="example.com&#10;mysite.org"
                  rows={3}
                  className="w-full bg-white border border-aeginel-border rounded px-1.5 py-1 text-[9px] text-aeginel-text resize-none focus:outline-none focus:ring-1 focus:ring-aeginel-green"
                />
              </div>
            )}
          </div>

          {/* Clear */}
          <button
            onClick={onClearHistory}
            className="w-full text-[10px] py-1 rounded bg-red-50 text-aeginel-red border border-red-200 hover:bg-red-100 transition-colors"
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-aeginel-muted">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-6 h-3 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-aeginel-green' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-px w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-[12px]' : 'left-px'}`} />
    </button>
  );
}
