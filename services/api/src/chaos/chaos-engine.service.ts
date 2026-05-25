import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DrillType =
  | 'redis_outage'
  | 'db_failover'
  | 'stripe_timeout'
  | 'queue_corruption'
  | 'dependency_degradation'
  | 'network_partition'
  | 'memory_pressure'
  | 'latency_injection';

interface DrillSimulation {
  estimatedImpact: string;
  affectedServices: string[];
  estimatedMttrMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

interface DrillStats {
  totalDrills: number;
  completedDrills: number;
  abortedDrills: number;
  avgMttrMinutes: number;
  rtoMetRate: number;
  rpoMetRate: number;
  drillsByType: { drillType: string; count: number }[];
}

// Static impact matrix for dry-run simulation
const DRILL_IMPACT_MAP: Record<
  string,
  {
    impact: string;
    affected: string[];
    mttrMin: number;
    risk: 'low' | 'medium' | 'high';
    recs: string[];
  }
> = {
  redis_outage: {
    impact: 'Cache miss storm; sessions invalidated; rate limiting disabled',
    affected: ['rate-limit', 'session-store', 'bullmq', 'notifications'],
    mttrMin: 8,
    risk: 'medium',
    recs: [
      'Ensure graceful degradation for cache misses',
      'Validate fallback to DB-based rate limiting',
      'Test session re-creation flows',
    ],
  },
  db_failover: {
    impact: 'Primary DB unreachable; writes queued; read replicas promoted',
    affected: ['api', 'orders', 'payments', 'prisma'],
    mttrMin: 12,
    risk: 'high',
    recs: [
      'Verify read replica promotion scripts',
      'Test connection pool recovery',
      'Validate write queue drain after failover',
    ],
  },
  stripe_timeout: {
    impact: 'Payment processing halted; checkout flows fail with 503',
    affected: ['payments', 'checkout', 'orders', 'stripe-webhook'],
    mttrMin: 5,
    risk: 'medium',
    recs: [
      'Confirm idempotency key handling',
      'Test retry logic with exponential backoff',
      'Validate webhook deduplication',
    ],
  },
  queue_corruption: {
    impact: 'Job queue corrupted; background jobs lost; no processing',
    affected: ['bullmq', 'notifications', 'webhooks', 'analytics'],
    mttrMin: 15,
    risk: 'high',
    recs: [
      'Enable dead-letter queues',
      'Test queue reconstruction from DB events',
      'Validate job idempotency on replay',
    ],
  },
  dependency_degradation: {
    impact: 'External integrations slow/unreliable; circuit breakers may open',
    affected: ['midocean', 'pf-concept', 'hubspot', 'slack'],
    mttrMin: 10,
    risk: 'low',
    recs: [
      'Verify circuit breaker thresholds',
      'Test graceful degradation UI',
      'Monitor error rate trends',
    ],
  },
  network_partition: {
    impact: 'Split-brain scenario; inter-service calls fail; consensus lost',
    affected: ['api', 'redis', 'supabase', 'bullmq', 'health'],
    mttrMin: 20,
    risk: 'high',
    recs: [
      'Test service mesh failover',
      'Validate health check thresholds',
      'Confirm write fencing mechanisms',
    ],
  },
  memory_pressure: {
    impact: 'API instances OOM; GC pauses; increased latency and OOM kills',
    affected: ['api', 'workers'],
    mttrMin: 6,
    risk: 'medium',
    recs: [
      'Review heap limits per container',
      'Enable memory profiling',
      'Test auto-scaling triggers',
    ],
  },
  latency_injection: {
    impact: 'Artificial latency added to service calls; timeout cascades possible',
    affected: ['api', 'supabase', 'redis', 'stripe'],
    mttrMin: 4,
    risk: 'low',
    recs: [
      'Verify timeout configurations',
      'Test cascade failure prevention',
      'Monitor P99 latency thresholds',
    ],
  },
};

@Injectable()
export class ChaosEngineService {
  private readonly DRILLS: DrillType[] = [
    'redis_outage',
    'db_failover',
    'stripe_timeout',
    'queue_corruption',
    'dependency_degradation',
    'network_partition',
    'memory_pressure',
    'latency_injection',
  ];

  constructor(private readonly prisma: PrismaService) {}

  getDrillTypes(): DrillType[] {
    return [...this.DRILLS];
  }

  async scheduleDrill(params: {
    drillType: string;
    targetService: string;
    config: Record<string, unknown>;
    scheduledAt: Date;
    triggeredBy: string;
    tenantId?: string;
  }): Promise<unknown> {
    return this.prisma.chaosDrill.create({
      data: {
        drillType: params.drillType,
        targetService: params.targetService,
        config: params.config as Record<string, string | number | boolean | null>,
        scheduledAt: params.scheduledAt,
        triggeredBy: params.triggeredBy,
        tenantId: params.tenantId ?? null,
        status: 'scheduled',
      },
    });
  }

