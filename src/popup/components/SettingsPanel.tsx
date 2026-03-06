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
    <div className="bg-aeginel-card rounded-xl border border-aeginel-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold"
      >
        <span>{t('settings.title')}</span>
        <span className="text-aeginel-muted">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* PII Detection */}
          <div className="flex items-center justify-between">
            <span className="text-xs">{t('settings.pii')}</span>
            <Toggle
              checked={config.pii.enabled}
              onChange={() => onUpdate({ pii: { ...config.pii, enabled: !config.pii.enabled } })}
            />
          </div>

          {/* PII Proxy */}
          <div className="space-y-2 border-t border-aeginel-border pt-3">
            <span className="text-xs font-semibold block">{t('proxy.settingsTitle')}</span>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-aeginel-muted">{t('proxy.enabled')}</span>
              <Toggle
                checked={config.piiProxy.enabled}
                onChange={() => onUpdate({ piiProxy: { ...config.piiProxy, enabled: !config.piiProxy.enabled } })}
              />
            </div>
            {config.piiProxy.enabled && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-aeginel-muted">Mode</span>
                  <select
                    value={config.piiProxy.mode}
                    onChange={(e) => onUpdate({ piiProxy: { ...config.piiProxy, mode: e.target.value as 'auto' | 'confirm' } })}
                    className="bg-aeginel-bg border border-aeginel-border rounded px-2 py-1 text-xs text-aeginel-text"
                  >
                    <option value="auto">{t('proxy.modeAuto')}</option>
                    <option value="confirm">{t('proxy.modeConfirm')}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-aeginel-muted">{t('proxy.notification')}</span>
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
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs">{t('settings.threshold')}</span>
              <span className="text-xs text-aeginel-muted">{config.blockThreshold}</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={config.blockThreshold}
              onChange={(e) => onUpdate({ blockThreshold: Number(e.target.value) })}
              className="w-full h-1.5 bg-aeginel-border rounded-lg appearance-none cursor-pointer accent-aeginel-green"
            />
          </div>

          {/* Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs">{t('settings.sensitivity')}</span>
              <span className="text-xs text-aeginel-muted">{config.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.sensitivity}
              onChange={(e) => onUpdate({ sensitivity: Number(e.target.value) })}
              className="w-full h-1.5 bg-aeginel-border rounded-lg appearance-none cursor-pointer accent-aeginel-green"
            />
          </div>

          {/* Layer Toggles */}
          <div>
            <span className="text-xs font-semibold block mb-2">{t('settings.layers')}</span>
            <div className="space-y-1.5">
              {LAYER_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-aeginel-muted">{t(`settings.layerNames.${key}`)}</span>
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
            <span className="text-xs">{t('settings.language')}</span>
            <select
              value={config.language}
              onChange={(e) => onUpdate({ language: e.target.value })}
              className="bg-aeginel-bg border border-aeginel-border rounded px-2 py-1 text-xs text-aeginel-text"
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
            className="w-full text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
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
      className={`relative w-8 h-4 rounded-full transition-colors ${checked ? 'bg-aeginel-green' : 'bg-gray-600'}`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
