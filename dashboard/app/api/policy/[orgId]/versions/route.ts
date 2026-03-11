import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const session = await getSession();

  if (!session || session.orgId !== orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const versions = await prisma.policy.findMany({
    where: { orgId },
    orderBy: { version: 'desc' },
    take: 50,
  });

  return NextResponse.json(versions);
}
