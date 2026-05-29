/**
 * Cross-instance rate limiter backed by Upstash Redis.
 *
 * Falls back to in-process Map when UPSTASH_REDIS_REST_URL / TOKEN are not
 * configured (local dev or missing env). This ensures zero-disruption deployment.
 *
 * Uses a sliding window algorithm via Redis INCR + EXPIRE:
 *   - Each key stores a counter per fixed window
 *   - Atomic INCR with TTL ensures consistency across serverless instances
 *
 * Usage:
 *   import { checkRateLimitRedis } from '@/lib/rate-limit-redis';
 *   const { limited, remaining } = await checkRateLimitRedis(`copilot:${userId}`, 30, 60);
 *   if (limited) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
 */

import { Redis } from '@upstash/redis';
import { checkRateLimitFast } from './rate-limit';

// Lazy singleton — only instantiated if env vars exist
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Cross-instance sliding window rate limit.
 *
 * @param identifier - Unique key per user+route (e.g. `"copilot:${userId}"`)
 * @param limit      - Max requests per window
 * @param windowSec  - Window duration in seconds
 */
export async function checkRateLimitRedis(
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<{ limited: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  const now = Date.now();
  const windowKey = `rl:${identifier}:${Math.floor(now / (windowSec * 1000))}`;
  const resetAt = (Math.floor(now / (windowSec * 1000)) + 1) * windowSec * 1000;

  // No Redis configured — fall back to fast in-process limiter
  if (!redis) {
    const result = checkRateLimitFast(identifier, limit, windowSec);
    return { ...result, resetAt };
  }

  try {
    // INCR + EXPIRE in a pipeline (atomic)
    const pipeline = redis.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSec + 1); // +1s grace
    const [count] = await pipeline.exec() as [number, number];

    if (count > limit) {
      return { limited: true, remaining: 0, resetAt };
    }
    return { limited: false, remaining: limit - count, resetAt };
  } catch {
    // Redis error — fall back to in-process limiter silently
    const result = checkRateLimitFast(identifier, limit, windowSec);
    return { ...result, resetAt };
  }
}

/**
 * Rate limit guard with automatic 429 response header injection.
 * Returns null if not limited, or a { limited: true, headers } object.
 */
export async function rateLimitGuard(
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<{ limited: false } | { limited: true; retryAfter: number; headers: Record<string, string> }> {
  const { limited, remaining, resetAt } = await checkRateLimitRedis(identifier, limit, windowSec);
  if (!limited) return { limited: false };

  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return {
    limited: true,
    retryAfter,
    headers: {
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    },
  };
}
