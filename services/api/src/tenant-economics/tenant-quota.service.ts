import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsageMeteringService } from './usage-metering.service';

export interface QuotaDimension {
  name: string;
  used: number;
  limit: number;
  pct: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface QuotaCheckResult {
  allowed: boolean;
  limitType?: string;
  used: number;
  limit: number;
}

export interface QuotaStatusResult {
  dimensions: QuotaDimension[];
}

export interface NoisyNeighbor {
  tenantId: string;
  shareOfTotalPct: number;
  eventType: string;
}

// Plan-based default quotas
const PLAN_DEFAULTS: Record<
  string,
  {
    maxAiCallsPerDay: number;
    maxAiTokensPerDay: bigint;
    maxProcurementsPerMonth: number;
    maxSimulationsPerDay: number;
    maxApiCallsPerMinute: number;
    maxStorageGb: number;
    maxQueueJobsPerHour: number;
    aiCostBudgetEurMonth: number | null;
  }
> = {
  starter: {
    maxAiCallsPerDay: 200,
    maxAiTokensPerDay: BigInt(200_000),
    maxProcurementsPerMonth: 100,
    maxSimulationsPerDay: 50,
    maxApiCallsPerMinute: 60,
    maxStorageGb: 2,
    maxQueueJobsPerHour: 200,
    aiCostBudgetEurMonth: 20,
  },
  growth: {
    maxAiCallsPerDay: 1000,
    maxAiTokensPerDay: BigInt(1_000_000),
    maxProcurementsPerMonth: 500,
    maxSimulationsPerDay: 200,
    maxApiCallsPerMinute: 200,
    maxStorageGb: 10,
    maxQueueJobsPerHour: 1000,
    aiCostBudgetEurMonth: 100,
  },
  enterprise: {
    maxAiCallsPerDay: 10_000,
    maxAiTokensPerDay: BigInt(10_000_000),
    maxProcurementsPerMonth: 5000,
    maxSimulationsPerDay: 2000,
    maxApiCallsPerMinute: 1000,
    maxStorageGb: 100,
    maxQueueJobsPerHour: 10_000,
    aiCostBudgetEurMonth: 500,
  },
};

@Injectable()
export class TenantQuotaService {
  private readonly logger = new Logger(TenantQuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meteringService: UsageMeteringService,
  ) {}

  async getQuota(tenantId: string) {
    const existing = await this.prisma.tenantQuota.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    // Look up tenant plan
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    const plan = tenant?.plan ?? 'starter';
    const defaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS['starter']!;

    return this.prisma.tenantQuota.create({
      data: {
        tenantId,
        ...defaults,
      },
    });
  }

