import React from 'react';
import type { AeginelConfig } from '../../engine/types';
import { t, LANGUAGE_OPTIONS } from '../../i18n';

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

export default function SettingsPanel({ config, onUpdate, onClearHistory }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleLayer = (key: keyof AeginelConfig['layers']) => {
    onUpdate({ layers: { ...config.layers, [key]: !config.layers[key] } });
  };

  return (
    <div className="rounded-lg border border-aeginel-border bg-aeginel-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold"
      >
        <span>{t('settings.title')}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`text-aeginel-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3 border-t border-aeginel-border">
          {/* PII Detection */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px]">{t('settings.pii')}</span>
            <Toggle
              checked={config.pii.enabled}
              onChange={() => onUpdate({ pii: { ...config.pii, enabled: !config.pii.enabled } })}
            />
          </div>

          {/* PII Proxy */}
          <div className="space-y-1.5 border-t border-aeginel-border pt-2">
            <span className="text-[11px] font-semibold block">{t('proxy.settingsTitle')}</span>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-aeginel-muted">{t('proxy.enabled')}</span>
              <Toggle
                checked={config.piiProxy.enabled}
                onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, enabled: !config.piiProxy.enabled } })}
              />
            </div>
            {config.piiProxy.enabled && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-aeginel-muted">Mode</span>
                  <select
                    value={config.piiProxy.mode}
                    onChange={(e) => onUpdate({ piiProxy: { ...config.piiProxy, mode: e.target.value as 'auto' | 'confirm' } })}
                    className="bg-white border border-aeginel-border rounded px-1.5 py-0.5 text-[10px] text-aeginel-text"
                  >
                    <option value="auto">{t('proxy.modeAuto')}</option>
                    <option value="confirm">{t('proxy.modeConfirm')}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-aeginel-muted">{t('proxy.notification')}</span>
                  <Toggle
                    checked={config.piiProxy.showNotification}
                    onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, showNotification: !config.piiProxy.showNotification } })}
                  />
                </div>
              </>
            )}
          </div>

          {/* Block Threshold */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px]">{t('settings.threshold')}</span>
              <span className="text-[10px] text-aeginel-muted font-medium">{config.blockThreshold}</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={config.blockThreshold}
              onChange={(e) => onUpdate({ blockThreshold: Number(e.target.value) })}
              className="w-full h-1 bg-aeginel-border rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px]">{t('settings.sensitivity')}</span>
              <span className="text-[10px] text-aeginel-muted font-medium">{config.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.sensitivity}
              onChange={(e) => onUpdate({ sensitivity: Number(e.target.value) })}
              className="w-full h-1 bg-aeginel-border rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Layer Toggles */}
          <div>
            <span className="text-[11px] font-semibold block mb-1">{t('settings.layers')}</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {LAYER_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[10px] text-aeginel-muted truncate mr-1">{t(`settings.layerNames.${key}`)}</span>
                  <Toggle
                    checked={config.layers[key]}
                    onChange={() => toggleLayer(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="text-[11px]">{t('settings.language')}</span>
            <select
              value={config.language}
              onChange={(e) => onUpdate({ language: e.target.value })}
              className="bg-white border border-aeginel-border rounded px-1.5 py-0.5 text-[10px] text-aeginel-text"
            >
              <option value="auto">{t('settings.auto')}</option>
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Clear History */}
          <button
            onClick={onClearHistory}
            className="w-full text-[11px] py-1.5 rounded-md bg-red-50 text-aeginel-red border border-red-200 hover:bg-red-100 transition-colors"
          >
            {t('settings.clear')}
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-7 h-3.5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-aeginel-green' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-[14px]' : 'left-0.5'}`} />
    </button>
  );
}
