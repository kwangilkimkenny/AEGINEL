import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, validateApiKey } from '@/lib/auth';

type RouteParams = { params: Promise<{ orgId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;

  const apiKeyValid = await validateApiKey(
    request.headers.get('authorization'),
    orgId
  );
  const session = await getSession();

  if (!apiKeyValid && (!session || session.orgId !== orgId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const policy = await prisma.policy.findFirst({
    where: { orgId, isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!policy) {
    return NextResponse.json({ error: 'No policy found' }, { status: 404 });
  }

  return NextResponse.json(policy);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const session = await getSession();

  if (!session || session.orgId !== orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const currentPolicy = await prisma.policy.findFirst({
      where: { orgId, isActive: true },
      orderBy: { version: 'desc' },
    });

    const newVersion = (currentPolicy?.version ?? 0) + 1;

    if (currentPolicy) {
      await prisma.policy.update({
        where: { id: currentPolicy.id },
        data: { isActive: false },
      });
    }

    const newPolicy = await prisma.policy.create({
      data: {
        orgId,
        version: newVersion,
        forceDisabled: body.forceDisabled ?? false,
        blockThreshold: body.blockThreshold ?? 70,
        sensitivity: body.sensitivity ?? 1.0,
        enforcedLayers: body.enforcedLayers ?? [],
        blockedSites: body.blockedSites ?? [],
        mandatoryPiiSites: body.mandatoryPiiSites ?? [],
        customKeywords: body.customKeywords ?? [],
        minPiiProxyMode: body.minPiiProxyMode ?? 'auto',
        reportTelemetry: body.reportTelemetry ?? true,
        isActive: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        orgId,
        deviceId: 'admin-dashboard',
        timestamp: new Date(),
        type: 'config_change',
        details: {
          action: 'policy_update',
          version: newVersion,
          changedBy: session.email,
        },
      },
    });

    return NextResponse.json(newPolicy);
  } catch {
    return NextResponse.json(
      { error: 'Failed to update policy' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const session = await getSession();

  if (!session || session.orgId !== orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { targetVersion } = await request.json();

    const targetPolicy = await prisma.policy.findFirst({
      where: { orgId, version: targetVersion },
    });

    if (!targetPolicy) {
      return NextResponse.json(
        { error: 'Target version not found' },
        { status: 404 }
      );
    }

    await prisma.policy.updateMany({
      where: { orgId, isActive: true },
      data: { isActive: false },
    });

    const currentMax = await prisma.policy.findFirst({
      where: { orgId },
      orderBy: { version: 'desc' },
    });

    const newVersion = (currentMax?.version ?? 0) + 1;

    const rolledBack = await prisma.policy.create({
      data: {
        orgId,
        version: newVersion,
        forceDisabled: targetPolicy.forceDisabled,
        blockThreshold: targetPolicy.blockThreshold,
        sensitivity: targetPolicy.sensitivity,
        enforcedLayers: targetPolicy.enforcedLayers,
        blockedSites: targetPolicy.blockedSites,
        mandatoryPiiSites: targetPolicy.mandatoryPiiSites,
        customKeywords: targetPolicy.customKeywords,
        minPiiProxyMode: targetPolicy.minPiiProxyMode,
        reportTelemetry: targetPolicy.reportTelemetry,
        isActive: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        orgId,
        deviceId: 'admin-dashboard',
        timestamp: new Date(),
        type: 'config_change',
        details: {
          action: 'policy_rollback',
          fromVersion: currentMax?.version,
          toVersion: targetVersion,
          newVersion,
          changedBy: session.email,
        },
      },
    });

    return NextResponse.json(rolledBack);
  } catch {
    return NextResponse.json(
      { error: 'Failed to rollback policy' },
      { status: 500 }
    );
  }
}
