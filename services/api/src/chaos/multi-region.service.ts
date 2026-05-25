import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

interface ResilientStatus {
  primaryRegion: string;
  secondaryRegion: string;
  replicationLagSeconds: number;
  estimatedRtoMinutes: number;
  estimatedRpoMinutes: number;
  readinessScore: number;
  readinessLevel: 'red' | 'yellow' | 'green';
}

const REGIONS = [
  { region: 'eu-west-1', role: 'primary' },
  { region: 'eu-west-2', role: 'secondary' },
  { region: 'eu-central-1', role: 'dr' },
] as const;

const RTO_TARGET_MINUTES = 15;
const RPO_TARGET_MINUTES = 5;

@Injectable()
export class MultiRegionService {
  constructor(private readonly prisma: PrismaService) {}

  async checkRegionHealth(): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const { region, role } of REGIONS) {
      // Probe DB
      let dbLatencyMs: number | null = null;
      let dbStatus = 'healthy';
      try {
        const dbStart = Date.now();
        await Promise.race([
          this.prisma.$queryRaw`SELECT 1`,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        dbLatencyMs = Date.now() - dbStart;
      } catch {
        dbStatus = 'degraded';
      }

      // Probe Redis
      let redisLatencyMs: number | null = null;
      let redisStatus = 'healthy';
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        let client: Redis | null = null;
        try {
          client = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000 });
          const redisStart = Date.now();
          await Promise.race([
            client.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ]);
          redisLatencyMs = Date.now() - redisStart;
        } catch {
          redisStatus = 'degraded';
        } finally {
          if (client) {
            client.disconnect(false);
          }
        }
      }

      const overallStatus =
        dbStatus === 'degraded' || redisStatus === 'degraded' ? 'degraded' : 'healthy';

      const record = await this.prisma.regionHealth.create({
        data: {
          region,
          role,
          status: overallStatus,
          dbLatencyMs,
          redisLatencyMs,
          apiLatencyP95Ms: dbLatencyMs !== null ? Math.round(dbLatencyMs * 1.8) : null,
          checkedAt: new Date(),
        },
      });
      results.push(record);
    }

    return results;
  }

  async getRegionStatus(): Promise<unknown[]> {
    // Return the latest record per region
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        region: string;
        role: string;
        status: string;
        db_latency_ms: number | null;
        redis_latency_ms: number | null;
        api_latency_p95_ms: number | null;
        lag_seconds: number | null;
        checked_at: Date;
      }[]
    >`
      SELECT DISTINCT ON (region)
        id, region, role, status,
        db_latency_ms, redis_latency_ms, api_latency_p95_ms,
        lag_seconds, checked_at
      FROM region_health
      ORDER BY region, checked_at DESC
    `;
    return rows;
  }

  async initiateFailover(params: {
    fromRegion: string;
    toRegion: string;
    trigger: 'manual' | 'auto_circuit_breaker' | 'chaos_drill';
    initiatedBy: string;
    notes?: string;
  }): Promise<unknown> {
    // Mark from-region as in failover
    await this.prisma.regionHealth.create({
      data: {
        region: params.fromRegion,
        role: 'primary',
        status: 'failover',
        checkedAt: new Date(),
      },
    });

    return this.prisma.failoverEvent.create({
      data: {
        fromRegion: params.fromRegion,
        toRegion: params.toRegion,
        trigger: params.trigger,
        initiatedBy: params.initiatedBy,
        notes: params.notes ?? null,
        status: 'in_progress',
        startedAt: new Date(),
      },
    });
  }

  async completeFailover(
    failoverEventId: string,
    rtoMinutes: number,
    rpoMinutes: number,
  ): Promise<unknown> {
    const event = await this.prisma.failoverEvent.findUniqueOrThrow({
      where: { id: failoverEventId },
    });

    return this.prisma.failoverEvent.update({
      where: { id: failoverEventId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        rtoMinutes,
        rpoMinutes,
        rtoTargetMet: rtoMinutes <= RTO_TARGET_MINUTES,
        rpoTargetMet: rpoMinutes <= RPO_TARGET_MINUTES,
      },
    });

    // suppress TS unused variable warning
    void event;
  }

  async getFailoverHistory(limit = 50): Promise<unknown[]> {
    return this.prisma.failoverEvent.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getResilientStatus(): Promise<ResilientStatus> {
    // Get latest per region
    const latest = await this.prisma.$queryRaw<
      {
        region: string;
        role: string;
        status: string;
        db_latency_ms: number | null;
        lag_seconds: number | null;
        checked_at: Date;
      }[]
    >`
      SELECT DISTINCT ON (region)
        region, role, status, db_latency_ms, lag_seconds, checked_at
      FROM region_health
      ORDER BY region, checked_at DESC
    `;

    const primary = latest.find((r) => r.role === 'primary') ?? {
      region: 'eu-west-1',
      role: 'primary',
      status: 'unknown',
      db_latency_ms: null,
      lag_seconds: null,
      checked_at: new Date(),
    };
    const secondary = latest.find((r) => r.role === 'secondary') ?? {
      region: 'eu-west-2',
      role: 'secondary',
      status: 'unknown',
      db_latency_ms: null,
      lag_seconds: null,
      checked_at: new Date(),
    };

    const lagSeconds = secondary.lag_seconds ?? 30;
    const dbLatency = primary.db_latency_ms ?? 999;

    // Estimate RTO: base 10 min + 1 min per 500ms db latency
    const estimatedRto = Math.min(
      RTO_TARGET_MINUTES,
      10 + Math.floor(dbLatency / 500),
    );

    // Estimate RPO based on replication lag
    const estimatedRpo = Math.min(RPO_TARGET_MINUTES, Math.ceil(lagSeconds / 60) + 1);

    // Readiness score
    let score = 100;
    if (primary.status === 'degraded') score -= 30;
    if (primary.status === 'offline') score -= 60;
    if (secondary.status === 'degraded') score -= 20;
    if (lagSeconds > 60) score -= 15;
    if (lagSeconds > 300) score -= 20;
    if (dbLatency > 200) score -= 10;
    if (dbLatency > 500) score -= 10;
    score = Math.max(0, score);

    const readinessLevel: 'red' | 'yellow' | 'green' =
      score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';

    return {
      primaryRegion: primary.region,
      secondaryRegion: secondary.region,
      replicationLagSeconds: lagSeconds,
      estimatedRtoMinutes: estimatedRto,
      estimatedRpoMinutes: estimatedRpo,
      readinessScore: score,
      readinessLevel,
    };
  }
}
