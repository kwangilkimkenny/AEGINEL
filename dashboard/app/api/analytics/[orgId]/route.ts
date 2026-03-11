import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const session = await getSession();

  if (!session || session.orgId !== orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const period = searchParams.get('period') || '7d';

  let startDate: Date;
  const endDate = to ? new Date(to) : new Date();

  if (from) {
    startDate = new Date(from);
  } else {
    startDate = new Date();
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
  }

  const dateFilter = {
    orgId,
    timestamp: { gte: startDate, lte: endDate },
  };

  const [
    totalScans,
    blockedScans,
    piiProtected,
    telemetryData,
    auditOverrides,
  ] = await Promise.all([
    prisma.scanTelemetry.count({ where: dateFilter }),
    prisma.scanTelemetry.count({ where: { ...dateFilter, blocked: true } }),
    prisma.scanTelemetry.aggregate({
      where: { ...dateFilter, piiCount: { gt: 0 } },
      _sum: { piiCount: true },
    }),
    prisma.scanTelemetry.findMany({
      where: dateFilter,
      orderBy: { timestamp: 'asc' },
    }),
    prisma.auditEvent.count({
      where: { ...dateFilter, type: 'override' },
    }),
  ]);

  const siteBreakdown: Record<string, { total: number; blocked: number; categories: Record<string, number> }> = {};
  const categoryCount: Record<string, number> = {};
  const dailyStats: Record<string, { scans: number; blocked: number; pii: number }> = {};

  for (const t of telemetryData) {
    const dateKey = t.timestamp.toISOString().split('T')[0];

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { scans: 0, blocked: 0, pii: 0 };
    }
    dailyStats[dateKey].scans++;
    if (t.blocked) dailyStats[dateKey].blocked++;
    dailyStats[dateKey].pii += t.piiCount;

    if (!siteBreakdown[t.site]) {
      siteBreakdown[t.site] = { total: 0, blocked: 0, categories: {} };
    }
    siteBreakdown[t.site].total++;
    if (t.blocked) siteBreakdown[t.site].blocked++;

    for (const cat of t.categories) {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      siteBreakdown[t.site].categories[cat] =
        (siteBreakdown[t.site].categories[cat] || 0) + 1;
    }
  }

  const topCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const dailyStatsArray = Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  return NextResponse.json({
    summary: {
      totalScans,
      blockedScans,
      piiProtected: piiProtected._sum.piiCount || 0,
      overrides: auditOverrides,
    },
    dailyStats: dailyStatsArray,
    siteBreakdown,
    topCategories,
  });
}
