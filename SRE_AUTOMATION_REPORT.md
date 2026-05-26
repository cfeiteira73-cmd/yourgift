# SRE AUTOMATION REPORT
Generated: 2026-05-25
Project: YourGift OS — B2B Procurement Platform
Service: `services/api` — NestJS 10 on AWS ECS Fargate

---

## Executive Summary

The YourGift OS SRE automation layer provides continuous self-healing capabilities across two primary subsystems: the **Auto-Remediation Engine** (30-second tick health checks) and the **Rollback Orchestrator** (6-step atomic deployment rollback). Together they enforce three SLO tiers, manage queue backpressure across 8 BullMQ queues, and emit structured events to the platform event bus for downstream alerting and audit.

As of 2026-05-25, the system is designed for:
- **Zero-touch throttle activation** on any endpoint breaching p99 > 800ms
- **Automatic degraded ingestion** on any BullMQ queue exceeding 100 waiting jobs
- **Structured rollback** from any deployment within < 1 minute (6 × 100ms simulated steps in dev; production steps replace simulated delays with real traffic shifts via ECS service update and Route53 weighted routing)

---

## Auto-Remediation Engine

### Architecture

File: `services/api/src/sre/auto-remediation.service.ts`

The engine runs as a NestJS `OnModuleInit` service with a `setInterval` at **30 seconds**. Each tick calls:
1. `MetricsService.getSloBreaches()` — reads the in-memory rolling latency window (up to 10,000 samples per endpoint key)
2. `QueueService.getQueueMetrics()` — polls BullMQ for waiting/active/failed job counts across all 8 queues

All state is in-memory (no DB round-trips on the hot path). The `lastSnapshot` field is updated atomically at the end of each tick and served synchronously from `GET /admin/sre/health`.

### Trigger Conditions

| Trigger | Threshold | Action |
|---|---|---|
| Endpoint p99 latency | > 800ms | `activateThrottle(endpoint)` |
| Endpoint p95 latency | > 300ms | Recorded in breach report (no throttle) |
| Queue waiting jobs | ≥ 100 | `activateDegradedIngestion(queueName)` |
| Queue waiting jobs | 10–99 | Status = `degraded`, logged only |
| Critical queues count | > 3 | `emitCriticalSystemAlert()` |

### Actions

**Throttle Activation**
- Adds endpoint to `throttledEndpoints: Set<string>`
- Records `RemediationAction` with `severity: 'warning'`
- Emits `sre.throttle_activated` on EventBus
- Intended for consumption by a NestJS interceptor or API Gateway rate-limit rule

**Degraded Ingestion Mode**
- Sets `degradedMode = true`
- Records `RemediationAction` with `severity: 'critical'`
- Emits `sre.degraded_mode_activated` on EventBus
- Consumers of this flag should shed non-critical write workloads (e.g. AI generation, supplier syncs) and only process payment-critical paths

**Critical System Alert**
- Emits `sre.critical_system_alert` with full `SystemHealthSnapshot` payload
- Downstream: Slack alert via `NotificationsService`, BetterStack heartbeat miss, PagerDuty webhook

### Recovery Timelines

| Condition | Detection Latency | Auto-Recovery |
|---|---|---|
| Endpoint p99 spike | ≤ 30s (next tick) | Manual `DELETE /admin/sre/throttle/:endpoint` |
| Queue overload | ≤ 30s | Manual `DELETE /admin/sre/degraded-mode` when resolved |
| 3+ critical queues | ≤ 30s | Alert only; operator triggered rollback |

### In-Memory Action Log

- Maximum **500 entries** (oldest trimmed on overflow)
- Each entry: `id`, `triggeredAt`, `trigger`, `action`, `severity`, `resolved`, `resolvedAt`
- Queried via `GET /admin/sre/remediations?limit=50`

---

## Rollback Orchestrator

File: `services/api/src/sre/rollback-orchestrator.service.ts`

### Rollback Plan Steps

Every rollback plan executes exactly 6 ordered steps:

