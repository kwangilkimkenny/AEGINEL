import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const org = await prisma.organization.upsert({
      where: { id: 'org-default' },
      update: {},
      create: {
        id: 'org-default',
        name: 'AEGINEL Demo Organization',
      },
    });

    const passwordHash = await bcrypt.hash('admin1234', 12);

    await prisma.admin.upsert({
      where: { email: 'admin@aeginel.com' },
      update: {},
      create: {
        email: 'admin@aeginel.com',
        passwordHash,
        name: '관리자',
        orgId: org.id,
      },
    });

    await prisma.apiKey.upsert({
      where: { key: 'aeginel-demo-api-key-2024' },
      update: {},
      create: {
        key: 'aeginel-demo-api-key-2024',
        orgId: org.id,
        active: true,
      },
    });

    const existingPolicy = await prisma.policy.findFirst({
      where: { orgId: org.id },
    });

    if (!existingPolicy) {
      await prisma.policy.create({
        data: {
          orgId: org.id,
          version: 1,
          forceDisabled: false,
          blockThreshold: 70,
          sensitivity: 1.0,
          enforcedLayers: ['jailbreak', 'injection'],
          blockedSites: [],
          mandatoryPiiSites: ['chatgpt.com'],
          customKeywords: [],
          minPiiProxyMode: 'auto',
          reportTelemetry: true,
          isActive: true,
        },
      });
    }

    const now = new Date();
    const sites = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com'];
    const categories = ['jailbreak', 'injection', 'pii_leak', 'data_exfiltration', 'social_engineering'];

    const existingTelemetry = await prisma.scanTelemetry.count({ where: { orgId: org.id } });
    if (existingTelemetry === 0) {
      const telemetryData = [];
      for (let i = 0; i < 200; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = new Date(now.getTime() - daysAgo * 86400000 - Math.random() * 86400000);
        const score = Math.random() * 100;
        const blocked = score > 70;
        const numCats = Math.floor(Math.random() * 3);
        const cats: string[] = [];
        for (let j = 0; j < numCats; j++) {
          cats.push(categories[Math.floor(Math.random() * categories.length)]);
        }

        telemetryData.push({
          orgId: org.id,
          deviceId: `device-${Math.floor(Math.random() * 10) + 1}`,
          timestamp,
          site: sites[Math.floor(Math.random() * sites.length)],
          score: Math.round(score * 10) / 10,
          level: score > 70 ? 'danger' : score > 40 ? 'warning' : 'safe',
          categories: [...new Set(cats)],
          blocked,
          piiCount: Math.floor(Math.random() * 5),
          ruleScore: Math.round(Math.random() * 50 * 10) / 10,
          mlScore: Math.round(Math.random() * 50 * 10) / 10,
          latencyMs: Math.round(Math.random() * 200 * 10) / 10,
        });
      }
      await prisma.scanTelemetry.createMany({ data: telemetryData });
    }

    const existingAudit = await prisma.auditEvent.count({ where: { orgId: org.id } });
    if (existingAudit === 0) {
      const auditTypes = ['scan', 'block', 'override', 'pii_mask', 'config_change'];
      const auditData = [];
      for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = new Date(now.getTime() - daysAgo * 86400000);
        const type = auditTypes[Math.floor(Math.random() * auditTypes.length)];

        auditData.push({
          orgId: org.id,
          deviceId: `device-${Math.floor(Math.random() * 10) + 1}`,
          timestamp,
          type,
          details: {
            site: sites[Math.floor(Math.random() * sites.length)],
            category: categories[Math.floor(Math.random() * categories.length)],
            score: Math.round(Math.random() * 100),
          },
        });
      }
      await prisma.auditEvent.createMany({ data: auditData });
    }

    for (let i = 1; i <= 10; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      await prisma.device.upsert({
        where: { deviceId: `device-${i}` },
        update: { lastSeenAt: new Date(now.getTime() - daysAgo * 86400000) },
        create: {
          deviceId: `device-${i}`,
          orgId: org.id,
          name: `직원-${i} 디바이스`,
          lastSeenAt: new Date(now.getTime() - daysAgo * 86400000),
          policyApplied: Math.random() > 0.2,
          policyVersion: 1,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Seed data created' });
  } catch (err) {
    console.error('Seed error:', err);
    return NextResponse.json(
      { error: 'Failed to seed data', details: String(err) },
      { status: 500 }
    );
  }
}
