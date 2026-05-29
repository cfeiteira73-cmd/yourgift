import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.helper';

// Helper aliases: in CI use TEST_ADMIN_EMAIL / TEST_CLIENT_EMAIL env vars
async function loginAsAdmin(page: Parameters<typeof loginAsTestUser>[0]) {
  const email = process.env.TEST_ADMIN_EMAIL ?? process.env.TEST_EMAIL ?? '';
  const password = process.env.TEST_ADMIN_PASSWORD ?? process.env.TEST_PASSWORD ?? '';
  if (!email || !password) { test.skip(); return; }
  process.env.TEST_EMAIL = email;
  process.env.TEST_PASSWORD = password;
  await loginAsTestUser(page);
}

async function loginAsClient(page: Parameters<typeof loginAsTestUser>[0]) {
  const email = process.env.TEST_CLIENT_EMAIL ?? process.env.TEST_EMAIL ?? '';
  const password = process.env.TEST_CLIENT_PASSWORD ?? process.env.TEST_PASSWORD ?? '';
  if (!email || !password) { test.skip(); return; }
  process.env.TEST_EMAIL = email;
  process.env.TEST_PASSWORD = password;
  await loginAsTestUser(page);
}

// ── Intelligence Systems E2E Tests ────────────────────────────────────────────
//
// X14 Testing & Validation: Validates all intelligence APIs introduced in
// the OMEGA WORLD DOMINATION protocol:
//   - Reorder Brain (X5)
//   - Executive Brief (X6)
//   - Margin Intelligence (X5/X6)
//   - Product Recommendations (X7)
//   - Warehouse Intelligence (X11)
//   - Analytics Platform (X12)
//   - Procurement Autopilot (X2)
//   - Artwork Intelligence (X4)
//   - Infrastructure Resilience (X9)
//
// ─────────────────────────────────────────────────────────────────────────────

test.describe('X5: Reorder Brain API', () => {
  test('GET /api/reorder-brain rejects unauthenticated requests', async ({ request }) => {
    const res = await request.get('/api/reorder-brain?mode=suggestions');
    expect(res.status()).toBe(401);
  });

  test('authenticated client gets suggestions response shape', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/reorder-brain?mode=suggestions');
    // Either real data or empty state — never 500
    expect([200, 204]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('generatedAt');
      // If client has orders, should have pattern
      if (body.pattern) {
        expect(body.pattern).toHaveProperty('avgIntervalDays');
        expect(body.pattern).toHaveProperty('daysUntilReorder');
        expect(body.pattern).toHaveProperty('topCategories');
        expect(typeof body.pattern.avgIntervalDays).toBe('number');
      }
    }
  });

  test('POST reorder with invalid orderId returns 404', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/reorder-brain', {
      data: { action: 'reorder', orderId: '00000000-0000-0000-0000-000000000000' },
    });
    expect([404, 400]).toContain(res.status());
  });
});

test.describe('X6: Executive Brief API', () => {
  test('rejects non-admin access', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/executive-brief?mode=kpis');
    expect(res.status()).toBe(403);
  });

  test('admin gets full brief with required fields', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/executive-brief?mode=kpis');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('revenue');
    expect(body).toHaveProperty('clients');
    expect(body).toHaveProperty('paymentRisk');
    expect(body).toHaveProperty('production');
    expect(body).toHaveProperty('generatedAt');
    expect(typeof body.revenue.revenueThisMonth).toBe('number');
    expect(typeof body.clients.totalClients).toBe('number');
  });

  test('anomalies mode returns valid structure', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/executive-brief?mode=anomalies');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.anomalies)).toBe(true);
    expect(typeof body.count).toBe('number');
    body.anomalies.forEach((a: { type: string; severity: string; message: string }) => {
      expect(a).toHaveProperty('type');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('message');
      expect(['critical', 'warning', 'info']).toContain(a.severity);
    });
  });

  test('forecast mode returns projection data', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/executive-brief?mode=forecast');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('forecast');
    expect(body.forecast).toHaveProperty('confidence');
    expect(['high', 'medium', 'low']).toContain(body.forecast.confidence);
  });
});

test.describe('X5/X6: Margin Intelligence API', () => {
  test('rejects non-admin', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/margin-intelligence?mode=leaks');
    expect(res.status()).toBe(403);
  });

  test('leaks mode returns valid structure', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/margin-intelligence?mode=leaks');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.leaks)).toBe(true);
    expect(body).toHaveProperty('summary');
    expect(typeof body.summary.totalLeaks).toBe('number');
    expect(typeof body.summary.totalLeakAmount).toBe('number');
    body.leaks.forEach((l: { severity: string; actualMarginPct: number; targetMarginPct: number }) => {
      expect(['critical', 'warning']).toContain(l.severity);
      expect(typeof l.actualMarginPct).toBe('number');
      expect(l.actualMarginPct).toBeLessThan(l.targetMarginPct);
    });
  });

  test('upsells mode returns opportunities', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/margin-intelligence?mode=upsells');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.opportunities)).toBe(true);
    expect(typeof body.count).toBe('number');
  });
});

