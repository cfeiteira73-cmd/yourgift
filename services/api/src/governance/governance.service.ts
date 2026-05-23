import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DecisionContext {
  riskScore: number;
  finalMarginPct?: number;
  finalCostEur?: number;
  supplierCode?: string;
  tenantId?: string;
  action: string;
  category?: string;
}

export interface GovernanceResult {
  allowed: boolean;
  status: 'allowed' | 'requires_approval' | 'blocked' | 'escalated';
  reason: string;
  appliedPolicyId?: string;
  autonomyLevel: number;  // 0-3
}

@Injectable()
export class GovernanceService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async checkDecision(ctx: DecisionContext): Promise<GovernanceResult> {
    // Load active policies: tenant-specific first, then global fallback
    const policies: any[] = await this.db.governancePolicy.findMany({
      where: {
        isActive: true,
        OR: [
          { tenantId: ctx.tenantId ?? null },
          { tenantId: null },
        ],
      },
      orderBy: [{ tenantId: 'desc' }, { priority: 'asc' }],
    });

    const getConfig = (type: string): Record<string, any> => {
      const policy = policies.find((p) => p.policyType === type);
      return (policy?.config as Record<string, any>) ?? {};
    };

    const executionCfg = getConfig('execution');
    const financialCfg = getConfig('financial');
    const supplierCfg = getConfig('supplier');

    const maxAutoExecute: number = executionCfg['maxAutoExecuteRiskScore'] ?? 35;
    const requireApprovalAbove: number = executionCfg['requireApprovalAbove'] ?? 60;
    const blockAbove: number = executionCfg['blockAbove'] ?? 85;
    const marginFloor: number = financialCfg['marginFloorPct'] ?? 12;
    const minReliability: number = supplierCfg['minGlobalReliabilityScore'] ?? 70;

    // --- Financial policy check ---
    if (ctx.finalMarginPct != null && ctx.finalMarginPct < marginFloor) {
      const violatingPolicy = policies.find((p) => p.policyType === 'financial');
      if (violatingPolicy) {
        await this.recordViolation({
          policyId: violatingPolicy.id,
          violationType: 'margin_below_floor',
          blockedAction: ctx.action,
          resolvedAction: 'escalated',
          triggerContext: { margin: ctx.finalMarginPct, floor: marginFloor, ...ctx },
        });
      }
      return {
        allowed: false,
        status: 'escalated',
        reason: `Margin ${ctx.finalMarginPct.toFixed(1)}% is below policy floor of ${marginFloor}%`,
        appliedPolicyId: violatingPolicy?.id,
        autonomyLevel: 0,
      };
    }

    // --- Supplier reliability check ---
    if (ctx.supplierCode) {
      const trustScore: any = await this.db.trustScore.findFirst({
        where: { context: 'supplier', contextValue: ctx.supplierCode },
      });
      if (trustScore && Number(trustScore.compositeScore) < minReliability) {
        return {
          allowed: false,
          status: 'requires_approval',
          reason: `Supplier trust score ${Number(trustScore.compositeScore).toFixed(0)} below minimum ${minReliability}`,
          autonomyLevel: 1,
        };
      }
    }

    // --- Execution risk policy ---
    if (ctx.riskScore >= blockAbove) {
      const violatingPolicy = policies.find((p) => p.policyType === 'execution');
      if (violatingPolicy) {
        await this.recordViolation({
          policyId: violatingPolicy.id,
          violationType: 'risk_score_blocked',
          blockedAction: ctx.action,
          resolvedAction: 'blocked',
          triggerContext: { ...ctx, threshold: blockAbove },
        });
      }
      return {
        allowed: false,
        status: 'blocked',
        reason: `Risk score ${ctx.riskScore} exceeds block threshold ${blockAbove}`,
        appliedPolicyId: violatingPolicy?.id,
        autonomyLevel: 0,
      };
    }

    if (ctx.riskScore >= requireApprovalAbove) {
      return {
        allowed: false,
        status: 'requires_approval',
        reason: `Risk score ${ctx.riskScore} requires human approval (threshold: ${requireApprovalAbove})`,
        autonomyLevel: 1,
      };
    }

    if (ctx.riskScore < maxAutoExecute) {
      return {
        allowed: true,
        status: 'allowed',
        reason: `Risk ${ctx.riskScore} within auto-execute threshold ${maxAutoExecute}`,
        autonomyLevel: 2,
      };
    }

    return {
      allowed: false,
      status: 'requires_approval',
      reason: `Risk score ${ctx.riskScore} in approval band (${maxAutoExecute}–${requireApprovalAbove})`,
      autonomyLevel: 1,
    };
  }

  private async recordViolation(params: {
    policyId: string;
    violationType: string;
    blockedAction: string;
    resolvedAction: string;
    triggerContext: object;
    decisionCardId?: string;
  }): Promise<void> {
    await this.db.policyViolation.create({
      data: {
        policyId: params.policyId,
        decisionCardId: params.decisionCardId ?? null,
        violationType: params.violationType,
        blockedAction: params.blockedAction,
        resolvedAction: params.resolvedAction,
        triggerContext: params.triggerContext as unknown as object,
      },
    });
  }

  async getPolicies(tenantId?: string): Promise<any[]> {
    return this.db.governancePolicy.findMany({
      where: tenantId
        ? { OR: [{ tenantId }, { tenantId: null }] }
        : { tenantId: null },
      orderBy: [{ policyType: 'asc' }, { priority: 'asc' }],
    });
  }

  async updatePolicyConfig(
    policyId: string,
    config: Record<string, unknown>,
  ): Promise<any> {
    return this.db.governancePolicy.update({
      where: { id: policyId },
      data: { config: config as unknown as object, updatedAt: new Date() },
    });
  }

  async togglePolicy(policyId: string, isActive: boolean): Promise<any> {
    return this.db.governancePolicy.update({
      where: { id: policyId },
      data: { isActive, updatedAt: new Date() },
    });
  }

  async getViolations(limit = 50): Promise<any[]> {
    return this.db.policyViolation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getGovernanceStats(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    totalViolations: number;
    violationsLast24h: number;
    blockedDecisions: number;
    escalatedDecisions: number;
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, active, totalViol, recentViol, blocked, escalated] = await Promise.all([
      this.db.governancePolicy.count(),
      this.db.governancePolicy.count({ where: { isActive: true } }),
      this.db.policyViolation.count(),
      this.db.policyViolation.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.db.policyViolation.count({ where: { resolvedAction: 'blocked' } }),
      this.db.policyViolation.count({ where: { resolvedAction: 'escalated' } }),
    ]);
    return { totalPolicies: total, activePolicies: active, totalViolations: totalViol, violationsLast24h: recentViol, blockedDecisions: blocked, escalatedDecisions: escalated };
  }
}
