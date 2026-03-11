'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldOff,
  Repeat,
  Eye,
  Settings,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  deviceId: string;
  timestamp: string;
  type: string;
  details: Record<string, unknown>;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Shield }
> = {
  scan: {
    label: '스캔',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: Search,
  },
  block: {
    label: '차단',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: Shield,
  },
  override: {
    label: 'Override',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: ShieldOff,
  },
  pii_mask: {
    label: 'PII 마스킹',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: Eye,
  },
  config_change: {
    label: '설정 변경',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
    icon: Settings,
  },
};

export default function AuditPage() {
  const [orgId, setOrgId] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const limit = 20;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.orgId) setOrgId(d.session.orgId);
        else window.location.href = '/login';
      });
  }, []);

  const loadEvents = useCallback(() => {
    if (!orgId) return;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    fetch(`/api/audit/${orgId}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events);
        setTotal(data.total);
      });
  }, [orgId, page, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">감사 로그</h1>
        <p className="mt-1 text-sm text-zinc-500">
          보안 이벤트 및 설정 변경 이력을 조회합니다
        </p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600">필터</span>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            이벤트 유형
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="scan">스캔</option>
            <option value="block">차단</option>
            <option value="override">Override</option>
            <option value="pii_mask">PII 마스킹</option>
            <option value="config_change">설정 변경</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">시작일</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">종료일</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <p className="text-xs text-zinc-400">총 {total}건</p>
      </div>

      {/* 이벤트 목록 */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  유형
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  디바이스
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  사이트
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {events.map((event) => {
                const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.scan;
                const Icon = config.icon;
                const details = event.details || {};

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-zinc-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                          config.bg,
                          config.color
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {new Date(event.timestamp).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 font-mono">
                      {event.deviceId}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {(details.site as string) || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {(details.category as string) || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-emerald-600 hover:text-emerald-500 cursor-pointer">
                        상세 보기
                      </button>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-zinc-400"
                  >
                    <ScrollText className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    감사 이벤트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-500">
              {(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}건
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-zinc-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900">
                이벤트 상세
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">유형</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {TYPE_CONFIG[selectedEvent.type]?.label || selectedEvent.type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">시간</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {new Date(selectedEvent.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">디바이스</p>
                  <p className="text-sm font-medium font-mono text-zinc-900">
                    {selectedEvent.deviceId}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-zinc-500">상세 정보</p>
                <pre className="rounded-lg bg-zinc-50 p-4 text-xs text-zinc-700 overflow-x-auto">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
              <p className="text-[10px] text-zinc-400 italic">
                * 원본 프롬프트 텍스트는 수집되지 않습니다 — 메타데이터만 기록됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