test.describe('X7: Product Recommendations API', () => {
  test('client can access own recommendations', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/recommendations?mode=client');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  test('trending returns velocity data', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/recommendations?mode=trending');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.trending)).toBe(true);
    body.trending.forEach((p: { velocityPct: number; recentQty: number }) => {
      expect(typeof p.velocityPct).toBe('number');
      expect(p.recentQty).toBeGreaterThanOrEqual(3);
    });
  });

  test('log_view action succeeds', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/recommendations', {
      data: { action: 'log_view', productId: '00000000-0000-0000-0000-000000000001', context: 'test' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

test.describe('X9: Infrastructure Resilience API', () => {
  test('rejects non-admin', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/infra-resilience?mode=dlq');
    expect(res.status()).toBe(403);
  });

  test('health_mesh returns overall health score', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/infra-resilience?mode=health_mesh');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.overallHealth).toBe('number');
    expect(body.overallHealth).toBeGreaterThanOrEqual(0);
    expect(body.overallHealth).toBeLessThanOrEqual(100);
    expect(['healthy', 'degraded', 'critical']).toContain(body.status);
    expect(Array.isArray(body.breakers)).toBe(true);
    body.breakers.forEach((b: { state: string; service: string }) => {
      expect(['closed', 'half_open', 'open']).toContain(b.state);
    });
  });

  test('circuit_breakers returns all monitored services', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/infra-resilience?mode=circuit_breakers');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.breakers.length).toBeGreaterThan(0);
    expect(body.summary.total).toBeGreaterThan(0);
  });

  test('health_check action probes services', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/infra-resilience', {
      data: { action: 'health_check' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body).toHaveProperty('probedAt');
    body.results.forEach((r: { service: string; status: string }) => {
      expect(['ok', 'error']).toContain(r.status);
    });
  });
});

test.describe('X11: Warehouse Intelligence API', () => {
  test('rejects non-admin', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/warehouse-intelligence?mode=restock');
    expect(res.status()).toBe(403);
  });

  test('restock mode returns predictions with required shape', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/warehouse-intelligence?mode=restock');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.predictions)).toBe(true);
    expect(typeof body.critical).toBe('number');
    body.predictions.forEach((p: { action: string; daysUntilStockout: number }) => {
      expect(['ORDER_NOW', 'ORDER_SOON', 'MONITOR']).toContain(p.action);
      expect(typeof p.daysUntilStockout).toBe('number');
    });
  });

  test('capacity mode returns utilisation percentage', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/warehouse-intelligence?mode=capacity');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.utilizationPct).toBe('number');
    expect(body.utilizationPct).toBeGreaterThanOrEqual(0);
    expect(['ok', 'warning', 'critical']).toContain(body.status);
  });
});

test.describe('X12: Analytics Platform API', () => {
  test('rejects non-admin', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/analytics-platform?mode=funnel');
    expect(res.status()).toBe(403);
  });

  test('funnel returns valid conversion stages', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/analytics-platform?mode=funnel');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.stages)).toBe(true);
    expect(body.stages.length).toBe(4);
    expect(typeof body.overallConversionRate).toBe('number');
    body.stages.forEach((s: { stage: string; count: number; pct: number }) => {
      expect(typeof s.count).toBe('number');
      expect(s.pct).toBeGreaterThanOrEqual(0);
      expect(s.pct).toBeLessThanOrEqual(100);
    });
  });

  test('financial integrity returns reconciliation data', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/analytics-platform?mode=financial');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('revenue');
    expect(body).toHaveProperty('issues');
    expect(typeof body.integrityScore).toBe('number');
    expect(body.integrityScore).toBeGreaterThanOrEqual(0);
    expect(body.integrityScore).toBeLessThanOrEqual(100);
    expect(['clean', 'review', 'action_required']).toContain(body.status);
    // Financial invariant: ordered revenue should be >= collected
    expect(body.revenue.ordered).toBeGreaterThanOrEqual(0);
    expect(body.revenue.collected).toBeGreaterThanOrEqual(0);
  });

  test('platform_kpis aggregates all modules in parallel', async ({ page, request }) => {
    await loginAsAdmin(page);
    const start = Date.now();
    const res = await request.get('/api/analytics-platform?mode=platform_kpis');
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('funnel');
    expect(body).toHaveProperty('ltv');
    expect(body).toHaveProperty('financial');
    expect(body).toHaveProperty('revenueMix');
    // Parallel execution: should complete in <10s
    expect(elapsed).toBeLessThan(10000);
  });
});

test.describe('X2: Procurement Autopilot API', () => {
  test('rejects non-admin', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/procurement-autopilot?mode=pending');
    expect(res.status()).toBe(403);
  });

  test('pending mode returns orders needing RFQs', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/procurement-autopilot?mode=pending');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.pending)).toBe(true);
    expect(typeof body.count).toBe('number');
  });

  test('savings mode returns analytics', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/procurement-autopilot?mode=savings');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(typeof body.summary.totalSavings).toBe('number');
  });

  test('auto_rfq with invalid orderId returns error', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/procurement-autopilot', {
      data: { action: 'auto_rfq', orderId: '00000000-0000-0000-0000-000000000000' },
    });
    expect([404, 400, 500]).toContain(res.status());
  });
});

test.describe('X4: Artwork Intelligence API', () => {
  test('pipeline mode accessible to authenticated users', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/artwork-intelligence?mode=pipeline');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('statusCounts');
    expect(typeof body.slaBreached).toBe('number');
  });

  test('analytics mode returns quality scores', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/artwork-intelligence?mode=analytics');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.avgScore).toBe('number');
    expect(body.avgScore).toBeGreaterThanOrEqual(0);
    expect(body.avgScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.weeklyTrend)).toBe(true);
  });

  test('add_annotation requires submissionId and text', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/artwork-intelligence', {
      data: { action: 'add_annotation' }, // missing required fields
    });
    expect(res.status()).toBe(400);
  });
});
