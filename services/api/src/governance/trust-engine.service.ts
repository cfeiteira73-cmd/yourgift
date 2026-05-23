import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Autonomy levels:
// 0 = OBSERVE ONLY (analytics)
// 1 = SUGGEST (AI recommendations, no execution)
// 2 = CONTROLLED EXECUTION (auto-execute low risk)
// 3 = FULL AUTONOMY (pre-approved workflows only)

export const AUTONOMY_LABELS: Record<number, string> = {
  0: 'Observe Only',
  1: 'Suggest',
  2: 'Controlled Execution',
  3: 'Full Autonomy',
};

export interface TrustBreakdown {
  compositeScore: number;
  autonomyLevel: number;
  autonomyLabel: string;
  explainability: number;
  benchmarkDeviation: number;
  historicalAccuracy: number;
  governanceCompliance: number;
  overrideFrequency: number;
  sampleCount: number;
}

@Injectable()
export class TrustEngineService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  computeAutonomyLevel(compositeScore: number): number {
    if (compositeScore >= 90) return 3;
    if (compositeScore >= 75) return 2;
    if (compositeScore >= 55) return 1;
    return 0;
  }

  async getOrCreateTrustScore(context: string, contextValue: string): Promise<any> {
    let score = await this.db.trustScore.findFirst({
      where: { context, contextValue },
    });
    if (!score) {
      score = await this.db.trustScore.create({
        data: {
          context,
          contextValue,
          explainabilityScore: 75,
          benchmarkDeviationScore: 70,
          historicalAccuracyScore: 65,
          governanceComplianceScore: 85,
          overrideFrequencyScore: 80,
          compositeScore: 75,
          autonomyLevelGranted: 2,
          sampleCount: 0,
        },
      });
    }
    return score;
  }

  async getTrustBreakdown(context: string, contextValue: string): Promise<TrustBreakdown | null> {
    const score = await this.db.trustScore.findFirst({ where: { context, contextValue } });
    if (!score) return null;
    const composite = Number(score.compositeScore);
    return {
      compositeScore: composite,
      autonomyLevel: score.autonomyLevelGranted,
      autonomyLabel: AUTONOMY_LABELS[score.autonomyLevelGranted] ?? 'Unknown',
      explainability: Number(score.explainabilityScore),
      benchmarkDeviation: Number(score.benchmarkDeviationScore),
      historicalAccuracy: Number(score.historicalAccuracyScore),
      governanceCompliance: Number(score.governanceComplianceScore),
      overrideFrequency: Number(score.overrideFrequencyScore),
      sampleCount: score.sampleCount,
    };
  }

  async recordOutcome(params: {
    context: string;
    contextValue: string;
    wasCorrect: boolean;
    wasOverridden: boolean;
    hadViolation: boolean;
    benchmarkDeltaPct?: number;
  }): Promise<void> {
    const score = await this.getOrCreateTrustScore(params.context, params.contextValue);
    const n = score.sampleCount + 1;

    // Weighted rolling average update (exponential decay α=0.1)
    const α = 0.1;
    const cur = (field: string) => Number(score[field]);

    const newHistorical = params.wasCorrect
      ? Math.min(100, cur('historicalAccuracyScore') * (1 - α) + 100 * α)
      : Math.max(0, cur('historicalAccuracyScore') * (1 - α) + 0 * α);

    const newOverride = params.wasOverridden
      ? Math.max(0, cur('overrideFrequencyScore') - 3)   // each override decreases by 3
      : Math.min(100, cur('overrideFrequencyScore') + 0.5);

    const newCompliance = params.hadViolation
      ? Math.max(0, cur('governanceComplianceScore') - 5)
      : Math.min(100, cur('governanceComplianceScore') + 0.2);

    const newBenchmark = params.benchmarkDeltaPct != null
      ? Math.min(100, Math.max(0, cur('benchmarkDeviationScore') + params.benchmarkDeltaPct * 0.1))
      : cur('benchmarkDeviationScore');

    // Composite: weighted average of all 5 factors
    const newComposite = Math.round((
      cur('explainabilityScore') * 0.15 +
      newBenchmark * 0.20 +
      newHistorical * 0.30 +
      newCompliance * 0.25 +
      newOverride * 0.10
    ) * 100) / 100;

    const newAutonomyLevel = this.computeAutonomyLevel(newComposite);

    await this.db.trustScore.update({
      where: { id: score.id },
      data: {
        historicalAccuracyScore: Math.round(newHistorical * 100) / 100,
        overrideFrequencyScore: Math.round(newOverride * 100) / 100,
        governanceComplianceScore: Math.round(newCompliance * 100) / 100,
        benchmarkDeviationScore: Math.round(newBenchmark * 100) / 100,
        compositeScore: newComposite,
        autonomyLevelGranted: newAutonomyLevel,
        sampleCount: n,
        updatedAt: new Date(),
      },
    });

    // Record trust event
    const eventType = params.wasCorrect ? 'correct_prediction' : params.wasOverridden ? 'override' : params.hadViolation ? 'violation' : 'benchmark_deviation';
    const impact = params.wasCorrect ? 'positive' : 'negative';
    const delta = newComposite - Number(score.compositeScore);

    await this.db.trustEvent.create({
      data: {
        trustScoreId: score.id,
        eventType,
        impact,
        deltaScore: Math.round(delta * 1000) / 1000,
        context: params as unknown as object,
      },
    });
  }

  async getAllTrustScores(): Promise<any[]> {
    return this.db.trustScore.findMany({
      orderBy: { compositeScore: 'desc' },
    });
  }

  async getTrustEvents(trustScoreId: string, limit = 20): Promise<any[]> {
    return this.db.trustEvent.findMany({
      where: { trustScoreId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getNetworkTrustStats(): Promise<{
    avgCompositeScore: number;
    level3Count: number;
    level2Count: number;
    level1Count: number;
    level0Count: number;
    totalScores: number;
    recentEvents: number;
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [scores, recentEvents] = await Promise.all([
      this.db.trustScore.findMany({ select: { compositeScore: true, autonomyLevelGranted: true } }),
      this.db.trustEvent.count({ where: { createdAt: { gte: oneDayAgo } } }),
    ]);

    const avgComposite = scores.length > 0
      ? scores.reduce((s: number, r: any) => s + Number(r.compositeScore), 0) / scores.length
      : 0;

    const levelCounts = [0, 1, 2, 3].map((l) =>
      scores.filter((s: any) => s.autonomyLevelGranted === l).length
    );

    return {
      avgCompositeScore: Math.round(avgComposite * 10) / 10,
      level0Count: levelCounts[0],
      level1Count: levelCounts[1],
      level2Count: levelCounts[2],
      level3Count: levelCounts[3],
      totalScores: scores.length,
      recentEvents,
    };
  }
}
