/**
 * k6 shared configuration and helpers — YourGift OS
 * All load-test scripts import from this module.
 *
 * Usage:
 *   import { BASE_URL, AUTH_TOKEN, thresholds, makeHeaders, checkResponse, randomItem, randomInt } from './lib/config.js';
 */

// ---------------------------------------------------------------------------
// Base URL & Auth
// ---------------------------------------------------------------------------

/** API base URL. Override at runtime: K6_API_URL=https://api.yourgift.pt k6 run ... */
export const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3001';

/** Bearer token sent with every authenticated request. Override: K6_AUTH_TOKEN=xxx */
export const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || 'dev-load-test-token';

// ---------------------------------------------------------------------------
// Global SLO Thresholds (shared across scripts)
// ---------------------------------------------------------------------------

/**
 * Standard HTTP thresholds applied to every load-test script.
 * Individual scripts can extend or override these.
 */
export const thresholds = {
  // 95th percentile must be below 300 ms
  http_req_duration: ['p(95)<300', 'p(99)<800'],
  // Error rate must be below 1 %
  http_req_failed: ['rate<0.01'],
};

// ---------------------------------------------------------------------------
// HTTP Header Factory
// ---------------------------------------------------------------------------

/**
 * Build standard request headers.
 * @param {string} [token] - Bearer token; defaults to AUTH_TOKEN
 * @returns {{ Authorization: string, 'Content-Type': string, 'X-Load-Test': string }}
 */
export function makeHeaders(token) {
  return {
    Authorization: `Bearer ${token || AUTH_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Load-Test': 'true',
    'X-Load-Test-Suite': 'yourgift-os-k6',
  };
}

// ---------------------------------------------------------------------------
// Response Checker
// ---------------------------------------------------------------------------

/**
 * Validate a k6 response and log errors on failure.
 *
 * @param {import('k6/http').RefinedResponse} res - k6 HTTP response object
 * @param {string} name - Human-readable label for logging
 * @param {number[]} [expectedStatuses] - Acceptable HTTP status codes (default [200, 201, 202, 204])
 * @returns {boolean} true if all checks passed
 */
export function checkResponse(res, name, expectedStatuses) {
  const allowed = expectedStatuses || [200, 201, 202, 204];
  const ok = allowed.includes(res.status);

  if (!ok) {
    console.error(
      `[FAIL] ${name} → HTTP ${res.status} | body: ${res.body ? res.body.substring(0, 200) : '(empty)'} | url: ${res.url}`
    );
  }

  // Surface server-side errors even on 2xx (e.g., partial BullMQ failures)
  if (res.status === 200 || res.status === 201) {
    try {
      const json = res.json();
      if (json && json.error) {
        console.warn(`[WARN] ${name} → 2xx but body.error present: ${json.error}`);
      }
    } catch (_) {
      // body is not JSON — acceptable for 204 / binary responses
    }
  }

  return ok;
}

// ---------------------------------------------------------------------------
// Random Helpers
// ---------------------------------------------------------------------------

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random integer in the inclusive range [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Payload Generators
// ---------------------------------------------------------------------------

/** Pool of fake tenant UUIDs used across scenarios */
export const TENANT_IDS = [
  'tenant-0001-aaaa-bbbb-ccccddddeeee',
  'tenant-0002-aaaa-bbbb-ccccddddeeee',
  'tenant-0003-aaaa-bbbb-ccccddddeeee',
  'tenant-0004-aaaa-bbbb-ccccddddeeee',
  'tenant-0005-aaaa-bbbb-ccccddddeeee',
  'tenant-0006-aaaa-bbbb-ccccddddeeee',
  'tenant-0007-aaaa-bbbb-ccccddddeeee',
  'tenant-0008-aaaa-bbbb-ccccddddeeee',
];

/** Pool of fake product UUIDs */
export const PRODUCT_IDS = [
  'prod-1111-aaaa-bbbb-ccccddddeeee',
  'prod-2222-aaaa-bbbb-ccccddddeeee',
  'prod-3333-aaaa-bbbb-ccccddddeeee',
  'prod-4444-aaaa-bbbb-ccccddddeeee',
  'prod-5555-aaaa-bbbb-ccccddddeeee',
  'prod-6666-aaaa-bbbb-ccccddddeeee',
  'prod-7777-aaaa-bbbb-ccccddddeeee',
  'prod-8888-aaaa-bbbb-ccccddddeeee',
];

/** Pool of fake supplier UUIDs */
export const SUPPLIER_IDS = [
  'supp-aaaa-1111-bbbb-ccccddddeeee',
  'supp-bbbb-2222-cccc-ddddeeeeffff',
  'supp-cccc-3333-dddd-eeeeffff0000',
  'supp-dddd-4444-eeee-ffff00001111',
  'supp-eeee-5555-ffff-000011112222',
];

/** Generate a random ISO-8601 deadline between +7 and +90 days from now */
export function randomDeadline() {
  const days = randomInt(7, 90);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Generate a random monetary amount (in cents) within a range.
 * @param {number} [minCents=1000]   — minimum, default €10.00
 * @param {number} [maxCents=500000] — maximum, default €5,000.00
 * @returns {number}
 */
export function randomAmount(minCents, maxCents) {
  return randomInt(minCents || 1000, maxCents || 500000);
}

// ---------------------------------------------------------------------------
// Scenario Sleep Helpers
// ---------------------------------------------------------------------------

/**
 * Think-time pause between iterations — mimics real user behaviour.
 * @param {number} [minSeconds=0.5]
 * @param {number} [maxSeconds=2]
 */
export function thinkTime(minSeconds, maxSeconds) {
  // k6 sleep is imported by each script; we return a value here so the script
  // can call sleep(thinkTime()) directly.
  return Math.random() * ((maxSeconds || 2) - (minSeconds || 0.5)) + (minSeconds || 0.5);
}
