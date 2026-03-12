'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Loader2, Shield, Eye, AlertTriangle } from 'lucide-react';

interface ReportData {
  period: { from: string; to: string };
  summary: {
    totalScans: number;
    blockedScans: number;
    blockRate: string;
    piiProtectedCount: number;
    piiDetectionEvents: number;
    overrideCount: number;
    activeDevices: number;
  };
  policyStatus: {
    version: number;
    blockThreshold: number;
    enforcedLayers: string[];
    forceDisabled: boolean;
    reportTelemetry: boolean;
  } | null;
  categoryBreakdown: { name: string; count: number }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  jailbreak: 'Jailbreak',
  injection: 'Prompt Injection',
  pii_leak: 'PII 유출',
  data_exfiltration: '데이터 유출',
  social_engineering: '소셜 엔지니어링',
};

export default function ReportsPage() {
  const [orgId, setOrgId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.orgId) setOrgId(d.session.orgId);
        else window.location.href = '/login';
      });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    setTo(now.toISOString().split('T')[0]);
    setFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const generateReport = async () => {
    if (!orgId || !from || !to) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/${orgId}?from=${from}&to=${to}`
      );
      const data = await res.json();
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!report) return;

    const lines = [
      'Aegis Personal Compliance Report',
      `기간: ${from} ~ ${to}`,
      '',
      '=== 요약 ===',
      `총 스캔 수,${report.summary.totalScans}`,
      `차단된 요청,${report.summary.blockedScans}`,
      `차단률,${report.summary.blockRate}%`,
      `PII 보호 건수,${report.summary.piiProtectedCount}`,
      `PII 탐지 이벤트,${report.summary.piiDetectionEvents}`,
      `Override 건수,${report.summary.overrideCount}`,
      `활성 디바이스,${report.summary.activeDevices}`,
      '',
      '=== 정책 현황 ===',
      `정책 버전,${report.policyStatus?.version ?? 'N/A'}`,
      `차단 임계값,${report.policyStatus?.blockThreshold ?? 'N/A'}`,
      `강제 레이어,${report.policyStatus?.enforcedLayers?.join('; ') ?? 'N/A'}`,
      '',
      '=== 카테고리별 위협 ===',
      'Category,Count',
      ...report.categoryBreakdown.map(
        (c) => `${CATEGORY_LABELS[c.name] || c.name},${c.count}`
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeginel-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">컴플라이언스 리포트</h1>
        <p className="mt-1 text-sm text-zinc-500">
          GDPR/CCPA/개인정보보호법 리포트를 생성합니다
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            시작일
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            종료일
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          리포트 생성
        </button>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              리포트 결과 ({from} ~ {to})
            </h2>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              CSV 다운로드
            </button>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 text-zinc-500">
                <Shield className="h-4 w-4" />
                <p className="text-sm">총 스캔</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900">
                {report.summary.totalScans.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">차단</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {report.summary.blockedScans.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                차단률: {report.summary.blockRate}%
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 text-emerald-500">
                <Eye className="h-4 w-4" />
                <p className="text-sm">PII 보호</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {report.summary.piiProtectedCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {report.summary.piiDetectionEvents}건의 탐지 이벤트
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">활성 디바이스</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900">
                {report.summary.activeDevices}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Override: {report.summary.overrideCount}건
              </p>
            </div>
          </div>

          {/* 정책 현황 */}
          {report.policyStatus && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                정책 적용 현황
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-zinc-500">정책 버전</p>
                  <p className="text-sm font-medium text-zinc-900">
                    v{report.policyStatus.version}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">차단 임계값</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {report.policyStatus.blockThreshold}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">강제 레이어</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {report.policyStatus.enforcedLayers.join(', ') || '없음'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">텔레메트리</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {report.policyStatus.reportTelemetry ? '활성' : '비활성'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 카테고리별 위협 */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900">
              카테고리별 위협 건수
            </h3>
            <div className="space-y-3">
              {report.categoryBreakdown.map((cat) => {
                const maxCount = report.categoryBreakdown[0]?.count || 1;
                const pct = (cat.count / maxCount) * 100;

                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-700">
                        {CATEGORY_LABELS[cat.name] || cat.name}
                      </span>
                      <span className="text-sm font-medium text-zinc-900">
                        {cat.count}건
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {report.categoryBreakdown.length === 0 && (
                <p className="text-sm text-zinc-400">
                  해당 기간의 위협 데이터가 없습니다.
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-zinc-400 text-center italic">
            본 리포트에는 원본 프롬프트 텍스트가 포함되지 않습니다. 메타데이터만 수집 및 분석됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