| # | Step | Purpose |
|---|---|---|
| 1 | `pause-traffic` | Shift Route53 weight to 0% for new ECS task revision |
| 2 | `verify-health` | Confirm old revision is responding (healthcheck endpoint) |
| 3 | `switch-version` | Update ECS service `desiredCount` to target revision |
| 4 | `run-migrations` | Execute Prisma `migrate deploy` against RDS; rollback-safe migrations only |
| 5 | `resume-traffic` | Shift Route53 weight back to 100% for stable revision |
| 6 | `verify-recovery` | Assert p99 < 500ms and queue status not `critical` for 15s |

Any step failure sets plan status to `failed`, records `errorMessage`, and emits `sre.rollback_failed`. The remaining steps are skipped (fail-fast).

### Plan Lifecycle

```
createRollbackPlan()  → status: 'pending'
executeRollback()     → status: 'executing'
                      → status: 'completed' | 'failed'
```

Plans are stored in a `Map<rollbackId, RollbackPlan>` in-process memory. For production audit persistence, emit `sre.rollback_completed`/`sre.rollback_failed` events and sink them to the `procurement_events` table via the event sourcing pipeline.

### Health Gate Checks

`validateDeployHealth()` runs 3 gates before greenlighting a deployment:

| Gate | Pass Condition | Checked Via |
|---|---|---|
| `sloBreaches` | Zero critical p99 breaches | `MetricsService.getSloBreaches()` |
| `queueHealth` | No queue in `critical` status | `QueueService.getQueueMetrics()` |
| `degradedMode` | `isDegradedMode() === false` | `AutoRemediationService` |

Returns `{ healthy: boolean, checks: Record<string, boolean>, failedChecks: string[] }`. CI/CD pipelines should call `GET /admin/sre/rollback/health-check` as a deployment gate before promoting a new image.

---

## Incident Response Playbooks

### Latency Spike

**Symptoms**: p99 > 800ms on one or more endpoints, `sre.throttle_activated` events on EventBus

**Immediate (0–2 min)**
1. Check `GET /admin/sre/health` — identify breaching endpoints
2. Verify `GET /admin/sre/remediations` — confirm throttle was auto-applied
3. Check `GET /observability/latency?hours=1` — identify slow paths (DB query, external HTTP, AI call)

**Diagnosis (2–10 min)**
- If endpoint is an AI route (`/ai-design`, `/ai`): check `QUEUE_AI_GENERATION` queue depth
- If endpoint is `/orders` or `/quotes`: check Prisma slow query log in CloudWatch
- If endpoint is `/payments`: check Stripe API latency dashboard
- If p95 > 2000ms across ALL endpoints: suspect ECS container CPU throttling or RDS connection pool saturation

**Remediation**
- AI queue backed up: `POST /admin/sre/degraded-mode { "queueName": "ai-generation" }`
- DB slow: trigger read replica failover via RDS console
- Memory pressure: trigger ECS service scale-out (target tracking policy should auto-scale, verify CloudWatch alarm `ECS/MemoryUtilization > 80%`)
- External API: activate circuit breaker, serve cached fallback

**Recovery**
- Once p99 < 500ms for 60s: `DELETE /admin/sre/throttle/:endpoint`
- Verify `GET /admin/sre/health` returns `systemStatus: 'healthy'`

---

### Queue Overload

**Symptoms**: Any BullMQ queue `waiting ≥ 100`, `sre.degraded_mode_activated` event, or `sre.critical_system_alert` (> 3 critical queues)

**Queue thresholds**

| Queue | Avg Job Duration | Critical at |
|---|---|---|
| `email` | 2s | 100 waiting |
| `ai-generation` | 15s | 100 waiting (~25 min backlog) |
| `procurement-workflow` | 5s | 100 waiting |
| `supplier-sync` | 10s | 100 waiting |
| `pdf-generation` | 6s | 100 waiting |
| `financial-aggregation` | 12s | 100 waiting |
| `dlq` | 1s | 100 waiting (inspect immediately) |

**Immediate (0–5 min)**
1. `GET /admin/queue` — identify which queues are critical
2. If `dlq` queue > 100: `GET /admin/queue/dlq` — inspect failed jobs for systematic error
3. If `ai-generation` critical: pause non-essential AI jobs via `POST /admin/sre/degraded-mode`

