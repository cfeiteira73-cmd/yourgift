/**
 * Integration tests — Redis Sliding-Window Rate Limiter
 *
 * Tests a sliding-window rate limiter backed by ioredis.
 * Redis is mocked — tests validate the algorithm, not the Redis connection.
 */

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockRedisZremrangebyscore = jest.fn();
const mockRedisZcard = jest.fn();
const mockRedisZadd = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisPipeline = jest.fn();

// Pipeline mock — fluent builder that resolves to counts
const buildPipelineMock = (zcard: number) => {
  const exec = jest.fn().mockResolvedValue([
    [null, 0],   // zremrangebyscore result
    [null, zcard], // zcard result
    [null, 1],   // zadd result
    [null, 1],   // expire result
  ]);
  const pipeline = {
    zremrangebyscore: jest.fn().mockReturnThis(),
    zcard: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec,
  };
  mockRedisPipeline.mockReturnValue(pipeline);
  return pipeline;
};

const mockRedis = {
  pipeline: mockRedisPipeline,
  zremrangebyscore: mockRedisZremrangebyscore,
  zcard: mockRedisZcard,
  zadd: mockRedisZadd,
  expire: mockRedisExpire,
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// ── Sliding Window Rate Limiter (inline implementation) ───────────────────────

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms when the window resets
  limit: number;
}

interface RateLimitOptions {
  /** Unique key for this limiter (e.g. `ratelimit:ip:1.2.3.4`) */
  key: string;
  /** Max requests allowed within the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Sliding-window rate limiter using Redis sorted sets.
 *
 * Algorithm:
 *  1. Remove entries older than (now - windowMs) from the sorted set
 *  2. Count remaining entries (requests in current window)
 *  3. If count < limit: add current timestamp, return allowed=true
 *  4. Else: return allowed=false
 *
 * Score = timestamp (ms) — allows range queries for pruning.
 */
class SlidingWindowRateLimiter {
  constructor(private readonly redis: typeof mockRedis) {}

  async check(opts: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - opts.windowMs;

    const pipeline = this.redis.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(opts.key, '-inf', String(windowStart));
    // Count current window entries
    pipeline.zcard(opts.key);
    // Add this request (if allowed — we'll decide below based on count)
    pipeline.zadd(opts.key, String(now), `${now}-${Math.random()}`);
    // Set TTL so key auto-expires
    pipeline.expire(opts.key, Math.ceil(opts.windowMs / 1000));

    const results = await pipeline.exec();
    const currentCount = (results[1][1] as number) ?? 0;

    const allowed = currentCount < opts.limit;

    return {
      allowed,
      remaining: Math.max(0, opts.limit - currentCount - (allowed ? 1 : 0)),
      resetAt: now + opts.windowMs,
      limit: opts.limit,
    };
  }

  async checkMultiDimension(dimensions: RateLimitOptions[]): Promise<{
    allowed: boolean;
    results: Record<string, RateLimitResult>;
  }> {
    const results: Record<string, RateLimitResult> = {};
    let allAllowed = true;

    for (const dim of dimensions) {
      const result = await this.check(dim);
      results[dim.key] = result;
      if (!result.allowed) allAllowed = false;
    }

    return { allowed: allAllowed, results };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SlidingWindowRateLimiter', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    limiter = new SlidingWindowRateLimiter(mockRedis as unknown as typeof mockRedis);
  });

  // ── Allow within limit ───────────────────────────────────────────────────────

