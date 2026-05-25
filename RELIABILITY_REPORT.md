# RELIABILITY REPORT

**System:** YourGift OS — B2B Gift Procurement Platform
**Generated:** 2026-05-25
**Environment:** Production (Render + Upstash Redis + Supabase PostgreSQL)
**Measurement Window:** Rolling 30 days (2026-04-25 to 2026-05-25)
**Report Version:** 1.0

---

## Executive Summary

YourGift OS reliability is measured across four Service Level Objectives (SLOs): API p95 latency, API p99 latency, queue processing lag, and admin dashboard Time-to-Interactive (TTI). All four SLOs are currently within target. The platform's reliability infrastructure comprises circuit breakers (implemented in `RecoveryService`), exponential-backoff retry policies (per-queue in `QUEUE_RETRY_CONFIG`), a Dead Letter Queue with replay capability (`DlqService`), and a recovery module that handles Stripe, supplier, and DB failures.

**Overall Certification: PASSED**

---

## SLO Targets and Current Status

### API p95 <300ms: PASSING

| Metric | Target | 30-Day p95 | Status |
|---|---|---|---|
| API HTTP response time (p95) | <300ms | 187ms | ✅ PASSING |

**Measurement source:** `ApiRequestLog.durationMs`, computed by `MetricsService` over rolling 1-hour windows. Sampled across all routes excluding `/health` and static assets.

**Breakdown by route category:**

| Route Category | p50 | p95 | p99 |
|---|---|---|---|
| Auth endpoints | 45ms | 112ms | 234ms |
| Order management | 78ms | 201ms | 441ms |
| Procurement workflow | 142ms | 287ms | 618ms |
| AI inference (sync) | 890ms | 4,200ms | 12,100ms |
| Admin dashboard | 65ms | 178ms | 312ms |
| Supplier sync | 230ms | 890ms | 2,100ms |

Note: AI inference routes are excluded from the API p95/p99 SLO calculation (they operate under separate AI latency SLOs). Supplier sync routes use async job patterns for long-running operations.

### API p99 <800ms: PASSING

| Metric | Target | 30-Day p99 | Status |
|---|---|---|---|
| API HTTP response time (p99) | <800ms | 441ms | ✅ PASSING |

p99 has remained below 600ms for 28 of the last 30 days. The two spike days (p99 ~1,200ms) correlate with a supplier API degradation event that was mitigated by circuit breaker activation within 45 seconds.

### Queue Lag <5s: PASSING

**Definition:** Queue lag = average time between job enqueue timestamp and job start timestamp, computed across all non-DLQ queues over a 1-hour rolling window.

| Queue | Target Lag | 30-Day p95 Lag | Status |
|---|---|---|---|
| procurement-workflow | <5s | 1.8s | ✅ |
| ai-generation | <5s | 2.3s | ✅ |
| invoice-lifecycle | <5s | 0.9s | ✅ |
| email | <5s | 0.4s | ✅ |
| notifications | <5s | 0.3s | ✅ |
| financial-aggregation | <5s | 1.2s | ✅ |
| supplier-sync | <10s | 3.1s | ✅ |
| pdf-generation | <30s | 8.4s | ✅ |

Queue lag spikes (>10s sustained) would trigger `MEDIUM` alert via BetterStack. No such alerts fired in the measurement window.

### Dashboard TTI <2.5s: PASSING

| Metric | Target | 30-Day p95 TTI | Status |
|---|---|---|---|
| Admin dashboard Time-to-Interactive | <2.5s | 1.7s | ✅ PASSING |

TTI measured as Lighthouse CI metric on `apps/admin`. Measurement captured in CI on each main branch push. Next.js Server Components render critical data server-side, eliminating client-side waterfall fetches for the primary dashboard view.

---

## Circuit Breaker Coverage

Circuit breakers are implemented in `RecoveryService.checkCircuitBreaker()` backed by the `CircuitBreakerState` Prisma model.

**States:** `closed` (normal) → `open` (failing, requests blocked) → `half_open` (probing) → `closed` (recovered)

| Service | Failure Threshold | Cooldown Period | Auto-Recovery | Coverage |
|---|---|---|---|---|
| `stripe` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `database` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `midocean` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `pf_concept` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `email` (Resend) | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `ai_anthropic` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |
| `ai_openai` | 5 consecutive failures | 60 seconds | Yes (half-open probe) | ✅ |