**Diagnosis**
- BullMQ workers crashed: check ECS task logs in CloudWatch for uncaught exceptions
- Redis connection issue: check Upstash/ElastiCache connection count and memory usage
- Upstream spike (e.g. bulk order import): check `procurement-workflow` queue for correlated batch

**Remediation**
- Add worker replicas: update ECS task definition `desiredCount` for worker service
- Drain DLQ: `POST /admin/queue/dlq/retry-all` (batch retry with exponential backoff)
- If Redis OOM: flush completed/failed jobs — `removeOnComplete` and `removeOnFail` are already configured

**Recovery**
- All queues `healthy` (waiting < 10): `DELETE /admin/sre/degraded-mode`

---

### Payment Provider Degradation

**Symptoms**: `POST /payments/checkout` p99 spike, Stripe webhook delivery failures, order status stuck at `pending_payment`

**Immediate (0–3 min)**
1. Check Stripe status page: https://status.stripe.com
2. `GET /admin/sre/health` — check if `/payments` endpoint is throttled
3. Check webhook endpoint logs: CloudWatch `/aws/ecs/yourgift-api` filter `stripe.webhook`

**Diagnosis**
- Stripe API timeout: `stripeClient.timeout` default is 80s — check if requests are timing out before that
- Webhook signature failure: verify `STRIPE_WEBHOOK_SECRET` env var is correct in ECS task definition
- Currency conversion failure: check `CurrencyService` last successful rate fetch timestamp

**Remediation**
- Activate payment circuit breaker: set `PAYMENT_CIRCUIT_OPEN=true` env var, redeploy task (orders will queue in `procurement-workflow` with `pendingPayment` status)
- Queue retry for failed webhooks: Stripe automatically retries for 72 hours — verify webhook endpoint returns 200
- Manual reconciliation: `POST /admin/reconciliation/run` after Stripe recovers

**SLO Impact**
- Payment SLO: 99.5% success rate over 24h window
- Recovery target: < 15 minutes to restore payment flow

---

### Reconciliation Drift

**Symptoms**: `budget-ledger` totals don't match `orders` totals, `openAnomalies` count rising in `GET /observability/snapshots`

**Immediate (0–10 min)**
1. `GET /admin/reconciliation/status` — check last successful run timestamp
2. `GET /admin/observability/alerts` — check for `budget_anomaly` alerts
3. Verify CRON job `financial-aggregation` is firing: check CloudWatch Events rule `yourgift-reconciliation-cron`

**Diagnosis**
- Currency rounding drift: check `CurrencyService.convert()` for floating-point truncation vs. bankers' rounding
- Cancelled order not reflected: check `ORDER_CANCELLED` event handler in `budget-ledger` service
- Supplier partial fulfillment: check `fulfillment` module for partial invoice recording

**Remediation**
- Trigger manual reconciliation: `POST /admin/reconciliation/run?fromDate=YYYY-MM-DD`
- If drift > 0.5% of daily GMV: escalate to Finance team, freeze affected tenant ledger pending audit
- Patch and re-run: fix root cause in code, deploy, then `POST /admin/reconciliation/backfill`

**SLO**: Reconciliation must complete within 1h of period close with drift < 0.01% of period GMV

---

## SLO Dashboard

### Tier 1 — Availability

| Metric | Target | Measurement Window | Alert Threshold |
|---|---|---|---|
| API availability | 99.9% | Rolling 30 days | < 99.9% |
| Payment endpoint availability | 99.95% | Rolling 30 days | < 99.95% |
| Webhook delivery success | 99.5% | Rolling 24h | < 99.5% |

### Tier 2 — Latency

| Endpoint Group | p50 Target | p95 Target | p99 Target | Breach Action |
|---|---|---|---|---|
| Read endpoints (`GET`) | < 50ms | < 300ms | < 800ms | Throttle if p99 > 800ms |
| Write endpoints (`POST/PATCH`) | < 100ms | < 500ms | < 1500ms | Alert at p99 > 1500ms |
| AI generation routes | < 500ms | < 5000ms | < 15000ms | Degrade if p95 > 5000ms |
| Payment routes | < 200ms | < 800ms | < 2000ms | Page on-call if p99 > 2000ms |

