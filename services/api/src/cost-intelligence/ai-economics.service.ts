import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AiDecisionCost {
  decisionId: string;
  tenantId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEur: number;
  decisionType: string;
  revenueAttributedEur: number;
  roiMultiplier: number;
  createdAt: Date;
}

export interface AiEconomicsSummary {
  tenantId: string;
  period: { from: Date; to: Date };
  totalDecisions: number;
  totalTokens: number;
  totalCostEur: number;
  totalRevenueAttributedEur: number;
  avgRoiMultiplier: number;
  costByModel: Record<string, { decisions: number; costEur: number }>;
  costByDecisionType: Record<string, { decisions: number; costEur: number }>;
  unprofitableDecisions: number;
  topRoiDecisions: AiDecisionCost[];
}

interface ModelPricing {
  input: number;
  output: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet': { input: 0.000003, output: 0.000015 },
  'claude-3-haiku': { input: 0.00000025, output: 0.00000125 },
  'gpt-4o': { input: 0.000005, output: 0.000015 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
};

interface RecordDecisionDto {
  decisionId: string;
  tenantId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  decisionType: string;
  revenueAttributedEur?: number;
}

interface EventLogPayload {
  decisionId?: unknown;
  tenantId?: unknown;
  modelId?: unknown;
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  costEur?: unknown;
  decisionType?: unknown;
  revenueAttributedEur?: unknown;
  roiMultiplier?: unknown;
  createdAt?: unknown;
  [key: string]: unknown;
}

function parseAiDecisionCost(payload: unknown, createdAt: Date): AiDecisionCost | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as EventLogPayload;
  if (
    typeof p.decisionId !== 'string' ||
    typeof p.tenantId !== 'string' ||
    typeof p.modelId !== 'string' ||
    typeof p.promptTokens !== 'number' ||
    typeof p.completionTokens !== 'number' ||
    typeof p.totalTokens !== 'number' ||
    typeof p.costEur !== 'number' ||
    typeof p.decisionType !== 'string' ||
    typeof p.revenueAttributedEur !== 'number' ||
    typeof p.roiMultiplier !== 'number'
  ) {
    return null;
  }
  return {
    decisionId: p.decisionId,
    tenantId: p.tenantId,
    modelId: p.modelId,
    promptTokens: p.promptTokens,
    completionTokens: p.completionTokens,
    totalTokens: p.totalTokens,
    costEur: p.costEur,
    decisionType: p.decisionType,
    revenueAttributedEur: p.revenueAttributedEur,
    roiMultiplier: p.roiMultiplier,
    createdAt: typeof p.createdAt === 'string' ? new Date(p.createdAt) : createdAt,
  };
}

@Injectable()
export class AiEconomicsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordDecision(dto: RecordDecisionDto): Promise<AiDecisionCost> {
    const pricing = MODEL_PRICING[dto.modelId] ?? { input: 0, output: 0 };
    const costEur =
      dto.promptTokens * pricing.input + dto.completionTokens * pricing.output;
    const totalTokens = dto.promptTokens + dto.completionTokens;
    const revenueAttributedEur = dto.revenueAttributedEur ?? 0;
    const roiMultiplier = costEur > 0 ? revenueAttributedEur / costEur : 0;
    const now = new Date();

    const decision: AiDecisionCost = {
      decisionId: dto.decisionId,
      tenantId: dto.tenantId,
      modelId: dto.modelId,
      promptTokens: dto.promptTokens,
      completionTokens: dto.completionTokens,
      totalTokens,
      costEur,
      decisionType: dto.decisionType,
      revenueAttributedEur,
      roiMultiplier,
      createdAt: now,
    };

    await this.prisma.eventLog.create({
      data: {
        event: 'ai.decision_cost',
        entity: 'ai_decision',
        entityId: dto.decisionId,
        actorType: 'system',
        payload: decision as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return decision;
  }

  async getEconomicsSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<AiEconomicsSummary> {
    const logs = await this.prisma.eventLog.findMany({
      where: {
        event: 'ai.decision_cost',
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'asc' },
    });

    const decisions: AiDecisionCost[] = logs
      .map((log) => parseAiDecisionCost(log.payload, log.createdAt))
      .filter((d): d is AiDecisionCost => d !== null && d.tenantId === tenantId);

    const totalCostEur = decisions.reduce((s, d) => s + d.costEur, 0);
    const totalRevenueAttributedEur = decisions.reduce(
      (s, d) => s + d.revenueAttributedEur,
      0,
    );
    const avgRoiMultiplier =
      decisions.length > 0
        ? decisions.reduce((s, d) => s + d.roiMultiplier, 0) / decisions.length
        : 0;

    const costByModel: Record<string, { decisions: number; costEur: number }> = {};
    const costByDecisionType: Record<string, { decisions: number; costEur: number }> = {};

    for (const d of decisions) {
      if (!costByModel[d.modelId]) {
        costByModel[d.modelId] = { decisions: 0, costEur: 0 };
      }
      costByModel[d.modelId].decisions += 1;
      costByModel[d.modelId].costEur += d.costEur;

      if (!costByDecisionType[d.decisionType]) {
        costByDecisionType[d.decisionType] = { decisions: 0, costEur: 0 };
      }
      costByDecisionType[d.decisionType].decisions += 1;
      costByDecisionType[d.decisionType].costEur += d.costEur;
    }

    const unprofitableDecisions = decisions.filter((d) => d.roiMultiplier < 1).length;
    const topRoiDecisions = [...decisions]
      .sort((a, b) => b.roiMultiplier - a.roiMultiplier)
      .slice(0, 10);

    return {
      tenantId,
      period: { from, to },
      totalDecisions: decisions.length,
      totalTokens: decisions.reduce((s, d) => s + d.totalTokens, 0),
      totalCostEur,
      totalRevenueAttributedEur,
      avgRoiMultiplier,
      costByModel,
      costByDecisionType,
      unprofitableDecisions,
      topRoiDecisions,
    };
  }

  async getGlobalAiCostDashboard(
    from: Date,
    to: Date,
  ): Promise<{
    totalCostEur: number;
    totalDecisions: number;
    avgRoiMultiplier: number;
    byTenant: { tenantId: string; costEur: number; decisions: number }[];
  }> {
    const logs = await this.prisma.eventLog.findMany({
      where: {
        event: 'ai.decision_cost',
        createdAt: { gte: from, lte: to },
      },
    });

    const decisions: AiDecisionCost[] = logs
      .map((log) => parseAiDecisionCost(log.payload, log.createdAt))
      .filter((d): d is AiDecisionCost => d !== null);

    const byTenantMap = new Map<string, { costEur: number; decisions: number }>();
    for (const d of decisions) {
      const existing = byTenantMap.get(d.tenantId) ?? { costEur: 0, decisions: 0 };
      existing.costEur += d.costEur;
      existing.decisions += 1;
      byTenantMap.set(d.tenantId, existing);
    }

    const byTenant = Array.from(byTenantMap.entries()).map(([tenantId, stats]) => ({
      tenantId,
      ...stats,
    }));

    const totalCostEur = decisions.reduce((s, d) => s + d.costEur, 0);
    const avgRoiMultiplier =
      decisions.length > 0
        ? decisions.reduce((s, d) => s + d.roiMultiplier, 0) / decisions.length
        : 0;

    return {
      totalCostEur,
      totalDecisions: decisions.length,
      avgRoiMultiplier,
      byTenant,
    };
  }
}
