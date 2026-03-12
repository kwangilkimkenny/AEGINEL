'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Save,
  RotateCcw,
  Plus,
  X,
  History,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Policy {
  id: string;
  version: number;
  forceDisabled: boolean;
  blockThreshold: number;
  sensitivity: number;
  enforcedLayers: string[];
  blockedSites: string[];
  mandatoryPiiSites: string[];
  customKeywords: string[];
  minPiiProxyMode: string;
  reportTelemetry: boolean;
  isActive: boolean;
  createdAt: string;
}

const LAYER_OPTIONS = [
  { id: 'jailbreak', label: 'Jailbreak 탐지' },
  { id: 'injection', label: 'Prompt Injection 탐지' },
  { id: 'pii_leak', label: 'PII 유출 탐지' },
  { id: 'data_exfiltration', label: '데이터 유출 탐지' },
  { id: 'social_engineering', label: '소셜 엔지니어링 탐지' },
];

export default function PoliciesPage() {
  const [orgId, setOrgId] = useState('');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<Policy[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newBlockedSite, setNewBlockedSite] = useState('');
  const [newPiiSite, setNewPiiSite] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.orgId) setOrgId(d.session.orgId);
        else window.location.href = '/login';
      });
  }, []);

  const loadPolicy = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/policy/${orgId}`)
      .then((r) => r.json())
      .then(setPolicy);
  }, [orgId]);

  const loadVersions = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/policy/${orgId}/versions`)
      .then((r) => r.json())
      .then(setVersions);
  }, [orgId]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/policy/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceDisabled: policy.forceDisabled,
          blockThreshold: policy.blockThreshold,
          sensitivity: policy.sensitivity,
          enforcedLayers: policy.enforcedLayers,
          blockedSites: policy.blockedSites,
          mandatoryPiiSites: policy.mandatoryPiiSites,
          customKeywords: policy.customKeywords,
          minPiiProxyMode: policy.minPiiProxyMode,
          reportTelemetry: policy.reportTelemetry,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPolicy(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    const res = await fetch(`/api/policy/${orgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetVersion }),
    });
    if (res.ok) {
      const rolled = await res.json();
      setPolicy(rolled);
      setShowVersions(false);
      loadVersions();
    }
  };

  const toggleLayer = (layerId: string) => {
    if (!policy) return;
    const current = policy.enforcedLayers;
    setPolicy({
      ...policy,
      enforcedLayers: current.includes(layerId)
        ? current.filter((l) => l !== layerId)
        : [...current, layerId],
    });
  };

  const addToList = (
    field: 'customKeywords' | 'blockedSites' | 'mandatoryPiiSites',
    value: string,
    setter: (v: string) => void
  ) => {
    if (!policy || !value.trim()) return;
    if (!policy[field].includes(value.trim())) {
      setPolicy({ ...policy, [field]: [...policy[field], value.trim()] });
    }
    setter('');
  };

  const removeFromList = (
    field: 'customKeywords' | 'blockedSites' | 'mandatoryPiiSites',
    value: string
  ) => {
    if (!policy) return;
    setPolicy({ ...policy, [field]: policy[field].filter((v) => v !== value) });
  };

  if (!policy) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">정책 관리</h1>
          <p className="mt-1 text-sm text-zinc-500">
            조직의 AI 보안 정책을 설정하고 관리합니다 (v{policy.version})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadVersions();
              setShowVersions(!showVersions);
            }}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <History className="h-4 w-4" />
            버전 이력
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? '저장됨!' : '정책 저장'}
          </button>
        </div>
      </div>

      {showVersions && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">
            정책 버전 이력
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3',
                  v.isActive
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-zinc-200'
                )}
              >
                <div>
                  <span className="text-sm font-medium text-zinc-900">
                    v{v.version}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {new Date(v.createdAt).toLocaleString('ko-KR')}
                  </span>
                  {v.isActive && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      현재 적용중
                    </span>
                  )}
                </div>
                {!v.isActive && (
                  <button
                    onClick={() => handleRollback(v.version)}
                    className="flex items-center gap-1 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    롤백
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {policy.forceDisabled && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">
              킬스위치 활성화됨
            </p>
            <p className="text-xs text-red-600">
              모든 사용자의 확장 프로그램이 비활성화됩니다.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 기본 설정 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Shield className="h-4 w-4 text-emerald-500" />
            기본 설정
          </h3>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              차단 임계값 (blockThreshold)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={policy.blockThreshold}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    blockThreshold: Number(e.target.value),
                  })
                }
                className="flex-1 accent-emerald-500"
              />
              <span className="w-10 text-right text-sm font-mono font-medium text-zinc-900">
                {policy.blockThreshold}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              이 점수 이상일 때 사용자 요청을 차단합니다.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              감도 (sensitivity)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={policy.sensitivity}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    sensitivity: Number(e.target.value),
                  })
                }
                className="flex-1 accent-emerald-500"
              />
              <span className="w-10 text-right text-sm font-mono font-medium text-zinc-900">
                {policy.sensitivity.toFixed(1)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              PII 프록시 모드
            </label>
            <select
              value={policy.minPiiProxyMode}
              onChange={(e) =>
                setPolicy({ ...policy, minPiiProxyMode: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="auto">자동 (auto)</option>
              <option value="confirm">확인 필요 (confirm)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700">
                텔레메트리 전송
              </p>
              <p className="text-xs text-zinc-400">
                스캔 메타데이터를 서버로 전송
              </p>
            </div>
            <button
              onClick={() =>
                setPolicy({
                  ...policy,
                  reportTelemetry: !policy.reportTelemetry,
                })
              }
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                policy.reportTelemetry ? 'bg-emerald-500' : 'bg-zinc-300'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  policy.reportTelemetry ? 'left-5.5' : 'left-0.5'
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">
                전사 킬스위치 (forceDisabled)
              </p>
              <p className="text-xs text-zinc-400">
                모든 사용자의 확장 비활성화
              </p>
            </div>
            <button
              onClick={() =>
                setPolicy({
                  ...policy,
                  forceDisabled: !policy.forceDisabled,
                })
              }
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                policy.forceDisabled ? 'bg-red-500' : 'bg-zinc-300'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  policy.forceDisabled ? 'left-5.5' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </div>

        {/* 강제 레이어 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
          <h3 className="text-sm font-semibold text-zinc-900">
            강제 적용 레이어 (enforcedLayers)
          </h3>
          <p className="text-xs text-zinc-400">
            사용자가 비활성화할 수 없는 탐지 레이어를 선택합니다.
          </p>
          <div className="space-y-3">
            {LAYER_OPTIONS.map((layer) => (
              <label
                key={layer.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={policy.enforcedLayers.includes(layer.id)}
                  onChange={() => toggleLayer(layer.id)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-500 accent-emerald-500"
                />
                <span className="text-sm text-zinc-700">{layer.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 커스텀 키워드 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          커스텀 차단 키워드 (customKeywords)
        </h3>
        <p className="text-xs text-zinc-400">
          회사 고유 차단 키워드를 추가합니다. Layer 1에 반영됩니다.
        </p>
        <div className="flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              addToList('customKeywords', newKeyword, setNewKeyword)
            }
            placeholder="키워드 입력 후 Enter"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={() =>
              addToList('customKeywords', newKeyword, setNewKeyword)
            }
            className="flex items-center gap-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {policy.customKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700 border border-amber-200"
            >
              {kw}
              <button
                onClick={() => removeFromList('customKeywords', kw)}
                className="ml-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {policy.customKeywords.length === 0 && (
            <p className="text-xs text-zinc-400">등록된 키워드가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 차단 사이트 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          차단 사이트 (blockedSites)
        </h3>
        <p className="text-xs text-zinc-400">
          Aegis Personal이 완전히 비활성화되거나 차단되는 사이트입니다.
        </p>
        <div className="flex gap-2">
          <input
            value={newBlockedSite}
            onChange={(e) => setNewBlockedSite(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              addToList('blockedSites', newBlockedSite, setNewBlockedSite)
            }
            placeholder="character.ai"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={() =>
              addToList('blockedSites', newBlockedSite, setNewBlockedSite)
            }
            className="flex items-center gap-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {policy.blockedSites.map((site) => (
            <span
              key={site}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700 border border-red-200"
            >
              {site}
              <button
                onClick={() => removeFromList('blockedSites', site)}
                className="ml-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {policy.blockedSites.length === 0 && (
            <p className="text-xs text-zinc-400">
              차단된 사이트가 없습니다.
            </p>
          )}
        </div>
      </div>

      {/* PII 강제 사이트 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          PII 프록시 강제 사이트 (mandatoryPiiSites)
        </h3>
        <p className="text-xs text-zinc-400">
          PII 프록시가 항상 활성화되는 사이트입니다.
        </p>
        <div className="flex gap-2">
          <input
            value={newPiiSite}
            onChange={(e) => setNewPiiSite(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              addToList('mandatoryPiiSites', newPiiSite, setNewPiiSite)
            }
            placeholder="chatgpt.com"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={() =>
              addToList('mandatoryPiiSites', newPiiSite, setNewPiiSite)
            }
            className="flex items-center gap-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {policy.mandatoryPiiSites.map((site) => (
            <span
              key={site}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 border border-indigo-200"
            >
              {site}
              <button
                onClick={() => removeFromList('mandatoryPiiSites', site)}
                className="ml-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {policy.mandatoryPiiSites.length === 0 && (
            <p className="text-xs text-zinc-400">
              PII 강제 사이트가 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
