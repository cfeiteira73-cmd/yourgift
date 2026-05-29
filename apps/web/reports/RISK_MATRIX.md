# RISK MATRIX
**YourGift OS — Enterprise Risk Register**
**Generated:** 2026-05-28

---

## Risk Scoring: P × I (Probability × Impact, 1-5 each)

---

## CRITICAL RISKS (Score ≥ 16)

### R-01: Production Secrets Missing from Vercel
- **Score:** 5×5 = 25 🔴
- **Description:** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EXCHANGE_RATE_API_KEY` not confirmed in production Vercel environment.
- **Impact:** AI features down, admin financial routes return empty data, currency conversion uses stale fallback rates.
- **Probability:** Near-certain until action taken.
- **Mitigation:** Add 3 env vars to Vercel → Settings → Environment Variables.
- **Owner:** DevOps | **Deadline:** Before next deploy

### R-02: No Stripe Inbound Webhook Handler
- **Score:** 4×5 = 20 🔴
- **Description:** No `/api/webhooks/stripe` route exists. Payment confirmations are not automatically processed.
- **Impact:** Orders not automatically confirmed on payment. Manual intervention required.
- **Probability:** High — any Stripe integration requires webhook handling.
- **Mitigation:** Create Stripe webhook handler with `stripe.webhooks.constructEvent()`.
- **Owner:** Backend | **Deadline:** Before financial transactions enabled

---

## HIGH RISKS (Score 9-15)

### R-03: No Idempotency on Payment Mutations
- **Score:** 3×5 = 15 🟠
- **Description:** Stripe API calls lack `Idempotency-Key` headers.
- **Impact:** Network retry → double charge or double credit. Financial integrity violation.
- **Probability:** Medium (network retries are common).
- **Mitigation:** Add `Idempotency-Key: crypto.randomUUID()` to Stripe API calls; store key in Supabase.

### R-04: SUPABASE_SERVICE_ROLE_KEY Missing
- **Score:** 4×4 = 16 🔴
- **Description:** Admin financial routes use anon key, blocked by RLS.
- **Impact:** `/api/reconciliation`, `/api/financial` return empty data silently for admins.
- **Probability:** High (key not in local .env.local).
- **Mitigation:** Add to Vercel env vars.

### R-05: Single Point of Failure — Supabase
- **Score:** 2×5 = 10 🟠
- **Description:** All auth, data, and realtime depend on single Supabase project.
- **Impact:** Complete service outage if Supabase goes down.
- **Probability:** Low (Supabase SLA 99.9%), but non-zero.
- **Mitigation:** Dashboard RSC error caught by `(portal)/error.tsx`. Client pages: try/catch/finally prevents infinite spinners. Consider Supabase read replicas for critical queries.

### R-06: No Multi-User Company Support
- **Score:** 3×4 = 12 🟠
- **Description:** Enterprise companies need multiple users per account.
- **Impact:** Cannot serve enterprise contracts requiring role-based team access.
- **Probability:** High — enterprise clients will request this.
- **Mitigation:** Add `company_members` table + RLS policy update.

### R-07: No CSP Header
- **Score:** 3×4 = 12 🟠
- **Description:** Content Security Policy not configured.
- **Impact:** XSS payload could execute arbitrary scripts if injection occurs.
- **Probability:** Low (React JSX escaping + nosniff headers).
- **Mitigation:** Add strict-dynamic CSP with nonce.

---

## MEDIUM RISKS (Score 4-8)

### R-08: AI Token Cost Exposure
- **Score:** 3×3 = 9 🟡
- **Description:** Rate limiting is in-process only (resets per serverless instance).
- **Impact:** Burst of requests across instances could exceed Anthropic quota.
- **Probability:** Low-medium (30/60s limit is generous for normal use).
- **Mitigation:** Current: in-process Map. Future: Redis/Upstash for cross-instance.

### R-09: Stale Exchange Rates
- **Score:** 3×3 = 9 🟡
- **Description:** Without `EXCHANGE_RATE_API_KEY`, fallback rates hardcoded (last updated manually).
- **Impact:** Wrong currency conversion amounts displayed to clients.
- **Probability:** High if env var missing.
- **Mitigation:** Add env var; fallback rates noted as approximate.

### R-10: Mock Data in 8 Portal Pages
- **Score:** 4×2 = 8 🟡
- **Description:** `approvals`, `artwork`, `flags`, `forecasting`, `infra`, `integrations`, `inventory`, `marketing` use static/Math.random() data.
- **Impact:** Portal shows fabricated numbers. Client trust risk.
- **Probability:** Guaranteed issue unless connected to real data.
- **Mitigation:** Connect each page to Supabase queries (medium effort per page).

### R-11: No Automated Database Backups Verified
- **Score:** 2×4 = 8 🟡
- **Description:** Supabase provides daily backups but no application-level backup strategy.
- **Impact:** Data loss in catastrophic failure scenario.
- **Probability:** Low (Supabase backup SLA).
- **Mitigation:** Confirm Supabase backup schedule; add S3 PITR export for critical tables.

### R-12: No npm audit in CI
- **Score:** 2×4 = 8 🟡
- **Description:** Dependency vulnerabilities not automatically detected.
- **Impact:** Known CVEs could be present in production dependencies.
- **Mitigation:** Add `npm audit --audit-level=high` to GitHub Actions workflow.

### R-13: Webhook Delivery Not Retried
- **Score:** 3×3 = 9 🟡
- **Description:** Failed webhook deliveries are logged but not automatically retried.
- **Impact:** Clients miss critical events (order.created, invoice.paid).
- **Mitigation:** Add retry queue — SQS or Supabase Edge Function with exponential backoff.

---

## LOW RISKS (Score 1-3)

### R-14: ADMIN_EMAILS Accidental Modification
- **Score:** 1×5 = 5 🟢
- **Description:** Immutable in code but not enforced at runtime.
- **Mitigation:** Documented in CLAUDE.md; security audit on every PR.

### R-15: Console.log in Production Code
- **Score:** 2×2 = 4 🟢
- **Description:** Internal state logged to server logs.
- **Mitigation:** Replace with structured logging (Datadog/Sentry integration).

### R-16: No Request ID / Distributed Tracing
- **Score:** 2×2 = 4 🟢
- **Description:** No X-Request-ID header for cross-service correlation.
- **Mitigation:** Add middleware-generated request ID header.

---

## Risk Dashboard

```
CRITICAL [🔴]: R-01(25), R-02(20), R-04(16)
HIGH     [🟠]: R-03(15), R-05(10), R-06(12), R-07(12)
MEDIUM   [🟡]: R-08(9), R-09(9), R-10(8), R-11(8), R-12(8), R-13(9)
LOW      [🟢]: R-14(5), R-15(4), R-16(4)
```

---

## Immediate Actions (This Week)

1. ✅ Add 3 Vercel env vars (R-01, R-04, R-09)
2. 🔲 Build Stripe webhook handler (R-02)
3. 🔲 Add idempotency keys (R-03)
4. 🔲 Add npm audit to CI (R-12)

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-28*
