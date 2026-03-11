import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, validateApiKey } from '@/lib/auth';
import { Prisma } from '@/app/generated/prisma/client';

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const session = await getSession();

  if (!session || session.orgId !== orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: Prisma.AuditEventWhereInput = { orgId };

  if (type && type !== 'all') {
    where.type = type;
  }

  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) where.timestamp.lte = new Date(to);
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return NextResponse.json({ events, total, page, limit });
}

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

    await prisma.auditEvent.create({
      data: {
        orgId,
        deviceId: body.deviceId || request.headers.get('x-device-id') || 'unknown',
        timestamp: new Date(body.timestamp),
        type: body.type,
        details: body.details ?? {},
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to record audit event' },
      { status: 500 }
    );
  }
}
