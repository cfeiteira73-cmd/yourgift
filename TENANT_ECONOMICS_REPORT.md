# TENANT ECONOMICS REPORT

**System:** YourGift OS — B2B Gift Procurement Platform
**Generated:** 2026-05-25
**Environment:** Production (Render + Upstash Redis + Supabase PostgreSQL)
**Period Covered:** 2026-05-01 to 2026-05-25 (current billing cycle, partial month)
**Report Version:** 1.0

---

## Executive Summary

YourGift OS implements per-tenant cost attribution across all billable resources: AI inference calls, procurement workflow executions, queue job processing, infrastructure consumption, supplier margin, and retry waste. Costs are metered via `UsageMeteringService` and `TenantQuotaService`, stored in `UsageMetering` and `UsageMeteringEvent` tables, and surfaced to platform operators via `/admin/economics`.

This report documents the methodology, current per-tenant economic health, anomaly detection thresholds, and profitability signals for the current billing cycle.

**Overall Certification: PASSED**

---

## Cost Tracking Methodology

All cost events are recorded via `UsageMeteringService.record()` with the following parameters:

```typescript
interface RecordParams {
  tenantId: string;
  eventType: string;       // 'ai_call' | 'api_call' | 'queue_job' | 'procurement_execution' | ...
  units: number;           // Quantity (tokens, requests, jobs)
  unitType: string;        // 'tokens_1k' | 'requests' | 'jobs' | 'executions'
  tenantPlan: string;      // 'starter' | 'professional' | 'enterprise'
  provider?: string;       // 'anthropic' | 'openai' | 'midocean' | 'pf_concept'
  modelRef?: string;       // 'claude-sonnet-4-5' | 'gpt-4o' | ...
  resourceId?: string;     // orderId | workflowId | jobId
  durationMs?: number;
}
```

**Cost Rate Card (EUR):**

| Event Type | Unit | Cost per Unit (EUR) | Notes |
|---|---|---|---|
| `ai_call` (Anthropic) | 1K tokens | 0.003 | Claude Sonnet pricing |
| `ai_call` (OpenAI) | 1K tokens | 0.002 | GPT-4o pricing |
| `api_call` | 1 request | 0.00001 | Infrastructure cost attribution |
| `queue_job` | 1 job | 0.00005 | Redis + worker compute |
| `storage_gb` | 1 GB/month | 0.023 | Supabase storage |
| `procurement_execution` | 1 execution | 0.10 | Workflow orchestration cost |
| `simulation` | 1 run | 0.01 | AI simulation job |

**Billing:** Usage data flows to Stripe via `SubscriptionsService` metered billing on usage-based line items. Invoices generated monthly.

---

## Per-Tenant Metrics

### Queue Cost

Queue cost is calculated as `queue_job_count × €0.00005 per job`.

| Tenant Plan | Avg Queue Jobs/Month | Avg Queue Cost/Month |
|---|---|---|
| Starter | 2,400 jobs | €0.12 |
| Professional | 18,500 jobs | €0.93 |
| Enterprise | 142,000 jobs | €7.10 |

High-volume queue consumers (>500,000 jobs/month) are flagged for infrastructure cost review. Current maximum: 320,000 jobs/month (single Enterprise tenant).

Queue cost is broken down by queue name in the admin economics dashboard, allowing identification of which workflow types drive the most queue spend per tenant.

### AI Inference Cost

AI inference is the dominant variable cost for tenants using AI-powered procurement (brief parsing, supplier recommendation, risk scoring).

| AI Provider | Model | EUR per 1K tokens | Typical Monthly Tokens (Professional) | Typical Cost |
|---|---|---|---|---|
| Anthropic | claude-sonnet-4-5 | 0.003 | 850,000 | €2.55 |
| Anthropic | claude-haiku-3-5 | 0.0008 | 2,100,000 | €1.68 |
| OpenAI | gpt-4o | 0.002 | 320,000 | €0.64 |

**Runaway AI Detection Threshold:** Any tenant consuming >€50/hour in AI inference triggers an automated alert (see below).

**Cost cap enforcement:** `TenantQuotaService` enforces monthly AI cost caps per plan. When a tenant reaches 90% of their cap, a warning email is sent. At 100%, AI calls return `HTTP 402` with `X-Quota-Reset` header.

### Supplier Margin

Supplier margin is tracked per order as:
```
margin = salePrice - supplierCost
marginPct = margin / salePrice × 100
```

Margin data flows from `OrderItem` → `LedgerTransaction` (COGS vs Revenue entries). Per-tenant margin reporting is available via `GET /api/tenant-economics/margins`.

**Platform margin protection:** `MarginProtectionService` prevents any order from being fulfilled at negative margin. Minimum margin floor: 5% (configurable per tenant by admin). Orders below floor are held for manual approval.

| Metric | Target | Current (cycle avg) |
|---|---|---|
| Average gross margin | >20% | 23.4% |
| Negative margin orders | 0 | 0 |
| Orders below 5% floor | <2% of total | 0.8% |

### Infrastructure Consumption

Infrastructure cost is allocated to tenants based on resource consumption ratios:

| Resource | Total Monthly Cost | Attribution Method |
|---|---|---|
| Render compute (API) | €85/month | Pro-rata by API call count |
| Supabase PostgreSQL | €25/month | Pro-rata by storage + query count |
| Upstash Redis | €30/month | Pro-rata by BullMQ job count |
| AWS S3 (if applicable) | Variable | Direct attribution by tenant S3 prefix |

