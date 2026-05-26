/**
 * k6 Load Test — B2C Commerce API
 * YourGift OS · NestJS 10 · Port 3001
 *
 * Scenarios
 * ─────────
 *  flash_sale      : 2,000 VUs simultaneous checkout spike · 30 s
 *  cart_concurrent : 500 VUs add-to-cart → checkout         · 10 min
 *  payment_spike   : 1,000 VUs payment submission bursts     · 60 s
 *  webhook_flood   : 300 VUs Stripe webhook delivery         · 5 min
 *
 * Run
 * ───
 *  k6 run k6/commerce-load.js
 *  K6_API_URL=https://api.yourgift.pt K6_AUTH_TOKEN=xxx k6 run k6/commerce-load.js
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
  thinkTime,
  TENANT_IDS,
  PRODUCT_IDS,
  SUPPLIER_IDS,
} from './lib/config.js';

// ---------------------------------------------------------------------------
// Custom Metrics
// ---------------------------------------------------------------------------

const checkoutSuccessRate = new Rate('checkout_success_rate');
const paymentDuration     = new Trend('payment_duration', true); // ms, percentiles
const cartAbandonment     = new Counter('cart_abandonment');

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // ── Scenario 1: Flash Sale Spike ────────────────────────────────────────
    flash_sale: {
      executor: 'constant-vus',
      vus: 2000,
      duration: '30s',
      exec: 'flashSale',
      tags: { scenario: 'flash_sale' },
      gracefulStop: '15s',
    },

    // ── Scenario 2: Cart Concurrent ─────────────────────────────────────────
    cart_concurrent: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 500 }, // ramp up
        { duration: '8m',  target: 500 }, // hold
        { duration: '1m',  target: 0   }, // ramp down
      ],
      exec: 'cartConcurrent',
      tags: { scenario: 'cart_concurrent' },
      startTime: '35s', // after flash_sale winds down
      gracefulStop: '30s',
    },

    // ── Scenario 3: Payment Spike ───────────────────────────────────────────
    payment_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 1200,
      stages: [
        { duration: '10s', target: 200 }, // ramp to 200 req/s
        { duration: '40s', target: 200 }, // hold
        { duration: '10s', target: 0   }, // ramp down
      ],
      exec: 'paymentSpike',
      tags: { scenario: 'payment_spike' },
      startTime: '40s',
      gracefulStop: '20s',
    },

    // ── Scenario 4: Webhook Flood ───────────────────────────────────────────
    webhook_flood: {
      executor: 'constant-vus',
      vus: 300,
      duration: '5m',
      exec: 'webhookFlood',
      tags: { scenario: 'webhook_flood' },
      startTime: '2m',
      gracefulStop: '30s',
    },
  },

  thresholds: {
    // Global SLOs
    http_req_duration:       ['p(95)<300', 'p(99)<800'],
    http_req_failed:         ['rate<0.01'],

    // Commerce-specific SLOs
    checkout_success_rate:   ['rate>0.99'],           // 99 % checkout success
    payment_duration:        ['p(95)<500', 'p(99)<1000'],
    cart_abandonment:        ['count<200'],            // tolerate up to 200 abandonments

    // Per-scenario breakdown
    'http_req_duration{scenario:flash_sale}':      ['p(95)<400'],
    'http_req_duration{scenario:cart_concurrent}': ['p(95)<300'],
    'http_req_duration{scenario:payment_spike}':   ['p(95)<500'],
    'http_req_duration{scenario:webhook_flood}':   ['p(95)<200'],
  },
};

// ---------------------------------------------------------------------------
// Payload Factories
// ---------------------------------------------------------------------------

const GIFT_TYPES      = ['gift-card', 'physical-gift', 'experience', 'donation', 'voucher'];
const PAYMENT_METHODS = ['card', 'sepa_debit', 'ideal', 'sofort'];
const STRIPE_EVENTS   = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'customer.subscription.updated',
  'invoice.payment_succeeded',
];
const STRIPE_WEBHOOK_SECRET = __ENV.K6_STRIPE_WEBHOOK_SECRET || 'whsec_load_test_secret';

function buildCartAddPayload() {
  return {
    tenantId:  randomItem(TENANT_IDS),
    productId: randomItem(PRODUCT_IDS),
    quantity:  randomInt(1, 10),
    unitPrice: randomAmount(1000, 50000), // €10–€500 in cents
    giftType:  randomItem(GIFT_TYPES),
    recipient: {
      name:    `Recipient ${randomInt(1000, 9999)}`,
      email:   `recipient+${randomInt(1, 1e6)}@loadtest.yourgift.pt`,
    },
    customisation: {
      message: 'Happy birthday! — k6 load test',
      theme:   randomItem(['default', 'elegant', 'festive', 'corporate']),
    },
  };
}

function buildCheckoutPayload(cartId) {
  return {
    cartId,
    paymentMethod:  randomItem(PAYMENT_METHODS),
    billingAddress: {
      name:       `Load Test User ${randomInt(1, 9999)}`,
      line1:      `Rua da Inovação, ${randomInt(1, 999)}`,
      city:       randomItem(['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro']),
      postalCode: `${randomInt(1000, 9999)}-${randomInt(100, 999)}`,
      country:    'PT',
    },
    couponCode:   Math.random() < 0.1 ? 'LOADTEST10' : null,
    metadata: {
      loadTest:    true,
      sessionId:   `sess-${Date.now()}-${randomInt(0, 1e9)}`,
    },
  };
}

function buildPaymentPayload() {
  return {
    amount:        randomAmount(500, 200000),
    currency:      'eur',
    paymentMethod: randomItem(PAYMENT_METHODS),
    tenantId:      randomItem(TENANT_IDS),
    idempotencyKey: `idem-${Date.now()}-${randomInt(0, 1e9)}`,
    description:   'Load test payment — discard',
  };
}

function buildStripeWebhookPayload() {
  const eventType = randomItem(STRIPE_EVENTS);
  return {
    id:      `evt_${randomInt(1e14, 9e14)}`,
    object:  'event',
    type:    eventType,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id:       `pi_${randomInt(1e14, 9e14)}`,
        object:   'payment_intent',
        amount:   randomAmount(1000, 100000),
        currency: 'eur',
        status:   eventType.includes('succeeded') ? 'succeeded' : 'requires_payment_method',
        metadata: { loadTest: 'true', tenantId: randomItem(TENANT_IDS) },
      },
    },
    // NOTE: In production Stripe signs webhooks with HMAC-SHA256.
    // For load tests against staging, set STRIPE_WEBHOOK_SECRET=whsec_test_... and
    // ensure the API is configured to skip signature verification for load-test events,
    // OR use a real Stripe CLI forwarding session.
  };
}

// ---------------------------------------------------------------------------
// Scenario Executors
// ---------------------------------------------------------------------------

/**
 * flash_sale: 2,000 VUs all hit checkout at the same time.
 * Simulates a product launch / flash-sale event.
 */