### Tier 3 — Queue Processing

| Queue | Max Lag (waiting jobs) | Max Lag Time | SLO |
|---|---|---|---|
| `email` | < 50 | < 2 min | 99.5% delivered within 5 min |
| `ai-generation` | < 20 | < 5 min | 95% completed within 30 min |
| `procurement-workflow` | < 30 | < 3 min | 99% completed within 15 min |
| `financial-aggregation` | < 10 | < 2 min | 100% completed within 1h of trigger |
| `dlq` | < 5 | < 10 min | Requires immediate operator attention |

### Error Budget Burn Rate

- **Critical burn rate**: > 14.4× in 1h window → page immediately
- **Warning burn rate**: > 6× in 6h window → alert on-call
- Calculated as: `(1 - current_success_rate) / (1 - SLO_target)`

---

## On-Call Runbook

### Pre-Shift Checklist

Before taking on-call handoff, verify:
- [ ] `GET /admin/sre/health` returns `systemStatus: 'healthy'`
- [ ] `GET /admin/sre/remediations` — no unresolved `critical` actions from previous shift
- [ ] `GET /admin/queue` — all queues `healthy` or `degraded` (not `critical`)
- [ ] CloudWatch dashboard `yourgift-sre` shows green across all metrics
- [ ] BetterStack heartbeat last ping < 2 min ago

### Escalation Matrix

| Severity | Response Time | Escalation Path |
|---|---|---|
| P1 — Payment down | < 5 min | On-call engineer → Tech Lead → CTO |
| P2 — SLO breach > 1h | < 15 min | On-call engineer → Tech Lead |
| P3 — Queue overload | < 30 min | On-call engineer |
| P4 — Warning alerts | < 4h | On-call engineer (next business day) |

### Key Admin Endpoints

| Action | Endpoint | Method |
|---|---|---|
| System health | `/admin/sre/health` | GET |
| Remediation log | `/admin/sre/remediations` | GET |
| Throttle endpoint | `/admin/sre/throttle/:endpoint` | POST / DELETE |
| Degraded mode | `/admin/sre/degraded-mode` | POST / DELETE |
| Deploy health gate | `/admin/sre/rollback/health-check` | GET |
| Create rollback plan | `/admin/sre/rollback` | POST |
| Execute rollback | `/admin/sre/rollback/:id/execute` | POST |
| Active rollback plans | `/admin/sre/rollback/active` | GET |

### Rollback Decision Tree

```
Is the deployment causing the incident?
├── YES → createRollbackPlan(reason, previousVersion)
│         → validateDeployHealth() — wait for gate to pass or override
│         → executeRollback(rollbackId)
│         → monitor GET /admin/sre/health for 10 min
└── NO  → Follow appropriate incident playbook (latency/queue/payment/reconciliation)
```

### Post-Incident Actions (within 24h)

1. Write incident summary in Notion: link from `Notion Aprendizagens`
2. Create Jira ticket for root cause fix
3. Update `QUEUE_RETRY_CONFIG` if a queue retry policy contributed
4. Review SLO burn rate — adjust alert thresholds if signal was noisy
5. Add regression test to CI (unit test for the triggering condition)

---

## Certification Status

| Control | Status | Last Verified |
|---|---|---|
| SLO definitions documented | PASS | 2026-05-25 |
| Auto-remediation engine deployed | PASS | 2026-05-25 |
| Rollback plan creation + execution | PASS | 2026-05-25 |
| Health gate in CI/CD pipeline | PENDING | — |
| On-call rotation configured | PENDING | — |
| Incident playbooks reviewed by team | PENDING | — |
| BetterStack heartbeat monitors active | PENDING | — |
| PagerDuty webhook integration | PENDING | — |
| SLO error budget dashboard in CloudWatch | PENDING | — |
| Quarterly SLO review scheduled | PENDING | — |
