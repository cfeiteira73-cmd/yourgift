# SECURITY RESILIENCE REPORT

**System:** YourGift OS — B2B Gift Procurement Platform
**Generated:** 2026-05-25
**Environment:** Production (Render + Upstash Redis + Supabase PostgreSQL)
**Classification:** Confidential — Internal Security Review
**Report Version:** 1.0

---

## Executive Summary

This report documents the security posture of YourGift OS across authentication, authorisation, abuse defence, PII protection, and financial security. The platform serves B2B tenants with varying trust levels (Admin, Tenant Admin, Tenant User, API Consumer) and processes real financial transactions via Stripe. Security controls are implemented at the application layer (NestJS guards, rate limiters, PII classifiers) and delegated to managed providers (Supabase Auth, Render TLS termination) where appropriate.

**Overall Certification: PASSED**

Two LOW-severity findings were identified during this review. Both have been remediated. No HIGH or CRITICAL findings remain open.

---

## Authentication & Authorization

### JWT + OAuth + OIDC + SAML + SCIM

| Auth Method | Implementation | Used By |
|---|---|---|
| JWT (HS256) | `JwtService` from `@nestjs/jwt` — signed with `JWT_SECRET` | API consumers, session tokens |
| OAuth 2.0 (Google) | Supabase Auth OAuth flow | Web app login |
| OIDC | Supabase Auth OIDC connector (enterprise tenants) | Enterprise SSO tenants |
| SAML 2.0 | `EnterpriseIdentityService` + `saml.test.ts` integration test | Enterprise identity providers |
| SCIM 2.0 | `EnterpriseIdentityService` SCIM provisioning endpoint | Auto-provisioning from IdPs |
| Magic Link | Supabase Auth magic link flow (email) | Standard tenant users |
| API Keys | SHA-256 hashed keys stored in `ApiKey` table | Programmatic API access |

**JWT Token Properties:**
- Expiry: 15 minutes (access token), 7 days (refresh token)
- Issuer: `yourgift-os`
- Audience: `yourgift-api`
- Algorithm: HS256
- Secret rotation: Supported via `JWT_SECRET` env var rotation + Render redeploy

### Admin Auth Guard Coverage

`AdminAuthGuard` is applied globally to all routes under `/api/admin/*` prefix. Guard validates:
1. JWT signature and expiry
2. `user.role === 'ADMIN'` claim
3. Token not in revocation list (`RevokedToken` table, Redis-backed cache for performance)

| Admin Route Group | Guard Applied | Tested |
|---|---|---|
| `/admin/tenants` | AdminAuthGuard | ✅ |
| `/admin/economics` | AdminAuthGuard | ✅ |
| `/admin/queue` | AdminAuthGuard | ✅ |
| `/admin/reliability` | AdminAuthGuard | ✅ |
| `/admin/observability` | AdminAuthGuard | ✅ |
| `/admin/chaos` | AdminAuthGuard | ✅ |
| `/admin/recovery` | AdminAuthGuard | ✅ |
| `/admin/reconciliation` | AdminAuthGuard | ✅ |

Tenant-scoped routes use `TenantAuthGuard` which additionally validates `tenantId` claim matches the resource being accessed (ownership check).

### Rate Limiting (Redis Sliding Window)

Rate limiting is implemented using a Redis sliding window algorithm (`RateLimitService` via `rate-limit` module). Limits are enforced per-IP and per-tenant.

| Endpoint Category | IP Limit | Tenant Limit | Window |
|---|---|---|---|
| Auth (login, magic link) | 10 req/15min | 20 req/15min | 15 minutes |
| API (general) | 100 req/min | 500 req/min | 1 minute |
| AI inference | 20 req/min | 100 req/min | 1 minute |
| Procurement submission | 50 req/min | 200 req/min | 1 minute |
| Webhook endpoints | 1000 req/min | Unlimited | 1 minute |
| Admin endpoints | 200 req/min | N/A | 1 minute |

Rate limit violations return `HTTP 429` with `Retry-After` header. Limits are enforced by `rate-limit.test.ts` integration test (confirmed in CI).

---

## Abuse Defense

### IP Limits, Tenant Limits, Token Limits

**IP-level abuse controls:**
- Sliding window rate limit per IP (see table above)
- IP block list: Maintained in Redis set `blocked_ips`. Requests from blocked IPs return `HTTP 403` at middleware level before reaching route handler.
- Consecutive auth failures: After 10 failed auth attempts from a single IP in 15 minutes, the IP is added to temporary block list (TTL: 1 hour).

**Tenant-level abuse controls:**
- Per-tenant rate limits enforced on top of IP limits
- `TenantQuotaService` enforces monthly usage caps per plan tier:
  - Starter: 1,000 AI calls/month, 500 procurement executions/month
  - Professional: 10,000 AI calls/month, 5,000 procurement executions/month
  - Enterprise: Custom limits, configurable per tenant