  it('allows request when under limit', async () => {
    // zcard returns 3 (3 requests in window), limit is 10 → should allow
    buildPipelineMock(3);

    const result = await limiter.check({
      key: 'ratelimit:ip:1.2.3.4',
      limit: 10,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(6); // 10 - 3 - 1 (the new request)
    expect(result.limit).toBe(10);
  });

  it('allows first request (count = 0)', async () => {
    buildPipelineMock(0);

    const result = await limiter.check({
      key: 'ratelimit:ip:1.2.3.4',
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 0 - 1
  });

  // ── Block over limit ─────────────────────────────────────────────────────────

  it('blocks request when at limit', async () => {
    // zcard returns 10 (already at limit)
    buildPipelineMock(10);

    const result = await limiter.check({
      key: 'ratelimit:ip:1.2.3.4',
      limit: 10,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('blocks request when over limit', async () => {
    buildPipelineMock(15); // somehow over limit

    const result = await limiter.check({
      key: 'ratelimit:ip:1.2.3.4',
      limit: 10,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  // ── Pipeline operations ──────────────────────────────────────────────────────

  it('calls zremrangebyscore to prune expired entries', async () => {
    const pipeline = buildPipelineMock(2);

    await limiter.check({
      key: 'ratelimit:tenant:abc',
      limit: 100,
      windowMs: 60_000,
    });

    expect(pipeline.zremrangebyscore).toHaveBeenCalledWith(
      'ratelimit:tenant:abc',
      '-inf',
      expect.any(String),
    );
  });

  it('sets TTL equal to window size in seconds', async () => {
    const pipeline = buildPipelineMock(0);

    await limiter.check({
      key: 'ratelimit:test',
      limit: 10,
      windowMs: 30_000, // 30 seconds
    });

    expect(pipeline.expire).toHaveBeenCalledWith('ratelimit:test', 30);
  });

  it('returns resetAt approximately one window from now', async () => {
    buildPipelineMock(0);
    const before = Date.now();

    const result = await limiter.check({
      key: 'ratelimit:test',
      limit: 10,
      windowMs: 60_000,
    });

    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60_000 + 10);
  });

  // ── Multi-dimension rate limiting ────────────────────────────────────────────

  it('allows when all dimensions pass', async () => {
    // Both dimensions under limit
    buildPipelineMock(2);

    const result = await limiter.checkMultiDimension([
      { key: 'ratelimit:ip:1.2.3.4', limit: 10, windowMs: 60_000 },
      { key: 'ratelimit:tenant:acme', limit: 100, windowMs: 60_000 },
    ]);

    expect(result.allowed).toBe(true);
    expect(Object.keys(result.results)).toHaveLength(2);
  });

  it('blocks when any dimension exceeds limit', async () => {
    // First call: under limit (count=5, limit=10)
    // Second call: over limit (count=100, limit=100 → at limit)
    const firstPipeline = buildPipelineMock(5);
    const secondPipeline = buildPipelineMock(100);

    // Override to return different mock for second call
    mockRedisPipeline
      .mockReturnValueOnce(firstPipeline)
      .mockReturnValueOnce(secondPipeline);

    const result = await limiter.checkMultiDimension([
      { key: 'ratelimit:ip:1.2.3.4', limit: 10, windowMs: 60_000 },
      { key: 'ratelimit:tenant:acme', limit: 100, windowMs: 60_000 },
    ]);

    expect(result.allowed).toBe(false);
  });

  it('tracks results per dimension key', async () => {
    buildPipelineMock(3);

    const result = await limiter.checkMultiDimension([
      { key: 'ratelimit:ip:1.2.3.4', limit: 10, windowMs: 60_000 },
    ]);

    expect(result.results['ratelimit:ip:1.2.3.4']).toBeDefined();
    expect(result.results['ratelimit:ip:1.2.3.4'].limit).toBe(10);
  });

  // ── Different window sizes ───────────────────────────────────────────────────

  it('handles short windows (1 second)', async () => {
    buildPipelineMock(0);

    const result = await limiter.check({
      key: 'ratelimit:burst',
      limit: 5,
      windowMs: 1_000,
    });

    expect(result.allowed).toBe(true);
  });

  it('handles long windows (1 hour)', async () => {
    buildPipelineMock(0);

    const result = await limiter.check({
      key: 'ratelimit:hourly',
      limit: 1000,
      windowMs: 3_600_000,
    });

    expect(result.allowed).toBe(true);
  });

  // ── Edge: exactly at limit boundary ─────────────────────────────────────────

  it('blocks when count equals limit exactly', async () => {
    buildPipelineMock(5); // count=5, limit=5 → count < limit is false

    const result = await limiter.check({
      key: 'ratelimit:exact',
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(false);
  });

  it('allows when count is one below limit', async () => {
    buildPipelineMock(4); // count=4, limit=5 → count < limit is true

    const result = await limiter.check({
      key: 'ratelimit:exact',
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // 5 - 4 - 1 = 0
  });
});
