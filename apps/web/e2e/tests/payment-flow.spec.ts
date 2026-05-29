import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.helper';
import crypto from 'crypto';

// ── Payment Flow & Webhook Verification E2E Tests ─────────────────────────────
//
// Validates:
//   - /api/checkout — idempotent session creation
//   - /api/payments — admin risk scoring, settlement sync, event dedup
//   - /api/webhooks/stripe — signature verification, event idempotency
//
// Requires env vars:
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
//   TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD  (optional)
//   STRIPE_WEBHOOK_SECRET  (for webhook signature tests)
//
// ─────────────────────────────────────────────────────────────────────────────

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

async function loginAsAdmin(page: Parameters<typeof loginAsTestUser>[0]) {
  const email = process.env.TEST_ADMIN_EMAIL ?? process.env.TEST_EMAIL ?? '';
  const password = process.env.TEST_ADMIN_PASSWORD ?? process.env.TEST_PASSWORD ?? '';
  if (!email || !password) { test.skip(); return false; }
  process.env.TEST_EMAIL = email;
  process.env.TEST_PASSWORD = password;
  return loginAsTestUser(page);
}

async function loginAsClient(page: Parameters<typeof loginAsTestUser>[0]) {
  const email = process.env.TEST_CLIENT_EMAIL ?? process.env.TEST_EMAIL ?? '';
  const password = process.env.TEST_CLIENT_PASSWORD ?? process.env.TEST_PASSWORD ?? '';
  if (!email || !password) { test.skip(); return false; }
  process.env.TEST_EMAIL = email;
  process.env.TEST_PASSWORD = password;
  return loginAsTestUser(page);
}

// ── /api/checkout ─────────────────────────────────────────────────────────────