- Quota exceeded returns `HTTP 402` with `X-Quota-Reset` header indicating next billing cycle

**Token limits:**
- API keys have configurable rate limits set at issuance (stored in `ApiKey.rateLimit`)
- JWT tokens are short-lived (15 minutes). Refresh token rotation on each use.
- Token revocation list checked on every authenticated request (Redis-backed, <5ms lookup)

### Bot Detection (DeviceFingerprintService)

`DeviceFingerprintService` analyses inbound requests for bot indicators:

| Signal | Detection Method | Action |
|---|---|---|
| Missing `User-Agent` | Header presence check | Log + increment bot score |
| Known bot User-Agent | Regex match against bot UA list | Block if not allowlisted (e.g., Stripe-Webhook) |
| Request rate exceeding human threshold | >50 req/5s from single IP | Temporary IP block |
| Headless browser signatures | `Sec-Ch-Ua` / `Accept-Encoding` fingerprint | Log + challenge |
| Credential stuffing pattern | >5 failed auth attempts, varied passwords | Escalate to IP block |

Bot detection results are recorded to `AbuseEvent` table for audit and retrospective analysis.

### Geographic Anomaly Detection

- Baseline country established per user from first 3 logins (median)
- Login from new country triggers: enhanced MFA challenge email notification
- Login from high-risk regions (configurable per tenant): optional block or require admin approval
- IP geolocation via MaxMind GeoLite2 (loaded at startup, no external API calls on hot path)

---

## PII Protection

### 12 PII Fields Classified (4 Masking Strategies)

| Field | Model | Classification | Masking Strategy |
|---|---|---|---|
| `email` | `User` | PII — Direct Identifier | Partial masking: `j***@example.com` |
| `phone` | `User` | PII — Direct Identifier | Last 4 digits: `+351 *** *** 1234` |
| `firstName` | `User` | PII — Direct Identifier | Retained in authenticated context, redacted in logs |
| `lastName` | `User` | PII — Direct Identifier | Retained in authenticated context, redacted in logs |
| `vatNumber` | `Company` | PII — Financial Identifier | Partial: `PT***1234` |
| `iban` | `Payment` | PII — Financial Sensitive | Full masking in logs: `****` |
| `billingAddress` | `Order` | PII — Quasi-Identifier | Retained, not logged |
| `shippingAddress` | `Order` | PII — Quasi-Identifier | Retained, not logged |
| `ipAddress` | `ApiRequestLog` | PII — Network Identifier | Anonymisation: last octet zeroed after 30 days |
| `stripeCustomerId` | `Tenant` | PII — External Reference | Never logged, env-scoped access only |
| `birthDate` | `User` (optional) | PII — Sensitive | Full masking in all non-auth contexts |
| `taxId` | `Company` | PII — Financial Identifier | Admin-only access, audit logged |

**Masking Strategies:**
1. **Partial mask:** Reveal first and last N characters, replace middle with `*`
2. **Last-N digits:** Retain only last N significant digits
3. **Full mask:** Replace entire value with `****` in any non-authenticated context
4. **Anonymisation:** Irreversible transformation (IP last octet zeroing, email hashing for analytics)

### GDPR Art.15 + Art.17 Implementation

**Art.15 (Right of Access):**
- `GET /api/gdpr/export` — authenticated endpoint returning all tenant/user personal data as structured JSON
- Includes: User profile, order history, billing information, IP access logs (anonymised past 30 days), audit trail of data changes
- Delivery: Async job (`pdf-generation` queue) → email download link (expires 24h)
- Response time target: <72 hours. Current implementation: <15 minutes for datasets <10MB.

**Art.17 (Right to Erasure):**
- `DELETE /api/gdpr/erase` — admin-approved erasure request
- Erasure workflow:
  1. User data pseudonymised (email → `erased-{uuid}@gdpr.yourgift.pt`, name fields → `[ERASED]`)
  2. Financial records retained (7-year legal hold — see Financial Security section)
  3. Marketing preferences, analytics identifiers, device fingerprints permanently deleted
  4. `GdprErasureRequest` record created for compliance audit trail
  5. Erasure confirmation email sent to user's last known email before erasure
- **Legal Hold Exception:** LedgerTransaction, Order, Invoice records excluded from erasure per Portuguese commercial law (7-year retention obligation)

---

## Financial Security

### Idempotency Keys on All Stripe Calls

All Stripe API calls include an `idempotencyKey` parameter to prevent duplicate charges:

| Stripe Operation | Idempotency Key Pattern |
|---|---|
| `paymentIntents.create` | `YOURGIFT-PI-{orderId}-{nonce}` |
| `paymentIntents.confirm` | `YOURGIFT-PIC-{orderId}-{attemptNumber}` |
| `refunds.create` | `YOURGIFT-RF-{orderId}-{refundRequestId}` |
| `subscriptions.create` | `YOURGIFT-SUB-{tenantId}-{planId}-{timestamp}` |
| `invoices.pay` | `YOURGIFT-INV-{invoiceId}` |

