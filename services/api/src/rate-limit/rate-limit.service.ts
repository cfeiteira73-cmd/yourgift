import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitConsumer {
  key: string;
  requestCount: number;
}

type RateLimitDimension = 'ip' | 'tenant' | 'user' | 'endpoint';

/** Pre-configured rate limits: limit per windowSeconds */
const PRESET_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  auth:       { limit: 20,  windowSeconds: 60 },
  api:        { limit: 200, windowSeconds: 60 },
  scim:       { limit: 60,  windowSeconds: 60 },
  webhooks:   { limit: 100, windowSeconds: 60 },
  ai:         { limit: 10,  windowSeconds: 60 },
  simulation: { limit: 5,   windowSeconds: 60 },
};

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  redis!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('UPSTASH_REDIS_URL') ??
      this.config.get<string>('REDIS_URL') ??
      'redis://localhost:6379';

    const tlsOpts =
      url.startsWith('rediss://')
        ? { tls: { rejectUnauthorized: false } }
        : {};

    this.redis = new Redis(url, {
      ...tlsOpts,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis rate-limit connection error', err.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /**
   * Sliding-window rate limit using a Redis sorted set.
   * Key format: rl:{dimension}:{identifier}
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const resetAt = new Date(now + windowSeconds * 1000);

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;
    const remaining = Math.max(0, limit - count);

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
    };
  }

  /** Build a rate-limit key from dimension + identifier */
  buildKey(dimension: RateLimitDimension, identifier: string): string {
    return `rl:${dimension}:${identifier}`;
  }

  /** Check preset rate limit by name (auth, api, scim, etc.) */
  async checkPreset(
    presetName: string,
    dimension: RateLimitDimension,
    identifier: string,
  ): Promise<RateLimitResult> {
    const preset = PRESET_LIMITS[presetName] ?? PRESET_LIMITS['api'];
    const key = this.buildKey(dimension, identifier);
    return this.checkLimit(key, preset.limit, preset.windowSeconds);
  }

  /** Returns true if identifier has exceeded 10x normal limit in the last minute */
  async isAbuse(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - 60 * 1000;
    const count = await this.redis.zcount(key, windowStart, '+inf');
    // Abuse if 10x the most permissive limit (api = 200)
    return count > 200 * 10;
  }

  /** Top 20 consumers across all rl:* sorted sets */
  async getRateLimitStats(): Promise<RateLimitConsumer[]> {
    const now = Date.now();
    const windowStart = now - 60 * 1000;

    const keys = await this.redis.keys('rl:*');
    const top20 = keys.slice(0, 20);

    const results: RateLimitConsumer[] = [];
    for (const key of top20) {
      const count = await this.redis.zcount(key, windowStart, '+inf');
      results.push({ key, requestCount: count });
    }

    return results.sort((a, b) => b.requestCount - a.requestCount);
  }
}