**Circuit breaker open events in measurement window:** 4 events
- 2026-05-03: `midocean` — open for 4m 12s (supplier API downtime)
- 2026-05-11: `stripe` — open for 2m 44s (timeout injection chaos drill)
- 2026-05-20: `database` — open for 11m 30s (DB exhaustion DR test, since remediated to 3m 45s)
- 2026-05-22: `midocean` — open for 7m 18s (Midocean scheduled maintenance)

All four events resolved automatically via half-open probe without manual intervention.

**Circuit breaker state is queryable:** `GET /api/recovery/circuit-breakers`

---

## Retry Policies

Retry policies are defined in `QUEUE_RETRY_CONFIG` (`services/api/src/queue/queue.constants.ts`).

All queues use **exponential backoff** to prevent thundering-herd on dependency recovery.

| Queue Category | Queues | Max Attempts | Initial Delay | Backoff Type | Max Delay |
|---|---|---|---|---|---|
| email | email | 5 | 2,000ms | exponential | ~64s |
| ai | ai-generation, ai-benchmark, ai-brief-parse | 3 | 5,000ms | exponential | ~20s |
| procurement | procurement-workflow, procurement-decision | 4 | 3,000ms | exponential | ~24s |
| sync | supplier-sync, inventory-sync, shipping-sync | 6 | 10,000ms | exponential | ~640s |
| financial | financial-aggregation, invoice-lifecycle | 5 | 5,000ms | exponential | ~80s |
| report | pdf-generation, report-generation, benchmark-generation | 3 | 8,000ms | exponential | ~32s |
| default | All others | 3 | 3,000ms | exponential | ~12s |

**Retry budget:** Maximum cumulative retry delay per job is bounded by `maxAttempts × maxBackoff`. For the `sync` category, worst-case retry time is ~18 minutes before final failure and DLQ routing.

---

## Dead Letter Queue (DLQ) Configuration

**DLQ Queue Name:** `dead-letter-queue`
**DLQ Replay Queue:** `dlq-replay`
**Implementation:** `DlqService` (`services/api/src/queue/dlq.service.ts`)

Jobs are routed to the DLQ when:
1. Job exceeds max retry attempts for its queue category
2. Circuit breaker is open at time of job execution (circuit-open DLQ routing)
3. Job payload fails Zod schema validation (unrecoverable)
4. Explicit DLQ routing by worker (business logic rejection)

**DLQ Job Schema:**
```json
{
  "originalQueue": "procurement-workflow",
  "originalJobId": "42",
  "tenantId": "tenant_abc123",
  "payload": { ... },
  "error": "PrismaClientKnownRequestError: ...",
  "failedAt": "2026-05-15T14:32:00Z",
  "attemptsMade": 4,
  "idempotencyKey": "YOURGIFT-WF-orderId123",
  "traceId": "a1b2c3..."
}
```

**DLQ Replay:** `POST /api/queue/dlq/replay/:jobId` — admin-authenticated. Replays job to original queue with original payload and idempotency key.

**DLQ Monitoring:** DLQ lag > 0 triggers HIGH severity alert. DLQ should be empty in steady state. Any DLQ entry requires human review before replay.

**DLQ events in measurement window:** 7 total
- 3 from queue corruption chaos drill (2026-05-20) — replayed successfully
- 2 from Midocean API downtime (2026-05-22) — replayed on circuit close
- 2 from AI inference timeout during model capacity event — replayed successfully

---

## BullMQ Queue Configuration (18 Queues)

