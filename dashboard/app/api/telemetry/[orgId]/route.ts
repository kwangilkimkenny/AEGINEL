import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';

type RouteParams = { params: Promise<{ orgId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;

  const valid = await validateApiKey(
    request.headers.get('authorization'),
    orgId
  );
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const deviceId = request.headers.get('x-device-id') || 'unknown';

    await prisma.device.upsert({
      where: { deviceId },
      create: { deviceId, orgId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });

    await prisma.scanTelemetry.create({
      data: {
        orgId,
        deviceId,
        timestamp: new Date(body.timestamp),
        site: body.site,
        score: body.score,
        level: body.level,
        categories: body.categories ?? [],
        blocked: body.blocked ?? false,
        piiCount: body.piiCount ?? 0,
        ruleScore: body.ruleScore ?? 0,
        mlScore: body.mlScore ?? 0,
        latencyMs: body.latencyMs ?? 0,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to record telemetry' },
      { status: 500 }
    );
  }
}