  async startDrill(drillId: string): Promise<unknown> {
    return this.prisma.chaosDrill.update({
      where: { id: drillId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });
  }

  async recordObservation(drillId: string, metric: string, value: number): Promise<void> {
    const drill = await this.prisma.chaosDrill.findUniqueOrThrow({ where: { id: drillId } });
    const existing = Array.isArray(drill.observations) ? (drill.observations as Record<string, unknown>[]) : [];
    const updated: Record<string, unknown>[] = [...existing, { ts: new Date().toISOString(), metric, value }];
    await this.prisma.chaosDrill.update({
      where: { id: drillId },
      data: { observations: updated as unknown as Record<string, string | number | boolean | null>[] },
    });
  }

  async completeDrill(
    drillId: string,
    params: {
      findings?: string;
      mttrMinutes?: number;
      rtoMet?: boolean;
      rpoMet?: boolean;
    },
  ): Promise<unknown> {
    return this.prisma.chaosDrill.update({
      where: { id: drillId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        findings: params.findings ?? null,
        mttrMinutes: params.mttrMinutes ?? null,
        rtoMet: params.rtoMet ?? null,
        rpoMet: params.rpoMet ?? null,
      },
    });
  }

  async abortDrill(drillId: string, reason: string): Promise<unknown> {
    return this.prisma.chaosDrill.update({
      where: { id: drillId },
      data: {
        status: 'aborted',
        completedAt: new Date(),
        findings: `Aborted: ${reason}`,
      },
    });
  }

  async listDrills(status?: string): Promise<unknown[]> {
    return this.prisma.chaosDrill.findMany({
      where: status ? { status } : undefined,
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
  }

  async getDrillStats(): Promise<DrillStats> {
    const all = await this.prisma.chaosDrill.findMany({
      select: {
        status: true,
        drillType: true,
        mttrMinutes: true,
        rtoMet: true,
        rpoMet: true,
      },
    });

    const total = all.length;
    const completed = all.filter((d) => d.status === 'completed');
    const aborted = all.filter((d) => d.status === 'aborted').length;

    const mttrValues = completed.map((d) => d.mttrMinutes).filter((v): v is number => v !== null);
    const avgMttr =
      mttrValues.length > 0 ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length : 0;

    const rtoMeasured = completed.filter((d) => d.rtoMet !== null);
    const rtoMetRate =
      rtoMeasured.length > 0
        ? (rtoMeasured.filter((d) => d.rtoMet === true).length / rtoMeasured.length) * 100
        : 0;

    const rpoMeasured = completed.filter((d) => d.rpoMet !== null);
    const rpoMetRate =
      rpoMeasured.length > 0
        ? (rpoMeasured.filter((d) => d.rpoMet === true).length / rpoMeasured.length) * 100
        : 0;

    // Count per type
    const typeMap = new Map<string, number>();
    for (const d of all) {
      typeMap.set(d.drillType, (typeMap.get(d.drillType) ?? 0) + 1);
    }
    const drillsByType = [...typeMap.entries()].map(([drillType, count]) => ({
      drillType,
      count,
    }));

    return {
      totalDrills: total,
      completedDrills: completed.length,
      abortedDrills: aborted,
      avgMttrMinutes: Math.round(avgMttr * 10) / 10,
      rtoMetRate: Math.round(rtoMetRate * 10) / 10,
      rpoMetRate: Math.round(rpoMetRate * 10) / 10,
      drillsByType,
    };
  }

  simulateDrill(drillType: string, targetService: string): DrillSimulation {
    const base = DRILL_IMPACT_MAP[drillType];
    if (!base) {
      return {
        estimatedImpact: `Unknown drill type "${drillType}". Potential service disruption.`,
        affectedServices: [targetService],
        estimatedMttrMinutes: 15,
        riskLevel: 'medium',
        recommendations: ['Review drill type configuration before scheduling'],
      };
    }

    // Adjust estimates based on specific target service
    const highRiskTargets = ['stripe', 'supabase', 'redis'];
    const riskBoost =
      highRiskTargets.includes(targetService) && base.risk !== 'high' ? 'medium' : base.risk;

    const affected = base.affected.includes(targetService)
      ? base.affected
      : [targetService, ...base.affected];

    return {
      estimatedImpact: base.impact,
      affectedServices: affected,
      estimatedMttrMinutes: base.mttrMin,
      riskLevel: riskBoost,
      recommendations: base.recs,
    };
  }
}
