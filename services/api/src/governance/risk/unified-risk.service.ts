import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface UnifiedRiskResult {
  score: number;
  level: RiskLevel;
  factors: string[];
}

@Injectable()
export class UnifiedRiskService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    userId: string,
    context: { ip?: string; deviceId?: string; action?: string },
  ): Promise<UnifiedRiskResult> {
    const factors: string[] = [];
    let score = 0;

    // ── Auth risk events (last 10) ────────────────────────────────────────
    const authRiskEvents: any[] = await this.db.authRiskEvent.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (authRiskEvents.length > 0) {
      const avgAuthRisk =
        authRiskEvents.reduce((sum: number, e: any) => sum + e.riskScore, 0) /
        authRiskEvents.length;

      // Auth risk contributes up to 60 points (scaled to 0-60)
      const authContribution = Math.round((avgAuthRisk / 100) * 60);
      score += authContribution;

      if (avgAuthRisk >= 70) {
        factors.push('High average auth risk score across recent events');
      } else if (avgAuthRisk >= 40) {
        factors.push('Elevated auth risk detected in recent events');
      }

      const blockedCount = authRiskEvents.filter(
        (e: any) => e.riskLevel === 'block',
      ).length;
      if (blockedCount > 0) {
        factors.push(`${blockedCount} blocked auth event(s) in recent history`);
        score = Math.min(100, score + blockedCount * 5);
      }

      const reAuthCount = authRiskEvents.filter(
        (e: any) => e.riskLevel === 'reauth',
      ).length;
      if (reAuthCount > 2) {
        factors.push('Multiple re-authentication triggers in recent history');
      }
    } else {
      factors.push('No auth risk history — treating as baseline');
    }

    // ── Trust score ───────────────────────────────────────────────────────
    const trustScore: any = await this.db.trustScore.findFirst({
      where: { context: 'user', contextValue: userId },
    });

    if (trustScore) {
      const composite = Number(trustScore.compositeScore);
      // Low trust → high risk. Invert and scale to 0-40
      const trustRisk = Math.round(((100 - composite) / 100) * 40);
      score = Math.min(100, score + trustRisk);

      if (composite < 55) {
        factors.push(`Low trust composite score: ${composite.toFixed(1)}`);
      } else if (composite < 75) {
        factors.push(`Moderate trust composite score: ${composite.toFixed(1)}`);
      }

      if (trustScore.autonomyLevelGranted === 0) {
        factors.push('Trust engine: observe-only autonomy level');
      }
    } else {
      // No trust record — add a moderate penalty
      score = Math.min(100, score + 15);
      factors.push('No trust score record — applying baseline risk');
    }

    // ── Context signals ───────────────────────────────────────────────────
    if (context.ip) {
      const recentIpRisk: any = await this.db.authRiskEvent.findFirst({
        where: { ip: context.ip, riskScore: { gte: 70 } },
        orderBy: { createdAt: 'desc' },
      });
      if (recentIpRisk) {
        factors.push(`Suspicious IP address: ${context.ip}`);
        score = Math.min(100, score + 10);
      }
    }

    if (!context.deviceId) {
      factors.push('No device identifier provided');
      score = Math.min(100, score + 5);
    }

    if (!factors.length) {
      factors.push('No elevated risk factors detected');
    }

    const level = this.scoreToLevel(score);

    return { score, level, factors };
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}