  async updateQuota(tenantId: string, updates: Record<string, unknown>) {
    await this.getQuota(tenantId); // ensure exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma.tenantQuota as any).update({
      where: { tenantId },
      data: updates,
    }) as Promise<Record<string, unknown>>;
  }

  async checkQuota(
    tenantId: string,
    eventType: string,
    units: number,
  ): Promise<QuotaCheckResult> {
    const quota = await this.getQuota(tenantId);
    const usage = await this.meteringService.getCurrentPeriodUsage(tenantId);

    switch (eventType) {
      case 'ai_call': {
        const used = usage.aiCallCount;
        const limit = quota.maxAiCallsPerDay;
        const allowed = quota.softEnforcement || used + 1 <= limit;
        return { allowed, limitType: 'maxAiCallsPerDay', used, limit };
      }
      case 'ai_tokens': {
        const used = Number(usage.aiTokensUsed);
        const limit = Number(quota.maxAiTokensPerDay);
        const allowed = quota.softEnforcement || used + units <= limit;
        return { allowed, limitType: 'maxAiTokensPerDay', used, limit };
      }
      case 'procurement_execution': {
        // check monthly
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const events = await this.prisma.usageMeteringEvent.count({
          where: {
            tenantId,
            eventType: 'procurement_execution',
            occurredAt: { gte: monthStart },
          },
        });
        const limit = quota.maxProcurementsPerMonth;
        const allowed = quota.softEnforcement || events + units <= limit;
        return { allowed, limitType: 'maxProcurementsPerMonth', used: events, limit };
      }
      case 'simulation': {
        const used = usage.simulationCount;
        const limit = quota.maxSimulationsPerDay;
        const allowed = quota.softEnforcement || used + units <= limit;
        return { allowed, limitType: 'maxSimulationsPerDay', used, limit };
      }
      case 'api_call': {
        const used = usage.apiCallCount;
        const limit = quota.maxApiCallsPerMinute;
        const allowed = quota.softEnforcement || used + units <= limit;
        return { allowed, limitType: 'maxApiCallsPerMinute', used, limit };
      }
      default:
        return { allowed: true, used: 0, limit: 0 };
    }
  }

  async getQuotaStatus(tenantId: string): Promise<QuotaStatusResult> {
    const quota = await this.getQuota(tenantId);
    const usage = await this.meteringService.getCurrentPeriodUsage(tenantId);

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const procThisMonth = await this.prisma.usageMeteringEvent.count({
      where: {
        tenantId,
        eventType: 'procurement_execution',
        occurredAt: { gte: monthStart },
      },
    });

    const buildDimension = (
      name: string,
      used: number,
      limit: number,
    ): QuotaDimension => {
      const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
      const thresholdPct = quota.alertThresholdPct;
      const status: 'ok' | 'warning' | 'exceeded' =
        pct >= 100 ? 'exceeded' : pct >= thresholdPct ? 'warning' : 'ok';
      return { name, used, limit, pct: Math.round(pct * 10) / 10, status };
    };

    const dimensions: QuotaDimension[] = [
      buildDimension('AI Calls / Day', usage.aiCallCount, quota.maxAiCallsPerDay),
      buildDimension(
        'AI Tokens / Day',
        Number(usage.aiTokensUsed),
        Number(quota.maxAiTokensPerDay),
      ),
      buildDimension('Procurements / Month', procThisMonth, quota.maxProcurementsPerMonth),
      buildDimension('Simulations / Day', usage.simulationCount, quota.maxSimulationsPerDay),
      buildDimension('API Calls / Min', usage.apiCallCount, quota.maxApiCallsPerMinute),
    ];

    if (quota.aiCostBudgetEurMonth !== null && quota.aiCostBudgetEurMonth !== undefined) {
      // AI cost so far this month
      const aiCostMonth = await this.prisma.usageMeteringEvent.aggregate({
        where: {
          tenantId,
          eventType: 'ai_call',
          occurredAt: { gte: monthStart },
        },
        _sum: { costEur: true },
      });
      const aiCostUsed = aiCostMonth._sum.costEur ?? 0;
      dimensions.push(
        buildDimension(
          'AI Budget EUR / Month',
          Math.round(aiCostUsed * 100) / 100,
          quota.aiCostBudgetEurMonth,
        ),
      );
    }

    return { dimensions };
  }

  async detectNoisyNeighbor(): Promise<NoisyNeighbor[]> {
    const since = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour

    const totalByType = await this.prisma.usageMeteringEvent.groupBy({
      by: ['eventType'],
      where: { occurredAt: { gte: since } },
      _sum: { costEur: true },
      _count: { id: true },
    });

    const tenantByType = await this.prisma.usageMeteringEvent.groupBy({
      by: ['tenantId', 'eventType'],
      where: { occurredAt: { gte: since } },
      _sum: { costEur: true },
      _count: { id: true },
    });

    type TotalRow = { eventType: string; _sum: { costEur: number | null } };
    type TenantRow = { tenantId: string; eventType: string; _sum: { costEur: number | null }; _count: { id: number } };

    const totalMap = new Map<string, number>(
      (totalByType as TotalRow[]).map((r) => [r.eventType, r._sum.costEur ?? 0]),
    );

    const noisy: NoisyNeighbor[] = [];

    for (const row of tenantByType as TenantRow[]) {
      const total = totalMap.get(row.eventType) ?? 0;
      if (total <= 0) continue;
      const share = ((row._sum.costEur ?? 0) / total) * 100;
      if (share >= 30) {
        noisy.push({
          tenantId: row.tenantId,
          shareOfTotalPct: Math.round(share * 10) / 10,
          eventType: row.eventType,
        });
      }
    }

    return noisy.sort((a, b) => b.shareOfTotalPct - a.shareOfTotalPct);
  }
}
