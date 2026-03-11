'use client';

import { useEffect, useState } from 'react';
import { Users, Monitor, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  lastSeenAt: string;
  policyApplied: boolean;
  policyVersion: number | null;
  createdAt: string;
}

export default function UsersPage() {
  const [orgId, setOrgId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.orgId) setOrgId(d.session.orgId);
        else window.location.href = '/login';
      });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/devices/${orgId}`)
      .then((r) => r.json())
      .then(setDevices);
  }, [orgId]);

  const isOnline = (lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 15 * 60 * 1000; // 15 minutes
  };

  const formatLastSeen = (lastSeen: string) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  const onlineCount = devices.filter((d) => isOnline(d.lastSeenAt)).length;
  const policyAppliedCount = devices.filter((d) => d.policyApplied).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">사용자 관리</h1>
        <p className="mt-1 text-sm text-zinc-500">
          조직 내 디바이스 및 사용자 현황을 관리합니다
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-zinc-500">
            <Users className="h-4 w-4" />
            <p className="text-sm">총 디바이스</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900">
            {devices.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-emerald-500">
            <Monitor className="h-4 w-4" />
            <p className="text-sm">온라인</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {onlineCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-2 text-indigo-500">
            <CheckCircle className="h-4 w-4" />
            <p className="text-sm">정책 적용됨</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            {policyAppliedCount}
          </p>
        </div>
      </div>

      {/* 디바이스 테이블 */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  디바이스
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  마지막 활동
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  정책 적용
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  정책 버전
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  등록일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {devices.map((device) => {
                const online = isOnline(device.lastSeenAt);

                return (
                  <tr
                    key={device.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            online ? 'bg-emerald-500' : 'bg-zinc-300'
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            online ? 'text-emerald-600' : 'text-zinc-400'
                          )}
                        >
                          {online ? '온라인' : '오프라인'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-700">
                      {device.deviceId}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {device.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-zinc-600">
                        <Clock className="h-3.5 w-3.5" />
                        {formatLastSeen(device.lastSeenAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {device.policyApplied ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-zinc-300" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {device.policyVersion ? `v${device.policyVersion}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {new Date(device.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                );
              })}
              {devices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-zinc-400"
                  >
                    <Users className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    등록된 디바이스가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
