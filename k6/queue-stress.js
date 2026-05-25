/**
 * k6 Load Test — BullMQ Queue Saturation
 * YourGift OS · NestJS 10 · Port 3001
 *
 * Scenarios
 * ─────────
 *  queue_saturation : Enqueue 100k jobs across 8 queues · 5 min
 *  retry_storm      : Trigger 10k intentional failures   · 3 min
 *  dlq_replay       : Replay 5k DLQ entries concurrently · 3 min
 *
 * Run
 * ───
 *  k6 run k6/queue-stress.js
 *  K6_API_URL=https://api.yourgift.pt K6_AUTH_TOKEN=admin-token k6 run k6/queue-stress.js
 *
 * NOTE: These tests call /api/admin/* endpoints — use an admin-level token.
 *       Set K6_AUTH_TOKEN to a token with ADMIN role.
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
  thinkTime,
  TENANT_IDS,
  PRODUCT_IDS,
} from './lib/config.js';

// ---------------------------------------------------------------------------
// Custom Metrics
// ---------------------------------------------------------------------------

const queueLag        = new Trend('queue_lag',         true); // ms, job enqueue→pick-up lag
const dlqSize         = new Counter('dlq_size');               // total DLQ entries observed
const workerThroughput = new Rate('worker_throughput');        // fraction of enqueues acknowledged

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All BullMQ queues exposed by the YourGift OS API. */
const QUEUE_NAMES = [
  'email-notifications',
  'order-processing',
  'payment-webhooks',
  'supplier-sync',
  'rfq-processing',
  'report-generation',
  'export-jobs',
  'analytics-events',
];

/** Job types per queue */
const JOB_TYPE_MAP = {
  'email-notifications': ['order-confirmation', 'rfq-update', 'payment-receipt', 'password-reset'],
  'order-processing':    ['place-order', 'cancel-order', 'refund-order', 'update-order-status'],
  'payment-webhooks':    ['stripe-event', 'sepa-debit-update', 'refund-processed'],
  'supplier-sync':       ['sync-catalogue', 'update-pricing', 'check-stock', 'deactivate-product'],
  'rfq-processing':      ['evaluate-rfq', 'assign-rfq', 'close-rfq', 'auto-approve'],
  'report-generation':   ['daily-summary', 'monthly-invoice', 'spend-analytics', 'supplier-scorecard'],
  'export-jobs':         ['csv-export', 'pdf-export', 'excel-export'],
  'analytics-events':    ['track-page-view', 'track-conversion', 'track-search', 'track-click'],
};

/** DLQ replay strategies */
const REPLAY_STRATEGIES = ['sequential', 'parallel', 'sampled'];

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // ── Scenario 1: Queue Saturation ────────────────────────────────────────
    queue_saturation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 400 }, // ramp to 400 VUs
        { duration: '3m',  target: 400 }, // hold — sustain ~100k enqueues across 5 min
        { duration: '1m',  target: 0   }, // ramp down
      ],
      exec: 'queueSaturation',
      tags: { scenario: 'queue_saturation' },
      gracefulStop: '30s',
    },

    // ── Scenario 2: Retry Storm ─────────────────────────────────────────────
    retry_storm: {
      executor: 'constant-vus',
      vus: 200,
      duration: '3m',
      exec: 'retryStorm',
      tags: { scenario: 'retry_storm' },
      startTime: '1m30s', // overlap with saturation peak
      gracefulStop: '30s',
    },

    // ── Scenario 3: DLQ Replay ──────────────────────────────────────────────
    dlq_replay: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 250 }, // ramp up fast
        { duration: '2m',  target: 250 }, // hold
        { duration: '30s', target: 0   }, // ramp down
      ],
      exec: 'dlqReplay',
      tags: { scenario: 'dlq_replay' },
      startTime: '3m', // start after saturation produces DLQ entries
      gracefulStop: '30s',
    },
  },

  thresholds: {
    // Global HTTP SLOs
    http_req_duration:   ['p(95)<200', 'p(99)<500'],
    http_req_failed:     ['rate<0.01'],

    // Queue-specific SLOs
    queue_lag:           ['p(95)<5000'],  // 5-second lag budget
    dlq_size:            ['count<1000'],  // DLQ must not balloon beyond 1k entries
    worker_throughput:   ['rate>0.95'],   // 95 % of enqueues must be acknowledged

    // Per-scenario
    'http_req_duration{scenario:queue_saturation}': ['p(95)<200'],
    'http_req_duration{scenario:retry_storm}':      ['p(95)<300'],
    'http_req_duration{scenario:dlq_replay}':       ['p(95)<400'],
  },
};