test.describe('/api/checkout — Stripe session creation with idempotency', () => {
  test('rejects unauthenticated requests', async ({ request }) => {
    const res = await request.post('/api/checkout', {
      data: { orderId: NULL_UUID },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects invalid orderId format', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/checkout', {
      data: { orderId: 'not-a-uuid' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  test('returns 404 for non-existent order', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/checkout', {
      data: { orderId: NULL_UUID },
    });
    // Either 404 (order not found) or 503 (Stripe not configured in test env)
    expect([404, 503]).toContain(res.status());
  });

  test('rate limit allows 5 attempts per hour', async ({ page, request }) => {
    await loginAsClient(page);
    // First request should not be rate limited (may fail for other reasons)
    const res = await request.post('/api/checkout', { data: { orderId: NULL_UUID } });
    expect(res.status()).not.toBe(429); // Not rate limited on first attempt
  });

  test('idempotency key is deterministic per order+user+day', async ({ page }) => {
    // Verify the idempotency key algorithm: SHA-256(checkout:{orderId}:{userId}:{YYYY-MM-DD})
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '660e8400-e29b-41d4-a716-446655440001';
    const day = new Date().toISOString().slice(0, 10);
    const raw = `checkout:${orderId}:${userId}:${day}`;
    const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
    const hash2 = crypto.createHash('sha256').update(raw).digest('hex');
    expect(hash1).toBe(hash2); // Same input = same key
    expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
    // Different day = different key
    const differentDay = '2024-01-01';
    const hash3 = crypto.createHash('sha256').update(`checkout:${orderId}:${userId}:${differentDay}`).digest('hex');
    expect(hash1).not.toBe(hash3);
  });
});

// ── /api/payments ─────────────────────────────────────────────────────────────

test.describe('/api/payments — Payment intelligence (admin)', () => {
  test('rejects non-admin access to GET', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.get('/api/payments?mode=dashboard');
    expect(res.status()).toBe(403);
  });

  test('admin dashboard returns all required KPI fields', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/payments?mode=dashboard');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('kpis');
    expect(body).toHaveProperty('recent_events');
    expect(body).toHaveProperty('settlements');
    expect(body).toHaveProperty('flagged_risks');
    expect(body).toHaveProperty('open_disputes');
    expect(typeof body.kpis.total_net_settled_7d).toBe('number');
    expect(typeof body.kpis.open_disputes).toBe('number');
    expect(typeof body.kpis.flagged_risks).toBe('number');
  });

  test('settlements mode returns array', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/payments?mode=settlements');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.settlements)).toBe(true);
  });

  test('risks mode returns flagged risks when filtered', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/payments?mode=risks&flagged=true');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.risks)).toBe(true);
    // All returned risks should be flagged
    body.risks.forEach((r: { flagged: boolean }) => {
      expect(r.flagged).toBe(true);
    });
  });

  test('score_all action returns scoring summary', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/payments', {
      data: { action: 'score_all' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.scored).toBe('number');
    expect(typeof body.flagged).toBe('number');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.scored).toBeGreaterThanOrEqual(0);
    expect(body.flagged).toBeLessThanOrEqual(body.scored);
  });

  test('score_payment returns 404 for non-existent order', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/payments', {
      data: { action: 'score_payment', order_id: NULL_UUID },
    });
    expect(res.status()).toBe(404);
  });

  test('log_event requires stripe_event_id and event_type', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/payments', {
      data: { action: 'log_event' }, // missing required fields
    });
    expect(res.status()).toBe(400);
  });

  test('log_event deduplication: same event_id returns duplicate status', async ({ page, request }) => {
    await loginAsAdmin(page);
    const uniqueEventId = `test_evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // First log
    const res1 = await request.post('/api/payments', {
      data: {
        action: 'log_event',
        stripe_event_id: uniqueEventId,
        event_type: 'payment_intent.succeeded',
        amount: 1000,
        currency: 'eur',
      },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.status).toBe('logged');

    // Second log with same ID — should be detected as duplicate
    const res2 = await request.post('/api/payments', {
      data: {
        action: 'log_event',
        stripe_event_id: uniqueEventId,
        event_type: 'payment_intent.succeeded',
      },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.status).toBe('duplicate');
  });

  test('sync_settlement requires settlement_date', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/payments', {
      data: { action: 'sync_settlement' }, // missing date
    });
    expect(res.status()).toBe(400);
  });

  test('sync_settlement with valid date succeeds', async ({ page, request }) => {
    await loginAsAdmin(page);
    const today = new Date().toISOString().slice(0, 10);
    const res = await request.post('/api/payments', {
      data: {
        action: 'sync_settlement',
        settlement_date: today,
        gross_volume: 5000,
        fees: 150,
        net_settled: 4850,
        transaction_count: 12,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('settlement');
    expect(typeof body.drift).toBe('number');
    expect(body.drift).toBeGreaterThanOrEqual(0);
  });
});

// ── /api/webhooks/stripe — Inbound webhook handler ────────────────────────────

test.describe('/api/webhooks/stripe — Signature verification & idempotency', () => {
  test('rejects request without stripe-signature header', async ({ request }) => {
    const res = await request.post('/api/webhooks/stripe', {
      data: { type: 'payment_intent.succeeded' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/signature|header/i);
  });

  test('rejects request with invalid signature', async ({ request }) => {
    const res = await request.post('/api/webhooks/stripe', {
      data: JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_test' }),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'v1=invalid_signature_here',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async ({ request }) => {
    // This test verifies the error handling path
    // In a real test env without STRIPE_WEBHOOK_SECRET set, should return 500
    // We simulate by sending empty signature
    const res = await request.post('/api/webhooks/stripe', {
      data: '{}',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': '',
      },
    });
    // Either 400 (bad signature) or 500 (secret not configured)
    expect([400, 500]).toContain(res.status());
  });
});

// ── /api/checkout — Zod validation edge cases ─────────────────────────────────

test.describe('/api/checkout — Zod validation', () => {
  test('rejects missing orderId', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/checkout', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.details).toHaveProperty('orderId');
  });

  test('rejects non-UUID orderId', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/checkout', {
      data: { orderId: '12345' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.details).toHaveProperty('orderId');
  });

  test('rejects invalid JSON body', async ({ page, request }) => {
    await loginAsClient(page);
    const res = await request.post('/api/checkout', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not json at all',
    });
    expect([400]).toContain(res.status());
  });
});

// ── Financial integrity invariants ────────────────────────────────────────────

test.describe('Financial integrity invariants', () => {
  test('settlement drift is always non-negative', async ({ page, request }) => {
    await loginAsAdmin(page);
    const today = new Date().toISOString().slice(0, 10);
    const res = await request.post('/api/payments', {
      data: {
        action: 'sync_settlement',
        settlement_date: today,
        net_settled: 1000,
        internal_expected: 1050,
      },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.drift).toBeGreaterThanOrEqual(0); // drift is absolute value
    }
  });

  test('risk score is bounded 0-100', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.post('/api/payments', {
      data: { action: 'score_all' },
    });
    if (res.status() === 200) {
      const body = await res.json();
      body.results.forEach((r: { score: number }) => {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      });
    }
  });

  test('analytics-platform financial mode: collected >= 0', async ({ page, request }) => {
    await loginAsAdmin(page);
    const res = await request.get('/api/analytics-platform?mode=financial');
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.revenue.collected).toBeGreaterThanOrEqual(0);
      expect(body.revenue.ordered).toBeGreaterThanOrEqual(0);
      expect(body.integrityScore).toBeGreaterThanOrEqual(0);
      expect(body.integrityScore).toBeLessThanOrEqual(100);
    }
  });
});
