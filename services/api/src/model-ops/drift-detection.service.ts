import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

function computeSeverity(driftPct: number): DriftSeverity {
  const abs = Math.abs(driftPct);
  if (abs > 50) return 'critical';
  if (abs > 20) return 'high';
  if (abs > 10) return 'medium';
  return 'low';
}

export interface DriftMetricSummary {
  metric: string;
  avgDrift: number;
  maxDrift: number;
  recordCount: number;
  latestSeverity: string;
  latestAt: Date;
}

export interface DriftAlert {
  id: string;
  modelVersionId: string;
  metric: string;
  driftPct: number;
  severity: string;
  sampleCount: number;
  createdAt: Date;
}

@Injectable()
export class DriftDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async recordObservation(
    modelVersionId: string,
    metric: string,
    expected: number,
    observed: number,
    windowStart: Date,
    windowEnd: Date,
    sampleCount: number,
    tenantId?: string,
  ) {
    const driftPct =
      expected !== 0
        ? ((observed - expected) / Math.abs(expected)) * 100
        : observed !== 0
          ? 100
          : 0;

    const severity = computeSeverity(driftPct);

    return this.prisma.modelDriftRecord.create({
      data: {
        modelVersionId,
        metric,
        expectedValue: expected,
        observedValue: observed,
        driftPct,
        severity,
        windowStart,
        windowEnd,
        sampleCount,
        tenantId: tenantId ?? null,
      },
    });
  }

  async getDriftSummary(
    modelVersionId: string,
    days = 30,
  ): Promise<DriftMetricSummary[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await this.prisma.modelDriftRecord.findMany({
      where: { modelVersionId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by metric
    const byMetric = new Map<
      string,
      { drifts: number[]; latestSeverity: string; latestAt: Date }
    >();

    for (const r of records) {
      const existing = byMetric.get(r.metric);
      if (!existing) {
        byMetric.set(r.metric, {
          drifts: [r.driftPct],
          latestSeverity: r.severity,
          latestAt: r.createdAt,
        });
      } else {
        existing.drifts.push(r.driftPct);
        if (r.createdAt > existing.latestAt) {
          existing.latestAt = r.createdAt;
          existing.latestSeverity = r.severity;
        }
      }
    }

    const summaries: DriftMetricSummary[] = [];
    for (const [metric, data] of byMetric.entries()) {
      const avg = data.drifts.reduce((a, b) => a + b, 0) / data.drifts.length;
      const max = data.drifts.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      summaries.push({
        metric,
        avgDrift: Number(avg.toFixed(2)),
        maxDrift: Number(max.toFixed(2)),
        recordCount: data.drifts.length,
        latestSeverity: data.latestSeverity,
        latestAt: data.latestAt,
      });
    }

    return summaries;
  }

  async detectDriftForVersion(modelVersionId: string): Promise<DriftAlert[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const records = await this.prisma.modelDriftRecord.findMany({
      where: {
        modelVersionId,
        createdAt: { gte: since },
        severity: { in: ['high', 'critical'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      modelVersionId: r.modelVersionId,
      metric: r.metric,
      driftPct: r.driftPct,
      severity: r.severity,
      sampleCount: r.sampleCount,
      createdAt: r.createdAt,
    }));
  }

  async getRecentAlerts(limit = 50): Promise<DriftAlert[]> {
    const records = await this.prisma.modelDriftRecord.findMany({
      where: { severity: { in: ['high', 'critical'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      modelVersionId: r.modelVersionId,
      metric: r.metric,
      driftPct: r.driftPct,
      severity: r.severity,
      sampleCount: r.sampleCount,
      createdAt: r.createdAt,
    }));
  }
}