export function flashSale() {
  const headers = makeHeaders();

  // Step 1: Add to cart
  const cartPayload = buildCartAddPayload();
  const addRes = http.post(
    `${BASE_URL}/api/cart/add`,
    JSON.stringify(cartPayload),
    { headers, tags: { name: 'POST /api/cart/add' } }
  );

  const cartOk = checkResponse(addRes, 'POST /api/cart/add (flash_sale)', [200, 201]);
  if (!cartOk) {
    cartAbandonment.add(1);
    checkoutSuccessRate.add(false);
    return;
  }

  let cartId;
  try {
    cartId = addRes.json('cartId') || addRes.json('id') || addRes.json('data.cartId') || 'cart-fallback-id';
  } catch (_) {
    cartId = 'cart-fallback-id';
  }

  check(addRes, {
    'flash_sale add-to-cart: 2xx':           (_) => cartOk,
    'flash_sale add-to-cart: under 400ms':   (r) => r.timings.duration < 400,
  });

  // No sleep — flash sale is intentionally zero think-time (thundering herd)

  // Step 2: Checkout immediately
  const checkoutPayload = buildCheckoutPayload(cartId);
  const checkoutRes = http.post(
    `${BASE_URL}/api/cart/checkout`,
    JSON.stringify(checkoutPayload),
    { headers, tags: { name: 'POST /api/cart/checkout' } }
  );

  const checkoutOk = checkResponse(checkoutRes, 'POST /api/cart/checkout (flash_sale)', [200, 201, 202]);
  checkoutSuccessRate.add(checkoutOk);

  if (!checkoutOk) {
    cartAbandonment.add(1);
  }

  check(checkoutRes, {
    'flash_sale checkout: 2xx':         (_) => checkoutOk,
    'flash_sale checkout: under 800ms': (r) => r.timings.duration < 800,
    'flash_sale checkout: not 5xx':     (r) => r.status < 500,
  });
}

/**
 * cart_concurrent: 500 VUs doing full add → checkout flow with realistic think-time.
 */
