import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordParams {
  tenantId: string;
  eventType: string;
  units: number;
  unitType: string;
  tenantPlan: string;
  provider?: string;
  modelRef?: string;
  resourceId?: string;
  durationMs?: number;
}

export interface CurrentPeriodUsage {
  aiCallCount: number;
  aiTokensUsed: bigint;
  aiCostEur: number;
  apiCallCount: number;
  procurementCount: number;
  simulationCount: number;
  totalCostEur: number;
}

export interface TopConsumer {
  tenantId: string;
  totalCostEur: number;
  aiCostEur: number;
  procurementCount: number;
}

export interface TrendPoint {
  date: string;
  totalCostEur: number;
  aiCostEur: number;
}

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  private readonly COSTS: Record<string, number> = {
    ai_call_per_1k_tokens_anthropic: 0.003,
    ai_call_per_1k_tokens_openai: 0.002,
    api_call: 0.00001,
    queue_job: 0.00005,
    storage_gb_per_month: 0.023,
    procurement_execution: 0.10,
    simulation: 0.01,
    report_generation: 0.05,
  };

  constructor(private readonly prisma: PrismaService) {}

  computeCostEur(
    eventType: string,
    units: number,
    provider?: string,
    modelRef?: string,
  ): number {
    switch (eventType) {
      case 'ai_call': {
        const rateKey =
          provider === 'openai'
            ? 'ai_call_per_1k_tokens_openai'
            : 'ai_call_per_1k_tokens_anthropic';
        const rate = this.COSTS[rateKey] ?? this.COSTS['ai_call_per_1k_tokens_anthropic']!;
        // units = tokens; cost per 1k tokens
        void modelRef; // reserved for future model-specific pricing
        return (units / 1000) * rate;
      }
      case 'api_call':
        return units * (this.COSTS['api_call'] ?? 0);
      case 'queue_job':
        return units * (this.COSTS['queue_job'] ?? 0);
      case 'storage_write': {
        // units = bytes; convert to GB, prorate by month (~730 hours)
        const gb = units / (1024 * 1024 * 1024);
        return gb * (this.COSTS['storage_gb_per_month'] ?? 0);
      }
      case 'procurement_execution':
        return units * (this.COSTS['procurement_execution'] ?? 0);
      case 'simulation':
        return units * (this.COSTS['simulation'] ?? 0);
      case 'report_generation':
        return units * (this.COSTS['report_generation'] ?? 0);
      default:
        return 0;
    }
  }

  async record(params: RecordParams): Promise<void> {
    try {
      const costEur = this.computeCostEur(
        params.eventType,
        params.units,
        params.provider,
        params.modelRef,
      );
      await this.prisma.usageMeteringEvent.create({
        data: {
          tenantId: params.tenantId,
          eventType: params.eventType,
          units: params.units,
          unitType: params.unitType,
          costEur,
          tenantPlan: params.tenantPlan,
          provider: params.provider ?? null,
          modelRef: params.modelRef ?? null,
          resourceId: params.resourceId ?? null,
          durationMs: params.durationMs ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `UsageMeteringService.record failed (fire-and-forget): ${String(err)}`,
      );
    }
  }

  async aggregatePeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    periodType: 'hourly' | 'daily' | 'monthly',
  ): Promise<void> {
    const events = await this.prisma.usageMeteringEvent.findMany({
      where: {
        tenantId,
        occurredAt: { gte: periodStart, lt: periodEnd },
      },
    });

    let aiCallCount = 0;
    let aiTokensUsed = BigInt(0);
    let aiCostEur = 0;
    let apiCallCount = 0;
    let procurementCount = 0;
    let simulationCount = 0;
    let queueJobCount = 0;
    let storageBytes = BigInt(0);
    let totalCostEur = 0;

    for (const e of events) {
      totalCostEur += e.costEur;
      switch (e.eventType) {
        case 'ai_call':
          aiCallCount += 1;
          aiTokensUsed += BigInt(Math.round(e.units));
          aiCostEur += e.costEur;
          break;
        case 'api_call':
          apiCallCount += Math.round(e.units);
          break;
        case 'procurement_execution':
          procurementCount += Math.round(e.units);
          break;
        case 'simulation':
          simulationCount += Math.round(e.units);
          break;
        case 'queue_job':
          queueJobCount += Math.round(e.units);
          break;
        case 'storage_write':
          storageBytes += BigInt(Math.round(e.units));
          break;
        default:
          break;
      }
    }

    await this.prisma.tenantUsageSummary.upsert({
      where: {
        tenantId_periodStart_periodType: {
          tenantId,
          periodStart,
          periodType,
        },
      },
      create: {
        tenantId,
        periodStart,
        periodEnd,
        periodType,
        aiCallCount,
        aiTokensUsed,
        aiCostEur,
        apiCallCount,
        procurementCount,
        simulationCount,
        queueJobCount,
        storageBytes,
        totalCostEur,
      },
      update: {
        periodEnd,
        aiCallCount,
        aiTokensUsed,
        aiCostEur,
        apiCallCount,
        procurementCount,
        simulationCount,
        queueJobCount,
        storageBytes,
        totalCostEur,
        computedAt: new Date(),
      },
    });
  }

  async getCurrentPeriodUsage(tenantId: string): Promise<CurrentPeriodUsage> {
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const events = await this.prisma.usageMeteringEvent.findMany({
      where: {
        tenantId,
        occurredAt: { gte: dayStart },
      },
    });

    let aiCallCount = 0;
    let aiTokensUsed = BigInt(0);
    let aiCostEur = 0;
    let apiCallCount = 0;
    let procurementCount = 0;
    let simulationCount = 0;
    let totalCostEur = 0;

    for (const e of events) {
      totalCostEur += e.costEur;
      switch (e.eventType) {
        case 'ai_call':
          aiCallCount += 1;
          aiTokensUsed += BigInt(Math.round(e.units));
          aiCostEur += e.costEur;
          break;
        case 'api_call':
          apiCallCount += Math.round(e.units);
          break;
        case 'procurement_execution':
          procurementCount += Math.round(e.units);
          break;
        case 'simulation':
          simulationCount += Math.round(e.units);
          break;
        default:
          break;
      }
    }

    return {
      aiCallCount,
      aiTokensUsed,
      aiCostEur,
      apiCallCount,
      procurementCount,
      simulationCount,
      totalCostEur,
    };
  }

  async getTopConsumers(
    limit = 10,
    periodDays = 7,
  ): Promise<TopConsumer[]> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.usageMeteringEvent.groupBy({
      by: ['tenantId'],
      where: { occurredAt: { gte: since } },
      _sum: { costEur: true, units: true },
      orderBy: { _sum: { costEur: 'desc' } },
      take: limit,
    });

    const tenantIds = rows.map((r: { tenantId: string }) => r.tenantId);

    const aiRows = await this.prisma.usageMeteringEvent.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        eventType: 'ai_call',
        occurredAt: { gte: since },
      },
      _sum: { costEur: true },
    });

    const procRows = await this.prisma.usageMeteringEvent.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        eventType: 'procurement_execution',
        occurredAt: { gte: since },
      },
      _count: { id: true },
    });

    const aiByTenant = new Map<string, number>(
      (aiRows as Array<{ tenantId: string; _sum: { costEur: number | null } }>).map(
        (r) => [r.tenantId, r._sum.costEur ?? 0],
      ),
    );
    const procByTenant = new Map<string, number>(
      (procRows as Array<{ tenantId: string; _count: { id: number } }>).map(
        (r) => [r.tenantId, r._count.id],
      ),
    );

    return (rows as Array<{ tenantId: string; _sum: { costEur: number | null } }>).map(
      (r) => ({
        tenantId: r.tenantId,
        totalCostEur: r._sum.costEur ?? 0,
        aiCostEur: aiByTenant.get(r.tenantId) ?? 0,
        procurementCount: procByTenant.get(r.tenantId) ?? 0,
      }),
    );
  }

  async getTrend(tenantId: string, days: number): Promise<TrendPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await this.prisma.usageMeteringEvent.findMany({
      where: { tenantId, occurredAt: { gte: since } },
      select: { eventType: true, costEur: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    });

    const byDate = new Map<string, { totalCostEur: number; aiCostEur: number }>();

    for (const e of events) {
      const dateStr = e.occurredAt.toISOString().slice(0, 10);
      const existing = byDate.get(dateStr) ?? { totalCostEur: 0, aiCostEur: 0 };
      existing.totalCostEur += e.costEur;
      if (e.eventType === 'ai_call') {
        existing.aiCostEur += e.costEur;
      }
      byDate.set(dateStr, existing);
    }

    // Fill gaps with zero values
    const result: TrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const data = byDate.get(dateStr) ?? { totalCostEur: 0, aiCostEur: 0 };
      result.push({ date: dateStr, ...data });
    }

    return result;
  }
}