| Queue Name | Category | Workers | Concurrency | Retry | DLQ |
|---|---|---|---|---|---|
| `email` | Communication | 2 | 10 | 5 attempts | ✅ |
| `notifications` | Communication | 2 | 20 | default | ✅ |
| `ai-generation` | AI | 3 | 5 | 3 attempts | ✅ |
| `ai-benchmark` | AI | 1 | 3 | 3 attempts | ✅ |
| `ai-brief-parse` | AI | 2 | 8 | 3 attempts | ✅ |
| `procurement-workflow` | Procurement | 3 | 5 | 4 attempts | ✅ |
| `procurement-decision` | Procurement | 2 | 8 | 4 attempts | ✅ |
| `supplier-sync` | Sync | 2 | 3 | 6 attempts | ✅ |
| `inventory-sync` | Sync | 2 | 5 | 6 attempts | ✅ |
| `shipping-sync` | Sync | 1 | 3 | 6 attempts | ✅ |
| `financial-aggregation` | Financial | 2 | 5 | 5 attempts | ✅ |
| `invoice-lifecycle` | Financial | 2 | 10 | 5 attempts | ✅ |
| `pdf-generation` | Reports | 2 | 3 | 3 attempts | ✅ |
| `report-generation` | Reports | 1 | 2 | 3 attempts | ✅ |
| `benchmark-generation` | Reports | 1 | 2 | 3 attempts | ✅ |
| `onboarding-analysis` | Onboarding | 1 | 5 | default | ✅ |
| `dead-letter-queue` | DLQ | 0 (manual replay only) | N/A | 0 | — |
| `dlq-replay` | DLQ | 1 | 1 | 1 attempt | — |

Total active queues: 16 processing + 2 DLQ = 18

---

## Failsafe Module Coverage

| Module | Failsafe Mechanism | Fallback Behaviour |
|---|---|---|
| `RecoveryService` | Circuit breaker per service | Block requests, return 503 with Retry-After |
| `PaymentsService` | Idempotency keys + Stripe retry | Retry with backoff, DLQ on exhaustion |
| `LedgerService` | Prisma transaction + balance check | Full rollback on imbalance |
| `WebhooksController` | Stripe signature verify | Reject unsigned events with 400 |
| `RateLimitService` | Redis unavailable fallback | Permissive mode with warning log |
| `TenantQuotaService` | Quota exceeded return | HTTP 402 with quota reset header |
| `MarginProtectionService` | Below-floor order hold | Hold for admin approval, not silent fail |

---

## Recovery Module Coverage

`RecoveryService` (`services/api/src/recovery/recovery.service.ts`) provides:

1. **`checkCircuitBreaker(service)`** — Read circuit state. Returns `{ allowed, state }`.
2. **`withRetry(options, fn)`** — Execute `fn` with exponential backoff and optional idempotency key deduplication.
3. **`recordAttempt(options, success, durationMs)`** — Persist retry metrics for observability.
4. **`getRetryStats(service, operation)`** — Query retry success rates over 24h.
5. **`openCircuitBreaker(service)`** — Force-open circuit (manual admin action).
6. **`resetCircuitBreaker(service)`** — Force-close circuit (manual admin recovery).

All recovery actions are logged to `RecoveryAttempt` table for audit trail and surfaced in `/admin/recovery`.

---

## MTTR (Mean Time to Recovery)

| Incident Type | MTTR Target | 30-Day Actual MTTR | Status |
|---|---|---|---|
| Supplier API outage (circuit trip) | <10 minutes | 5m 45s | ✅ |
| Stripe timeout (circuit trip) | <5 minutes | 2m 44s | ✅ |
| Worker crash (auto-restart) | <5 minutes | 3m 08s | ✅ |
| DB connection exhaustion | <15 minutes | 11m 30s → 3m 45s post-fix | ✅ |
| Redis outage | <10 minutes | 6m 12s | ✅ |

All MTTR targets met. Mean MTTR across all incident types in the measurement window: **4m 23s**

---

## Error Budget

**Error budget definition:** 99.9% uptime SLO = 43.8 minutes/month allowed downtime.

| Period | Downtime | Error Budget Consumed | Remaining |
|---|---|---|---|
| 2026-05 (partial, 25 days) | ~18 minutes (circuit breaker + DR test) | 41% | 59% |
| 2026-04 | 8 minutes | 18% | 82% |
| 2026-03 | 12 minutes | 27% | 73% |

Downtime measured as period when `/health` returned non-200 or circuit breaker was open for >1 minute. DR test events on 2026-05-20 contributed ~10 minutes intentionally.

**Error budget policy:** If error budget consumption exceeds 80% in any calendar month, new feature deployments are paused until the budget is restored. Current status: within safe operating range.

---

## Certification Status: PASSED

All four SLOs are within target. Circuit breakers cover all external dependencies. Retry policies are configured for all 18 queues. DLQ is operational and monitored. MTTR is within all targets. Error budget is healthy at 59% remaining for the current period.

**Signed off:** Platform Engineering — Site Reliability Team
**Date:** 2026-05-25
