'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, Eye, AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import StatCard from '@/components/stat-card';

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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

const CATEGORY_LABELS: Record<string, string> = {
  jailbreak: 'Jailbreak',
  injection: 'Prompt Injection',
  pii_leak: 'PII 유출',
  data_exfiltration: '데이터 유출',
  social_engineering: '소셜 엔지니어링',
};

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [orgId, setOrgId] = useState('');
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.orgId) setOrgId(d.session.orgId);
        else window.location.href = '/login';
      })
      .catch(() => (window.location.href = '/login'));
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

  const siteData = Object.entries(data.siteBreakdown).map(([site, info]) => ({
    name: site,
    total: info.total,
    blocked: info.blocked,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">대시보드</h1>
          <p className="mt-1 text-sm text-zinc-500">
            전사 AI 보안 현황을 한눈에 확인하세요
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="24h">최근 24시간</option>
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="90d">최근 90일</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="총 스캔 수"
          value={data.summary.totalScans.toLocaleString()}
          icon={Shield}
          variant="default"
        />
        <StatCard
          title="차단된 요청"
          value={data.summary.blockedScans.toLocaleString()}
          icon={ShieldAlert}
          variant="danger"
          subtitle={`${data.summary.totalScans > 0 ? ((data.summary.blockedScans / data.summary.totalScans) * 100).toFixed(1) : 0}% 차단률`}
        />
        <StatCard
          title="PII 보호 건수"
          value={data.summary.piiProtected.toLocaleString()}
          icon={Eye}
          variant="success"
        />
        <StatCard
          title="Override 건수"
          value={data.summary.overrides.toLocaleString()}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">
            일별 스캔 현황
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyStats}>
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
              <Bar
                dataKey="scans"
                name="스캔"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="blocked"
                name="차단"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">
            위협 카테고리 Top 5
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.topCategories}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
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
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {data.topCategories.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs text-zinc-600">
                    {CATEGORY_LABELS[cat.name] || cat.name}
                  </span>
                </div>
                <span className="text-xs font-medium text-zinc-900">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">
          사이트별 위협 현황
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={siteData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#71717a' }}
              width={150}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="total"
              name="전체"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="blocked"
              name="차단"
              fill="#ef4444"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
