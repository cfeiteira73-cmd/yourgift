/**
 * k6 Load Test — B2B Procurement API
 * YourGift OS · NestJS 10 · Port 3001
 *
 * Scenarios
 * ─────────
 *  rfq_storm      : 10,000 RFQ submissions    · 500 peak VUs · 5 min
 *  approval_chains: 5,000 approval decisions   · 250 peak VUs · 4 min
 *  quote_eval     : 50,000 quote evaluations   · 1000 peak VUs · 8 min
 *
 * Run
 * ───
 *  k6 run k6/procurement-load.js
 *  K6_API_URL=https://api.yourgift.pt K6_AUTH_TOKEN=xxx k6 run k6/procurement-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

import {
  BASE_URL,
  makeHeaders,
  checkResponse,
  randomItem,
  randomInt,
  randomAmount,
  randomDeadline,
  thinkTime,
  TENANT_IDS,
  PRODUCT_IDS,
  SUPPLIER_IDS,
} from './lib/config.js';

// ---------------------------------------------------------------------------
// Custom Metrics
// ---------------------------------------------------------------------------

const rfqDuration    = new Trend('rfq_duration',    true); // ms, percentiles enabled
const approvalRate   = new Rate('approval_rate');           // fraction of approved decisions
const quoteEvalErrors = new Counter('quote_eval_errors');  // total evaluation failures

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // ── Scenario 1: RFQ Storm ──────────────────────────────────────────────
    rfq_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 }, // ramp up to 500 VUs in 2 min
        { duration: '2m', target: 500 }, // hold 500 VUs for 2 min
        { duration: '1m', target: 0   }, // ramp down in 1 min
      ],
      exec: 'rfqStorm',
      tags: { scenario: 'rfq_storm' },
      gracefulStop: '30s',
    },

    // ── Scenario 2: Approval Chains ────────────────────────────────────────
    approval_chains: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 250 }, // ramp up
        { duration: '3m', target: 250 }, // hold
        { duration: '30s', target: 0  }, // ramp down
      ],
      exec: 'approvalChains',
      tags: { scenario: 'approval_chains' },
      startTime: '30s', // stagger start to avoid thundering herd
      gracefulStop: '30s',
    },

    // ── Scenario 3: Quote Evaluation ──────────────────────────────────────
    quote_eval: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 1000 }, // ramp up to 1000 VUs in 3 min
        { duration: '5m', target: 1000 }, // hold 1000 VUs for 5 min
        { duration: '1m', target: 0    }, // ramp down
      ],
      exec: 'quoteEval',
      tags: { scenario: 'quote_eval' },
      startTime: '1m', // give RFQ storm a head start so quotes exist
      gracefulStop: '30s',
    },
  },

  thresholds: {
    // Global HTTP SLOs
    http_req_duration:  ['p(95)<300', 'p(99)<800'],
    http_req_failed:    ['rate<0.01'],

    // Procurement-specific SLOs
    rfq_duration:       ['p(95)<500'],                // RFQs may do DB + BullMQ enqueue
    approval_rate:      ['rate>0.95'],                // at least 95 % of decisions accepted
    quote_eval_errors:  ['count<500'],                // tolerate up to 500 eval errors

    // Per-scenario duration tags
    'http_req_duration{scenario:rfq_storm}':      ['p(95)<400'],
    'http_req_duration{scenario:approval_chains}': ['p(95)<300'],
    'http_req_duration{scenario:quote_eval}':      ['p(95)<200'],
  },
};

// ---------------------------------------------------------------------------
// Payload Factories
// ---------------------------------------------------------------------------

const RFQ_CATEGORIES = ['office-supplies', 'it-hardware', 'marketing', 'facilities', 'travel'];
const CURRENCIES     = ['EUR', 'USD', 'GBP'];
const DECISION_OPTS  = ['approved', 'rejected', 'escalated'];
const QUOTE_STATUSES = ['pending', 'active', 'expired'];

function buildRfqPayload() {
  const qty = randomInt(1, 500);
  return {
    tenantId:     randomItem(TENANT_IDS),
    title:        `Load-test RFQ #${randomInt(100000, 999999)}`,
    category:     randomItem(RFQ_CATEGORIES),
    productId:    randomItem(PRODUCT_IDS),
    quantity:     qty,
    unitBudget:   randomAmount(500, 100000),   // cents per unit
    totalBudget:  qty * randomAmount(500, 100000),
    currency:     randomItem(CURRENCIES),
    deadline:     randomDeadline(),
    supplierIds:  [randomItem(SUPPLIER_IDS), randomItem(SUPPLIER_IDS)].filter(
      (v, i, a) => a.indexOf(v) === i
    ),
    priority:     randomItem(['low', 'medium', 'high', 'urgent']),
    notes:        'k6 load-test generated RFQ — discard after test',
    metadata: {
      loadTestRun: true,
      iterationId: `iter-${Date.now()}-${randomInt(0, 1e9)}`,
    },
  };
}

function buildApprovalPayload(rfqId) {
  const decision = randomItem(DECISION_OPTS);
  return {
    rfqId,
    decision,
    approverId:  randomItem(TENANT_IDS),
    comment:     decision === 'rejected'
      ? 'Budget exceeds quarterly limit — k6 test'
      : 'Within budget threshold — k6 test',
    timestamp:   new Date().toISOString(),
  };
}

function buildQuoteId() {
  // Fabricate a plausible quote UUID; in a real scenario you would seed IDs
  // from a setup() call that creates fixtures.
  return `quote-${randomInt(1, 9999).toString().padStart(4, '0')}-load-test`;
}

// ---------------------------------------------------------------------------
// Scenario Executors
// ---------------------------------------------------------------------------

/** Scenario: rfq_storm — submit RFQs at high concurrency */
export function rfqStorm() {
  const payload = buildRfqPayload();
  const headers = makeHeaders();

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/rfq`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/rfq' } }
  );
  const elapsed = Date.now() - start;

  rfqDuration.add(elapsed);

  const ok = checkResponse(res, 'POST /api/rfq', [200, 201, 202]);

  check(res, {
    'rfq: status is 2xx':            (r) => ok,
    'rfq: has rfqId in response':    (r) => {
      if (!ok) return false;
      try { return !!r.json('rfqId') || !!r.json('id') || !!r.json('data.id'); }
      catch (_) { return false; }
    },
    'rfq: response time < 500ms':    (_) => elapsed < 500,
  });

  sleep(thinkTime(0.2, 1.0));
}

/** Scenario: approval_chains — approve/reject/escalate existing RFQs */
export function approvalChains() {
  // Simulate fetching a pending RFQ to decide on (random ID pool)
  const rfqId  = `rfq-${randomInt(1, 5000).toString().padStart(5, '0')}-load-test`;
  const payload = buildApprovalPayload(rfqId);
  const headers = makeHeaders();

  const res = http.post(
    `${BASE_URL}/api/approvals/${rfqId}/decide`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/approvals/:id/decide' } }
  );

  const ok = checkResponse(res, `POST /api/approvals/${rfqId}/decide`, [200, 201, 202, 404]);

  // 404 is tolerable (RFQ doesn't exist in load-test DB); count true acceptances
  const accepted = ok && res.status !== 404;
  approvalRate.add(accepted);

  check(res, {
    'approval: status acceptable':         (_) => ok,
    'approval: not a 5xx error':           (r) => r.status < 500,
    'approval: response under 300ms':      (r) => r.timings.duration < 300,
  });

  sleep(thinkTime(0.3, 1.5));
}

/** Scenario: quote_eval — read and evaluate supplier quotes */
export function quoteEval() {
  const quoteId = buildQuoteId();
  const headers  = makeHeaders();

  const res = http.get(
    `${BASE_URL}/api/quotes/${quoteId}`,
    { headers, tags: { name: 'GET /api/quotes/:id' } }
  );

  const ok = checkResponse(res, `GET /api/quotes/${quoteId}`, [200, 404]);

  if (!ok) {
    quoteEvalErrors.add(1);
  }

  check(res, {
    'quote: status acceptable':        (_) => ok,
    'quote: not a 5xx':                (r) => r.status < 500,
    'quote: response under 200ms':     (r) => r.timings.duration < 200,
    'quote: content-type json':        (r) =>
      r.status === 200
        ? (r.headers['Content-Type'] || '').includes('application/json')
        : true,
  });

  sleep(thinkTime(0.1, 0.5)); // quote reads are fast; tighter think-time
}

// ---------------------------------------------------------------------------
// Setup / Teardown (optional fixtures)
// ---------------------------------------------------------------------------

/**
 * setup() runs once before all VUs start.
 * Returns data that is passed to each VU function as the second argument.
 * Here we do a health-check and optionally seed a batch of test RFQs.
 */
export function setup() {
  const headers = makeHeaders();

  // Health check
  const health = http.get(`${BASE_URL}/health`, { headers });
  if (health.status !== 200) {
    console.warn(`[SETUP] Health check returned ${health.status} — proceeding anyway`);
  } else {
    console.log('[SETUP] API health check passed');
  }

  return {
    startedAt: new Date().toISOString(),
    baseUrl:   BASE_URL,
  };
}

export function teardown(data) {
  console.log(`[TEARDOWN] Procurement load test finished. Started at ${data.startedAt}`);
}
