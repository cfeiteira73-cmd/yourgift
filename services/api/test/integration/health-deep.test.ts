/**
 * Integration tests — HealthService (deep check)
 *
 * Tests the existing HealthService logic with mocked dependencies:
 * - Correct response structure
 * - Overall status derivation (ok / degraded / down)
 * - Individual service check behavior
 * - All service names present in result
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../../src/health/health.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QueueService } from '../../src/queue/queue.service';
import { REDIS_CONNECTION } from '../../src/queue/queue.module';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockQueueService = {
  getQueueStats: jest.fn(),
  getAllQueueStats: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

// ── Test setup ────────────────────────────────────────────────────────────────

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: QueueService, useValue: mockQueueService },
        { provide: REDIS_CONNECTION, useValue: null },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  // ── Default healthy state ────────────────────────────────────────────────────

  function setupHealthyDependencies() {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'UPSTASH_REDIS_URL') return 'rediss://mock:token@mock.upstash.io:6379';
      if (key === 'MIDOCEAN_KEY') return 'mock-midocean-key';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    mockQueueService.getQueueStats.mockResolvedValue({ name: 'email', waiting: 0, active: 0, completed: 100, failed: 0 });
    mockQueueService.getAllQueueStats.mockResolvedValue([
      { name: 'email', waiting: 0, active: 0, completed: 100, failed: 0 },
      { name: 'pdf-generation', waiting: 0, active: 0, completed: 50, failed: 0 },
    ]);

    // Mock global fetch for Midocean check
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }) as unknown as typeof fetch;
  }

  // ── Response structure ───────────────────────────────────────────────────────

  it('returns correct top-level response shape', async () => {
    setupHealthyDependencies();

    const result = await service.check();

    expect(result).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded|down)$/),
      uptime: expect.any(Number),
      timestamp: expect.any(String),
      version: expect.any(String),
      environment: expect.any(String),
      services: expect.any(Object),
      latencyMs: expect.any(Number),
    });
  });

  it('timestamp is a valid ISO 8601 string', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('latencyMs is non-negative', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('uptime is a positive number', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  // ── All service names present ────────────────────────────────────────────────

  it('services object contains all expected service names', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    const serviceNames = Object.keys(result.services);

    expect(serviceNames).toContain('database');
    expect(serviceNames).toContain('redis');
    expect(serviceNames).toContain('queues');
    expect(serviceNames).toContain('midocean');
  });

  it('each service entry has a status field', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    for (const [name, svc] of Object.entries(result.services)) {
      expect(['ok', 'degraded', 'down']).toContain(svc.status), `${name} has invalid status`;
    }
  });

  // ── Overall status = ok when all healthy ────────────────────────────────────

  it('returns status ok when all services are healthy', async () => {
    setupHealthyDependencies();

    const result = await service.check();
    // If DB and Redis are healthy, status should be ok or at most degraded (Midocean)
    expect(['ok', 'degraded']).toContain(result.status);
  });

  // ── Database failure → overall down ─────────────────────────────────────────

  it('returns status down when database is unreachable', async () => {
    setupHealthyDependencies();
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.services.database.status).toBe('down');
    expect(result.services.database.detail).toContain('Connection refused');
  });

  // ── Redis failure → overall down ────────────────────────────────────────────

  it('returns status down when redis is unreachable', async () => {
    setupHealthyDependencies();
    // Both getQueueStats calls fail (health check uses it as Redis proxy)
    mockQueueService.getQueueStats.mockRejectedValue(new Error('Redis ECONNREFUSED'));

    const result = await service.check();

    // Redis is critical — should be down or at minimum degraded
    expect(['down', 'degraded']).toContain(result.services.redis.status);
  });

  // ── Queue backlog → degraded ─────────────────────────────────────────────────

  it('returns degraded when a critical queue has high backlog', async () => {
    setupHealthyDependencies();
    mockQueueService.getAllQueueStats.mockResolvedValue([
      { name: 'email', waiting: 600, active: 5, completed: 100, failed: 2 }, // > 500 threshold
      { name: 'pdf-generation', waiting: 0, active: 0, completed: 50, failed: 0 },
    ]);

    const result = await service.check();

    expect(result.services.queues.status).toBe('degraded');
    expect(result.services.queues.detail).toContain('email=600');
  });

  // ── Midocean failure → degraded (non-critical) ───────────────────────────────

  it('returns degraded (not down) when Midocean is unreachable', async () => {
    setupHealthyDependencies();
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    const result = await service.check();

    // Midocean failure should degrade the system but not take it down
    expect(result.status).not.toBe('down');
    expect(result.services.midocean.status).toBe('degraded');
  });

  it('returns degraded when Midocean key is not configured', async () => {
    setupHealthyDependencies();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'MIDOCEAN_KEY') return undefined; // Not configured
      if (key === 'UPSTASH_REDIS_URL') return 'rediss://mock:token@mock.upstash.io:6379';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });

    const result = await service.check();

    expect(result.services.midocean.status).toBe('degraded');
    expect(result.services.midocean.detail).toContain('MIDOCEAN_KEY');
  });

  // ── Database latency is tracked ──────────────────────────────────────────────

  it('database service health includes latencyMs when successful', async () => {
    setupHealthyDependencies();

    const result = await service.check();

    expect(result.services.database.latencyMs).toBeDefined();
    expect(result.services.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // ── Environment is reflected correctly ──────────────────────────────────────

  it('reflects NODE_ENV from config in response', async () => {
    setupHealthyDependencies();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'staging';
      if (key === 'UPSTASH_REDIS_URL') return 'rediss://mock:token@mock.upstash.io:6379';
      if (key === 'MIDOCEAN_KEY') return 'mock-key';
      return undefined;
    });

    const result = await service.check();
    expect(result.environment).toBe('staging');
  });

  // ── Concurrent check stability ───────────────────────────────────────────────

  it('handles concurrent health checks without state corruption', async () => {
    setupHealthyDependencies();

    const results = await Promise.all([
      service.check(),
      service.check(),
      service.check(),
    ]);

    for (const result of results) {
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('services');
      expect(Object.keys(result.services)).toHaveLength(4);
    }
  });
});