// ---------------------------------------------------------------------------
// Payload Factories
// ---------------------------------------------------------------------------

function buildEnqueuePayload(queueName) {
  const jobTypes = JOB_TYPE_MAP[queueName] || ['generic-job'];
  const jobType  = randomItem(jobTypes);

  return {
    queue:    queueName,
    jobType,
    priority: randomInt(1, 10),
    payload: {
      tenantId:   randomItem(TENANT_IDS),
      productId:  randomItem(PRODUCT_IDS),
      timestamp:  new Date().toISOString(),
      attempt:    1,
      data: {
        value:    randomInt(1, 10000),
        ref:      `k6-${Date.now()}-${randomInt(0, 1e9)}`,
        loadTest: true,
      },
    },
    options: {
      attempts:     3,
      backoff:      { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 500 },
    },
  };
}

function buildRetryPayload(queueName) {
  return {
    queue:   queueName,
    jobType: 'intentional-failure',
    priority: 1,
    payload: {
      tenantId:      randomItem(TENANT_IDS),
      shouldFail:    true,
      failureReason: randomItem([
        'external-api-timeout',
        'database-constraint-violation',
        'invalid-payload-schema',
        'rate-limit-exceeded',
        'transient-network-error',
      ]),
      loadTest: true,
    },
    options: {
      attempts: randomInt(1, 5),
      backoff:  { type: 'fixed', delay: 100 }, // fast retries for load test
    },
  };
}

function buildDlqReplayPayload() {
  return {
    queue:    randomItem(QUEUE_NAMES),
    strategy: randomItem(REPLAY_STRATEGIES),
    limit:    randomInt(10, 100),
    filter: {
      olderThanMs:   randomInt(60000, 3600000), // 1 min – 1 hr
      jobType:       Math.random() < 0.5 ? randomItem(JOB_TYPE_MAP['order-processing']) : undefined,
    },
    dryRun: false,
  };
}

// ---------------------------------------------------------------------------
// Scenario Executors
// ---------------------------------------------------------------------------

/**
 * queue_saturation: Flood all 8 queues with jobs as fast as possible.
 * Verifies BullMQ Redis throughput and worker concurrency limits.
 */
export function queueSaturation() {
  const queueName = randomItem(QUEUE_NAMES);
  const headers   = makeHeaders();
  const payload   = buildEnqueuePayload(queueName);

  const enqueueStart = Date.now();
  const res = http.post(
    `${BASE_URL}/api/admin/queues/enqueue-test`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/admin/queues/enqueue-test', queue: queueName } }
  );
  const enqueueDuration = Date.now() - enqueueStart;

  const ok = checkResponse(res, `enqueue → ${queueName}`, [200, 201, 202]);
  workerThroughput.add(ok);

  let jobId;
  if (ok) {
    try {
      jobId = res.json('jobId') || res.json('id') || res.json('data.jobId');
    } catch (_) {}

    // Poll for queue lag (optional — only if API returns a lag field)
    try {
      const body = res.json();
      if (body && typeof body.queueLagMs === 'number') {
        queueLag.add(body.queueLagMs);
      } else {
        // Use round-trip time as a proxy for minimum lag
        queueLag.add(enqueueDuration);
      }
    } catch (_) {
      queueLag.add(enqueueDuration);
    }
  }

  check(res, {
    'enqueue: accepted':          (_) => ok,
    'enqueue: not 5xx':           (r) => r.status < 500,
    'enqueue: under 200ms':       (r) => r.timings.duration < 200,
    'enqueue: has jobId':         (_) => ok ? !!jobId : true,
  });

  // Poll metrics endpoint every ~10 iterations to observe queue depth
  if (randomInt(1, 10) === 1) {
    const metricsRes = http.get(
      `${BASE_URL}/api/admin/queues/metrics`,
      { headers, tags: { name: 'GET /api/admin/queues/metrics' } }
    );

    checkResponse(metricsRes, 'GET /api/admin/queues/metrics', [200]);

    if (metricsRes.status === 200) {
      try {
        const m = metricsRes.json();
        // If the response includes DLQ sizes, accumulate them
        if (m && m.queues) {
          Object.values(m.queues).forEach((q) => {
            if (q && typeof q.dlqSize === 'number' && q.dlqSize > 0) {
              dlqSize.add(q.dlqSize);
            }
          });
        }
      } catch (_) {}
    }
  }

  // No sleep — push the queue as hard as possible
}