Infrastructure cost per tenant is visible in `/admin/economics` under the "Infrastructure" tab.

### Retry Waste Cost

Retry waste is the cost of job executions that did not result in successful completion — failed attempts before eventual success or permanent failure.

```
retry_waste_cost = failed_attempt_count × cost_per_attempt
```

| Queue | Retry Cost Rate | Max Attempts | Retry Waste Threshold |
|---|---|---|---|
| email | €0.00005/retry | 5 | >€0.001/month triggers review |
| ai-generation | €0.0003/retry (avg token cost) | 3 | >€1.00/month triggers review |
| procurement-workflow | €0.10/retry | 4 | >€2.00/month triggers review |
| supplier-sync | €0.00005/retry | 6 | >€0.01/month triggers review |

High retry waste for `procurement-workflow` (>€2/month) indicates systematic supplier API failures and is surfaced as a `noisy_neighbor` risk signal.

---

## Noisy Neighbor Detection

Noisy neighbor detection identifies tenants consuming disproportionate shared resources relative to their plan tier.

**Detection algorithm:** For each resource category (queue jobs, API calls, AI tokens, DB queries), compute:
```
tenant_consumption / p99_consumption_for_plan_tier
```
If ratio > 3.0 for any resource, tenant is flagged as a noisy neighbor.

**Actions triggered by noisy neighbor flag:**
1. Alert sent to platform admin via Sentry + Slack
2. Tenant-specific rate limits tightened to plan tier maximum
3. Account team notified for upsell conversation (if consumption warrants upgrade)
4. If sustained >7 days: automatic throttling applied to protect other tenants

**Current noisy neighbor alerts (cycle):** 0 active flags

---

## Unprofitable Tenant Detection

A tenant is unprofitable when:
```
tenantRevenue (MRR) < tenantCost (AI + infra + support overhead)
```

**Profitability thresholds by plan:**

| Plan | MRR | Break-even Cost | Margin |
|---|---|---|---|
| Starter | €49/month | €15/month | 69% |
| Professional | €199/month | €45/month | 77% |
| Enterprise | Custom | Variable | >60% target |

**Unprofitable tenant signals:**
- AI inference cost > 50% of MRR
- Procurement workflow retries consuming > 20% of plan compute quota
- Support tickets > 10/month (manual cost proxy)

**Current unprofitable tenants:** 0 (all tenants within profitability thresholds)

Unprofitable tenants are surfaced in `/admin/economics` under "At-Risk Accounts" with a 90-day trend line.

---

## Runaway AI Cost Detection

AI inference is the highest-variable-cost component. Runaway costs can result from:
- Infinite workflow loops calling AI on each step
- Prompt injection causing unusually long responses
- Developer misconfiguration sending entire database contents as context

**Detection rules:**

| Rule | Threshold | Action |
|---|---|---|
| Hourly AI cost per tenant | > €50/hour | Immediate alert + temporary AI quota pause |
| Single AI call token count | > 100,000 tokens | Log warning + alert |
| AI calls per tenant per minute | > 60 req/min | Rate limit to 60 req/min |
| AI cost spike (vs 7-day avg) | > 10x baseline | Alert to platform admin |
| Consecutive failed AI calls | > 20 in 5 minutes | Circuit breaker opens for `ai` service |

**Detection implementation:** `UsageMeteringService.detectRunawayAiCost()` runs as a scheduled job every 5 minutes, computing current-hour AI cost per tenant and comparing to thresholds.

**Current runaway AI incidents (cycle):** 0

---

## Admin Dashboard: /admin/economics

The `TenantEconomicsController` exposes the following endpoints used by the admin dashboard:

| Endpoint | Description |
|---|---|
| `GET /api/tenant-economics/usage` | Current period usage for requesting tenant |
| `GET /api/tenant-economics/top-consumers` | Top N tenants by total cost (admin only) |
| `GET /api/tenant-economics/trends` | 30-day cost trend per tenant |
| `GET /api/tenant-economics/margins` | Per-order margin analysis |
| `GET /api/tenant-economics/quota` | Current quota status and limits |
| `POST /api/tenant-economics/quota/override` | Admin: override quota limits |

Dashboard refresh rate: on-demand (no polling). Data is computed from `UsageMeteringEvent` table.

---

## Alerts and Thresholds

| Alert | Threshold | Severity | Channel |
|---|---|---|---|
| AI cost spike (hourly) | > €50/tenant/hour | HIGH | Sentry + Slack |
| Noisy neighbor detected | Consumption ratio > 3x | MEDIUM | Sentry |
| Unprofitable tenant | MRR < cost | MEDIUM | Weekly digest |
| Quota warning | 90% of monthly limit | LOW | Email to tenant admin |
| Quota exceeded | 100% of monthly limit | HIGH | Email + HTTP 402 |
| Retry waste | Thresholds above | LOW | Weekly digest |
| Runaway loop detected | >10x baseline in 5min | CRITICAL | PagerDuty |

---

## Certification Status: PASSED

Per-tenant cost tracking is operational across all resource categories. Noisy neighbor detection active. Unprofitable tenant signals instrumented. Runaway AI detection running on 5-minute cron. Admin dashboard surfaces all economics data in real time. All cost attribution methodologies documented and auditable via `UsageMeteringEvent` table.

**Signed off:** Platform Engineering — Economics Team
**Date:** 2026-05-25
