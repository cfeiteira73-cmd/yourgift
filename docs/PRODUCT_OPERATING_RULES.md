# YourGift OS — Product Operating Rules

> The 14 non-negotiable rules that govern how this platform operates.
> Every engineer, every feature, every decision must respect these.

---

## Rule 1: One Screen, Full Context

A procurement manager must be able to decide on a quote in under 30 seconds.

The `POST /decision-engine/card` endpoint returns a single `DecisionCard` with:
- Landed cost (product + shipping + duties + VAT)
- Supplier trust score (GOLD / SILVER / BRONZE / PROBATION)
- Budget availability and utilisation
- Delivery feasibility vs campaign deadline
- Risk level (GREEN / AMBER / RED) with human-readable factors
- Recommended action (APPROVE / APPROVE_WITH_CONDITIONS / REJECT)

**Violation**: Any feature that requires switching between screens to make a procurement decision.

---

## Rule 2: Landed Cost Is Always the True Cost

Never show a product price without shipping, duties, VAT and handling.

`LandedCostService.calculate()` is mandatory before any quote is presented.
`confidence: 'LOW'` must be surfaced prominently in the UI with a warning.

**Violation**: Showing unit price without landed cost breakdown.

---

## Rule 3: Supplier Trust Is Earned, Not Assumed

New suppliers start at `tier: 'NEW'` with `trustScore: null`.
Trust is computed from actual vs predicted: cost accuracy (40%), lead time (35%), quality (25%).
GOLD requires ≥92% accuracy across ≥10 orders.
PROBATION is triggered automatically when onTimeDeliveryRate < 60% or costAccuracyRate < 70%.

Probation blocks APPROVE actions — only APPROVE_WITH_CONDITIONS or REJECT allowed.

**Violation**: Treating a new supplier as trusted without order history.

---

## Rule 4: Multi-Tenant Isolation is Absolute

Every database query must include `tenantId` as a filter.
`TenantGuard` enforces this at the HTTP layer — it will block any request where
the JWT `tenantId` doesn't match the resource's `tenantId`.

Admin users bypass tenant checks but all actions are logged with `user.sub`.

**Violation**: Any query that returns data from multiple tenants in a single response.

---

## Rule 5: Rate Limits Are Per Tenant, Not Per IP

`TenantThrottlerGuard` uses `tenant:{tenantId}` as the rate limit bucket.
Limits: 20 req/s (short), 200 req/min (long).
Admin accounts get 5× multiplier.
Unauthenticated requests fall back to `ip:{ip}` using `cf-connecting-ip`.

**Violation**: Using IP-based rate limiting for authenticated API endpoints.

---

## Rule 6: Every Job Goes Through BullMQ

Async work (email, PDF, supplier sync, financial aggregation) must go through
a named BullMQ queue with:
- `attempts: 3`
- `backoff: { type: 'exponential', delay: 5000 }`
- DLQ capture on final failure via `DlqService.capture()`

No `setTimeout`, no fire-and-forget `Promise` chains for business-critical operations.

Key prefix: `{yourgift}:*` — isolates from shared Upstash Redis.

**Violation**: Inline async operations that can silently fail.

---

## Rule 7: Stripe Webhooks Are Idempotent

Every Stripe webhook event is checked against `StripeEvent` table before processing.
`markEventProcessed()` is called immediately after handling.
Duplicate events are silently acknowledged (200 OK, no processing).

All 8 critical event types are handled:
`checkout.session.completed`, `checkout.session.expired`,
`payment_intent.payment_failed`, `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed`,
`invoice.paid`, `invoice.payment_failed`

**Violation**: Processing a Stripe event without idempotency check.

---

## Rule 8: Error Tracking Is Never Optional

All 5xx errors are captured to Sentry with:
- `user.id` + `tenantId` on scope
- `path` + `method` tags
- `sendDefaultPii: false` (GDPR)
- `Authorization` and `cookie` headers scrubbed

`SENTRY_DSN` must be set in production. Empty DSN = silent no-op (acceptable only in dev).

**Violation**: Catching errors without sending to Sentry in production.

---

## Rule 9: SCIM Provisioning Must Be Fast

SCIM endpoints (RFC 7644) must respond within 2 seconds.
DB provisioning (`provisionInDatabase`) is fire-and-forget — SCIM response must not wait.
SCIM bearer tokens are per-tenant and never shared across tenants.