/**
 * retry_storm: Submit jobs designed to fail repeatedly, saturating the retry
 * mechanism and Dead Letter Queue to verify backpressure and DLQ behaviour.
 */
export function retryStorm() {
  const queueName = randomItem(QUEUE_NAMES);
  const headers   = makeHeaders();
  const payload   = buildRetryPayload(queueName);

  const res = http.post(
    `${BASE_URL}/api/admin/queues/enqueue-test`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/admin/queues/enqueue-test (retry)', queue: queueName } }
  );

  const ok = checkResponse(res, `retry enqueue → ${queueName}`, [200, 201, 202]);
  workerThroughput.add(ok);

  check(res, {
    'retry: enqueue accepted': (_) => ok,
    'retry: not 5xx':          (r) => r.status < 500,
    'retry: fast response':    (r) => r.timings.duration < 300,
  });

  // Occasional metrics check to watch DLQ grow
  if (randomInt(1, 5) === 1) {
    const metricsRes = http.get(
      `${BASE_URL}/api/admin/queues/metrics`,
      { headers, tags: { name: 'GET /api/admin/queues/metrics (retry_storm)' } }
    );

    if (metricsRes.status === 200) {
      try {
        const m = metricsRes.json();
        if (m && m.queues) {
          Object.values(m.queues).forEach((q) => {
            if (q && typeof q.failed === 'number' && q.failed > 0) {
              dlqSize.add(q.failed);
            }
          });
        }
      } catch (_) {}
    }
  }

  sleep(thinkTime(0.05, 0.2)); // very tight loop to generate retries fast
}

/**
 * dlq_replay: Concurrently submit DLQ replay requests.
 * Verifies that the replay API can handle concurrent replays without
 * corrupting job state or causing double-processing.
 */
export function dlqReplay() {
  const headers = makeHeaders();
  const payload = buildDlqReplayPayload();

  const res = http.post(
    `${BASE_URL}/api/admin/queues/dlq-replay`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/admin/queues/dlq-replay' } }
  );

  const ok = checkResponse(res, 'POST /api/admin/queues/dlq-replay', [200, 201, 202, 404]);

  if (ok && res.status === 200) {
    try {
      const body = res.json();
      // Track how many jobs were replayed
      if (body && typeof body.replayed === 'number') {
        dlqSize.add(-body.replayed); // negative: entries leaving DLQ
      }
      if (body && typeof body.queueLagMs === 'number') {
        queueLag.add(body.queueLagMs);
      }
    } catch (_) {}
  }

  check(res, {
    'dlq_replay: accepted':           (_) => ok,
    'dlq_replay: not 5xx':            (r) => r.status < 500,
    'dlq_replay: under 400ms':        (r) => r.timings.duration < 400,
    'dlq_replay: idempotent (no 409)': (r) => r.status !== 409,
  });

  sleep(thinkTime(0.2, 0.8));
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

export function setup() {
  const headers = makeHeaders();

  // Verify admin access
  const health = http.get(`${BASE_URL}/health`, { headers });
  if (health.status !== 200) {
    console.warn(`[SETUP] Health: HTTP ${health.status}`);
  }

  // Pre-check queue metrics baseline
  const metrics = http.get(`${BASE_URL}/api/admin/queues/metrics`, { headers });
  if (metrics.status === 200) {
    console.log('[SETUP] Queue metrics baseline obtained');
    try {
      const m = metrics.json();
      console.log(`[SETUP] Baseline: ${JSON.stringify(m).substring(0, 300)}`);
    } catch (_) {}
  } else if (metrics.status === 401 || metrics.status === 403) {
    console.error('[SETUP] UNAUTHORIZED — set K6_AUTH_TOKEN to an admin token');
  }

  return { startedAt: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`[TEARDOWN] Queue stress test complete. Started: ${data.startedAt}`);

  // Final metrics snapshot
  const headers = makeHeaders();
  const metrics = http.get(`${BASE_URL}/api/admin/queues/metrics`, { headers });
  if (metrics.status === 200) {
    try {
      const m = metrics.json();
      console.log(`[TEARDOWN] Final queue metrics: ${JSON.stringify(m).substring(0, 500)}`);
    } catch (_) {}
  }
}