export function cartConcurrent() {
  const headers = makeHeaders();

  // Step 1: Add item to cart
  const addRes = http.post(
    `${BASE_URL}/api/cart/add`,
    JSON.stringify(buildCartAddPayload()),
    { headers, tags: { name: 'POST /api/cart/add' } }
  );

  const addOk = checkResponse(addRes, 'POST /api/cart/add (cart_concurrent)', [200, 201]);

  check(addRes, {
    'cart: add succeeded':        (_) => addOk,
    'cart: add under 300ms':      (r) => r.timings.duration < 300,
  });

  if (!addOk) {
    cartAbandonment.add(1);
    checkoutSuccessRate.add(false);
    return;
  }

  let cartId;
  try {
    cartId = addRes.json('cartId') || addRes.json('id') || `cart-${randomInt(1, 100000)}`;
  } catch (_) {
    cartId = `cart-${randomInt(1, 100000)}`;
  }

  // Think time: user browses before checking out
  sleep(thinkTime(1, 4));

  // Simulate 15 % abandonment before checkout
  if (Math.random() < 0.15) {
    cartAbandonment.add(1);
    checkoutSuccessRate.add(false);
    return;
  }

  // Step 2: Checkout
  const checkoutRes = http.post(
    `${BASE_URL}/api/cart/checkout`,
    JSON.stringify(buildCheckoutPayload(cartId)),
    { headers, tags: { name: 'POST /api/cart/checkout' } }
  );

  const checkoutOk = checkResponse(checkoutRes, 'POST /api/cart/checkout (cart_concurrent)', [200, 201, 202]);
  checkoutSuccessRate.add(checkoutOk);

  if (!checkoutOk) {
    cartAbandonment.add(1);
  }

  check(checkoutRes, {
    'cart: checkout succeeded':   (_) => checkoutOk,
    'cart: checkout under 300ms': (r) => r.timings.duration < 300,
    'cart: not 5xx':              (r) => r.status < 500,
  });

  sleep(thinkTime(0.5, 2));
}

/**
 * payment_spike: 1,000 VUs submitting payment requests in rapid bursts.
 * Uses ramping-arrival-rate executor for precise throughput control.
 */
export function paymentSpike() {
  const headers = makeHeaders();
  const payload = buildPaymentPayload();

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/payments/stripe/charge`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/payments/stripe/charge' } }
  );
  const elapsed = Date.now() - start;

  paymentDuration.add(elapsed);

  const ok = checkResponse(res, 'POST /api/payments/stripe/charge', [200, 201, 202, 402]);

  check(res, {
    'payment: accepted or declined cleanly': (_) => ok,
    'payment: not 5xx':                      (r) => r.status < 500,
    'payment: duration under 500ms':         (_) => elapsed < 500,
    'payment: has paymentIntentId':          (r) => {
      if (r.status !== 200 && r.status !== 201) return true; // skip check on non-2xx
      try {
        return !!r.json('paymentIntentId') || !!r.json('clientSecret') || !!r.json('id');
      } catch (_) {
        return false;
      }
    },
  });

  // No sleep — arrival-rate executor controls throughput externally
}

/**
 * webhook_flood: 300 VUs simulating Stripe webhook delivery bursts.
 * Stress-tests the webhook processing pipeline and BullMQ job ingestion.
 */
export function webhookFlood() {
  // Webhook endpoint typically requires a Stripe-Signature header
  const headers = {
    ...makeHeaders(),
    'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=load_test_signature_${randomInt(1e10, 9e10)}`,
    'Content-Type': 'application/json',
  };

  const payload = buildStripeWebhookPayload();

  const res = http.post(
    `${BASE_URL}/api/payments/stripe/webhook`,
    JSON.stringify(payload),
    { headers, tags: { name: 'POST /api/payments/stripe/webhook' } }
  );

  // Webhook endpoints return 200 quickly and process async via BullMQ.
  // A 400 means signature rejection (expected in load tests without real signing).
  // A 5xx means the queue or handler crashed.
  const ok = checkResponse(res, 'POST /api/payments/stripe/webhook', [200, 201, 400]);

  check(res, {
    'webhook: not 5xx':          (r) => r.status < 500,
    'webhook: under 200ms':      (r) => r.timings.duration < 200,
    'webhook: response is fast': (r) => r.timings.duration < 100,
  });

  sleep(thinkTime(0.1, 0.5)); // webhooks arrive rapidly
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

export function setup() {
  const res = http.get(`${BASE_URL}/health`, { headers: makeHeaders() });
  if (res.status !== 200) {
    console.warn(`[SETUP] Health check: HTTP ${res.status}`);
  } else {
    console.log('[SETUP] Commerce load test — API is healthy, starting scenarios');
  }
  return { startedAt: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`[TEARDOWN] Commerce load test complete. Started: ${data.startedAt}`);
}
