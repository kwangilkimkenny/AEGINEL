'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Globe, Tag } from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalScans: number;
    blockedScans: number;
    piiProtected: number;
    overrides: number;
  };
  dailyStats: { date: string; scans: number; blocked: number; pii: number }[];
  topCategories: { name: string; count: number }[];
  siteBreakdown: Record<
    string,
    { total: number; blocked: number; categories: Record<string, number> }
  >;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'];

const CATEGORY_LABELS: Record<string, string> = {
  jailbreak: 'Jailbreak',
  injection: 'Prompt Injection',
  pii_leak: 'PII 유출',
  data_exfiltration: '데이터 유출',
  social_engineering: '소셜 엔지니어링',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [orgId, setOrgId] = useState('');
  const [period, setPeriod] = useState('30d');

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
    fetch(`/api/analytics/${orgId}?period=${period}`)
      .then((r) => r.json())
      .then(setData);
  }, [orgId, period]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const siteData = Object.entries(data.siteBreakdown)
    .map(([site, info]) => ({
      name: site,
      total: info.total,
      blocked: info.blocked,
      safe: info.total - info.blocked,
    }))
    .sort((a, b) => b.total - a.total);

  const siteCategoryData = Object.entries(data.siteBreakdown).map(
    ([site, info]) => ({
      name: site,
      ...Object.fromEntries(
        Object.entries(info.categories).map(([k, v]) => [
          CATEGORY_LABELS[k] || k,
          v,
        ])
      ),
    })
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">분석</h1>
          <p className="mt-1 text-sm text-zinc-500">
            전사 스캔 통계 및 위협 분석
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none"
        >
          <option value="24h">최근 24시간</option>
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="90d">최근 90일</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">총 스캔</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">
            {data.summary.totalScans.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">차단</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {data.summary.blockedScans.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">PII 보호</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {data.summary.piiProtected.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Override</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {data.summary.overrides.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 기간별 스캔 추이 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-zinc-900">
            기간별 스캔 추이
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data.dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="scans"
              name="총 스캔"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="blocked"
              name="차단"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="pii"
              name="PII 탐지"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 사이트별 현황 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-zinc-900">
              사이트별 위협 분포
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={siteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#71717a' }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Bar
                dataKey="safe"
                name="안전"
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="blocked"
                name="차단"
                stackId="a"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 카테고리별 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-zinc-900">
              위협 카테고리 Top 5
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.topCategories}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${CATEGORY_LABELS[name ?? ''] || name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.topCategories.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  value,
                  CATEGORY_LABELS[String(name)] || name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {data.topCategories.map((cat, i) => (
              <div
                key={cat.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm text-zinc-600">
                    {CATEGORY_LABELS[cat.name] || cat.name}
                  </span>
                </div>
                <span className="text-sm font-medium text-zinc-900">
                  {cat.count}건
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 사이트별 카테고리 분포 */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">
          사이트별 카테고리 분포
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={siteCategoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            {Object.values(CATEGORY_LABELS).map((label, i) => (
              <Bar
                key={label}
                dataKey={label}
                stackId="a"
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