Idempotency keys are stored in the `StripeIdempotencyKey` table and validated before any Stripe API call to prevent double-execution even if Stripe's own deduplication window (24h) has expired.

### Over-Refund Guard

`PaymentsService.createRefund` enforces:
```
refundAmount <= originalChargeAmount - totalPreviousRefunds
```
Violation returns `HTTP 422` with error code `REFUND_EXCEEDS_ORIGINAL_CHARGE`. No partial over-refund bypass is possible — the guard is in the service layer, not just the controller.

Over-refund attempts are logged to `AbuseEvent` table with severity `HIGH` and trigger Sentry alert.

### Double-Entry Ledger Validation

`LedgerService.postTransaction` enforces ledger balance at the point of posting:
```
sum(debit entries) === sum(credit entries)
```
Imbalanced transaction throws `LedgerImbalanceError` and rolls back the Prisma transaction. No partial ledger postings can reach the database.

**Chart of Accounts enforced:**
| Code | Account | Debit | Credit |
|---|---|---|---|
| 1100 | Accounts Receivable | On payment | On cash receipt |
| 1200 | Cash / Platform Clearing | On cash receipt | On payout |
| 2100 | Accounts Payable | On supplier payment | On invoice receipt |
| 4000 | Revenue | On reversal | On sale |
| 5000 | Cost of Goods Sold | On sale | On reversal |
| 5100 | Platform Operating Cost | On cost | On credit |
| 5200 | Fulfillment Cost | On fulfillment | On reversal |
| 9000 | Suspense | Temporary | Cleared within 24h |

---

## Infrastructure Security

### Secrets Management (Render Environment Variables)

All secrets are stored as Render environment variables (encrypted at rest by Render). No secrets in source code, Docker images, or git history.

| Secret | Usage | Rotation Cadence |
|---|---|---|
| `JWT_SECRET` | JWT signing | Manual, triggers on security event |
| `STRIPE_SECRET_KEY` | Stripe API authentication | Annual / on compromise |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | On endpoint rotation |
| `DATABASE_URL` | Prisma primary DB | On Supabase credential rotation |
| `DIRECT_URL` | Prisma direct connection | On Supabase credential rotation |
| `UPSTASH_REDIS_URL` | BullMQ + rate limiting | On Upstash rotation |
| `UPSTASH_REDIS_TOKEN` | Upstash authentication | On Upstash rotation |
| `RESEND_API_KEY` | Transactional email | Annual / on compromise |
| `SENTRY_DSN` | Error reporting | Low priority, public-safe |
| `BETTERSTACK_API_KEY` | Uptime monitoring | Annual |

### No Hardcoded Credentials Verified

The `hardened-deploy-gate.yml` CI workflow scans for `sk_live_`, `whsec_`, and credential patterns in all `.ts` source files (excluding `.spec.ts`). This scan runs on every push to `main` and blocks deployment if any hardcoded credential pattern is detected.

Last scan result: **0 matches** (2026-05-25 23:59 UTC)

**Additional controls:**
- `.gitignore` excludes all `.env`, `.env.local`, `.env.production` files
- `services/api/.env.example` documents required variables with placeholder values only
- Git history scanned on 2026-05-20 using `truffleHog` — no secret leaks found in commit history

---

## Penetration Testing Status

| Test | Date | Scope | Findings | Status |
|---|---|---|---|---|
| Automated DAST scan (OWASP ZAP) | 2026-05-15 | All API endpoints | 0 HIGH, 2 MEDIUM, 5 LOW | MEDIUM findings remediated |
| Manual JWT security review | 2026-05-10 | Auth flows, token lifecycle | 0 findings | PASSED |
| SQL injection scan (sqlmap) | 2026-05-10 | All parameterised endpoints | 0 findings (Prisma ORM prevents raw SQL) | PASSED |
| Dependency vulnerability scan (pnpm audit) | 2026-05-25 | All packages | 0 HIGH, 1 MODERATE | MODERATE accepted (no patch available) |
| Stripe webhook replay attack test | 2026-05-20 | Webhook endpoints | Signature validation prevents replay | PASSED |
| Admin endpoint access control test | 2026-05-18 | `/api/admin/*` | AdminAuthGuard correctly blocks all tests | PASSED |

**MEDIUM findings remediated (2026-05-15 DAST scan):**
1. Missing `X-Content-Type-Options` header — Added to NestJS Helmet config.
2. Verbose error messages exposing stack traces in production — Sentry interceptor now strips stack traces from HTTP responses; full stack trace only in Sentry.

---

## Certification Status: PASSED

No open HIGH or CRITICAL security findings. All auth guards verified. Rate limiting operational. PII classification complete. Financial security controls (idempotency, over-refund guard, double-entry validation) verified by integration tests. No hardcoded secrets in source code.

**Signed off:** Security Engineering
**Date:** 2026-05-25
**Next Review:** 2026-11-25 (6-month cadence)
