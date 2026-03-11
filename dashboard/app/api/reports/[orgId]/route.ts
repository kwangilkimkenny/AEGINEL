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

  if (!from || !to) {
    return NextResponse.json(
      { error: 'from and to dates are required' },
      { status: 400 }
    );
  }

  const startDate = new Date(from);
  const endDate = new Date(to);
  const dateFilter = {
    orgId,
    timestamp: { gte: startDate, lte: endDate },
  };

  const [
    totalScans,
    blockedScans,
    piiAgg,
    overrideCount,
    uniqueDevices,
    activePolicy,
    categoryBreakdown,
  ] = await Promise.all([
    prisma.scanTelemetry.count({ where: dateFilter }),
    prisma.scanTelemetry.count({ where: { ...dateFilter, blocked: true } }),
    prisma.scanTelemetry.aggregate({
      where: { ...dateFilter, piiCount: { gt: 0 } },
      _sum: { piiCount: true },
      _count: true,
    }),
    prisma.auditEvent.count({ where: { ...dateFilter, type: 'override' } }),
    prisma.scanTelemetry.groupBy({
      by: ['deviceId'],
      where: dateFilter,
    }),
    prisma.policy.findFirst({
      where: { orgId, isActive: true },
      orderBy: { version: 'desc' },
    }),
    prisma.scanTelemetry.findMany({
      where: dateFilter,
      select: { categories: true },
    }),
  ]);

  const catCounts: Record<string, number> = {};
  for (const row of categoryBreakdown) {
    for (const cat of row.categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }

  return NextResponse.json({
    period: { from: startDate, to: endDate },
    summary: {
      totalScans,
      blockedScans,
      blockRate: totalScans > 0 ? ((blockedScans / totalScans) * 100).toFixed(1) : '0',
      piiProtectedCount: piiAgg._sum.piiCount || 0,
      piiDetectionEvents: piiAgg._count || 0,
      overrideCount,
      activeDevices: uniqueDevices.length,
    },
    policyStatus: activePolicy
      ? {
          version: activePolicy.version,
          blockThreshold: activePolicy.blockThreshold,
          enforcedLayers: activePolicy.enforcedLayers,
          forceDisabled: activePolicy.forceDisabled,
          reportTelemetry: activePolicy.reportTelemetry,
        }
      : null,
    categoryBreakdown: Object.entries(catCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count })),
  });
}
