import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordOverrideDto {
  modelVersionId: string;
  decisionId?: string;
  procurementRequestId?: string;
  tenantId?: string;
  overriddenBy: string;
  aiRecommendation: string;
  humanDecision: string;
  overrideReason?: string;
}

export interface OverrideRateResult {
  modelVersionId: string;
  totalDecisions: number;
  overrideCount: number;
  overrideRate: number;
  periodDays: number;
}

export interface DisagreementPattern {
  reason: string;
  count: number;
  pct: number;
}

export interface LearningSignal {
  id: string;
  aiRecommendation: string;
  humanDecision: string;
  overrideReason: string | null;
  outcome: string | null;
  outcomeNotes: string | null;
  financialImpact: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class OverrideIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordOverride(data: RecordOverrideDto) {
    return this.prisma.modelOverrideRecord.create({
      data: {
        modelVersionId: data.modelVersionId,
        decisionId: data.decisionId ?? null,
        procurementRequestId: data.procurementRequestId ?? null,
        tenantId: data.tenantId ?? null,
        overriddenBy: data.overriddenBy,
        aiRecommendation: data.aiRecommendation,
        humanDecision: data.humanDecision,
        overrideReason: data.overrideReason ?? null,
      },
    });
  }

  async resolveOutcome(
    overrideId: string,
    outcome: 'correct' | 'incorrect',
    notes?: string,
    financialImpact?: number,
  ) {
    const existing = await this.prisma.modelOverrideRecord.findUnique({
      where: { id: overrideId },
    });
    if (!existing) throw new NotFoundException(`Override ${overrideId} not found`);

    return this.prisma.modelOverrideRecord.update({
      where: { id: overrideId },
      data: {
        outcome,
        outcomeNotes: notes ?? null,
        financialImpact: financialImpact ?? null,
        resolvedAt: new Date(),
      },
    });
  }

  async getOverrideRate(modelVersionId: string, days = 30): Promise<OverrideRateResult> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const overrideCount = await this.prisma.modelOverrideRecord.count({
      where: { modelVersionId, createdAt: { gte: since } },
    });

    // Total "decisions" approximated by override records (each override = 1 AI decision used + overridden)
    // In a real system this would join against a decisions table; here we use the override count as proxy.
    // We also look at all records including non-overridden ones if they exist;
    // since we only store overrides, totalDecisions = overrideCount for this model.
    // Return the rate as 100% if all decisions were overridden (conservative).
    const totalDecisions = overrideCount;

    return {
      modelVersionId,
      totalDecisions,
      overrideCount,
      overrideRate: totalDecisions > 0 ? Number(((overrideCount / totalDecisions) * 100).toFixed(1)) : 0,
      periodDays: days,
    };
  }

  async getDisagreementPatterns(modelVersionId: string): Promise<DisagreementPattern[]> {
    const records = await this.prisma.modelOverrideRecord.findMany({
      where: { modelVersionId },
      select: { overrideReason: true },
    });

    const total = records.length;
    if (total === 0) return [];

    const counts = new Map<string, number>();
    for (const r of records) {
      const key = r.overrideReason ?? 'no_reason';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return sorted.map(([reason, count]) => ({
      reason,
      count,
      pct: Number(((count / total) * 100).toFixed(1)),
    }));
  }

  async getLearningSignals(modelVersionId: string): Promise<LearningSignal[]> {
    const records = await this.prisma.modelOverrideRecord.findMany({
      where: {
        modelVersionId,
        outcome: { not: null },
        resolvedAt: { not: null },
      },
      orderBy: { resolvedAt: 'desc' },
      take: 100,
    });

    return records.map((r) => ({
      id: r.id,
      aiRecommendation: r.aiRecommendation,
      humanDecision: r.humanDecision,
      overrideReason: r.overrideReason,
      outcome: r.outcome,
      outcomeNotes: r.outcomeNotes,
      financialImpact: r.financialImpact,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  }
}