SCIM routes: `/scim/v2/tenants/:tenantId/Users`, `/scim/v2/tenants/:tenantId/Groups`

**Violation**: Blocking SCIM response on database operations.

---

## Rule 10: ROI Reports Close Deals

Every enterprise account must be able to generate a CFO-ready ROI report via:
`POST /intelligence/roi` → `{ totalSavingsEur, roiPct, shareUrl }`

The share URL must be public-access (no auth) so CFOs can open it without logging in.
Target ROI to communicate: 300–800% (savings vs platform cost).

**Violation**: Requiring login to view a shared ROI report.

---

## Rule 11: Security Headers on Every Response

All HTTP responses must include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy` with `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- No `X-Powered-By` or `Server` headers (fingerprinting prevention)

Cloudflare injects these at edge via `infra/cloudflare/waf.tf`.

**Violation**: Responses that expose framework/server identity.

---

## Rule 12: Backup is Not a Feature — It's a Requirement

- **Database**: Supabase PITR enabled (Pro plan) — RPO 5 minutes
- **Files**: S3 versioning enabled + cross-region replication (eu-west-1 → eu-west-2)
- **AWS Backup**: Daily (30 days) + Weekly Glacier (1 year) + Monthly compliance (7 years)
- **Redis**: Queues are ephemeral — BullMQ job definitions are in code, not Redis

Test restore quarterly: `supabase db restore --ref <ref> --target <timestamp>`

**Violation**: Enabling a new data store without a backup plan.

---

## Rule 13: AI Bots Can Read Us

`/llms.txt` describes the full platform capability for AI assistants.
`robots.ts` explicitly allows GPTBot, Claude-Web, PerplexityBot, Anthropic-AI.
This is a sales channel — enterprise buyers ask "what procurement platforms exist?"
to AI assistants before they search Google.

**Violation**: Blocking AI crawlers from public marketing pages.

---

## Rule 14: The Platform Is SAP × Amazon Logistics × Palantir for Procurement

This is not a gift catalogue. This is enterprise procurement infrastructure.

Every feature must answer: "Does this help a €50M company buy €2M of branded merchandise
with full budget visibility, supplier accountability, and CFO-ready reporting?"

The competitive moat is:
1. **Speed**: decision in <30 seconds vs 2 days manual
2. **Accuracy**: predicted vs actual tracking, supplier trust scores
3. **Compliance**: budget hierarchy, approval workflows, audit trail
4. **Intelligence**: ROI reports, market benchmarks, landed cost truth

**Violation**: Features that solve one-off requests instead of systematic procurement problems.

---

## Architecture Quick Reference

```
Request → Cloudflare WAF → Render API (NestJS 10)
                                ↓
              TenantThrottlerGuard (20 req/s per tenant)
                                ↓
              TenantGuard (tenantId isolation)
                                ↓
              JwtAuthGuard (Bearer JWT)
                                ↓
              Controller → Service → Prisma → Supabase
                                ↓
              Async work → BullMQ Queue → Worker
                                ↓
              Errors → Sentry (scrubbed, no PII)
```

## Key Service Map

| Capability | Service | Endpoint |
|---|---|---|
| Landed cost | `LandedCostService` | `POST /logistics/landed-cost` |
| Decision card | `ProcurementDecisionCardService` | `POST /decision-engine/card` |
| Supplier trust | `ProcurementAccuracyService` | `GET /intelligence/suppliers/:id/trust` |
| ROI report | `ROIReportService` | `POST /intelligence/roi` |
| SCIM provisioning | `SCIMService` | `/scim/v2/tenants/:tenantId/Users` |
| OIDC SSO | `OIDCService` | `GET /enterprise-identity/oidc/:tenantId/login` |
| Queue admin | `QueueAdminController` | `GET /admin/queues` |
| Health | `HealthService` | `GET /health` |

## Deployment Checklist

- [ ] `SENTRY_DSN` set in Render env vars
- [ ] `UPSTASH_REDIS_URL` set (prefix `{yourgift}` in queue.module.ts)
- [ ] `SCIM_TOKEN_{TENANT_ID}` set per enterprise tenant
- [ ] Supabase PITR enabled (Pro plan)
- [ ] Cloudflare WAF deployed: `terraform apply -var-file=cloudflare.tfvars`
- [ ] AWS Backup plan active + test restore completed
- [ ] `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard webhook signing secret
- [ ] `JWT_SECRET` ≥32 chars, rotated every 90 days
