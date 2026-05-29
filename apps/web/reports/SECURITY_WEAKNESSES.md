# SECURITY WEAKNESSES
**YourGift OS — Vulnerability Assessment**
**Generated:** 2026-05-29

---

## Security Posture Score: 82/100

| Domain | Score | Status |
|---|---|---|
| Authentication | 95/100 | ✅ Excellent |
| Authorization (RLS) | 90/100 | ✅ Strong |
| Input Validation | 55/100 | ⚠️ Weak |
| API Security | 78/100 | ✅ Good |
| Headers (CSP) | 70/100 | ⚠️ Incomplete |
| Rate Limiting | 72/100 | ⚠️ In-process only |
| Financial Integrity | 75/100 | ⚠️ Missing idempotency |
| Secrets Management | 80/100 | ⚠️ 3 missing prod vars |
| Webhook Security | 40/100 | 🔴 Critical gap |
| Audit Trail | 88/100 | ✅ Good |

---

## CRITICAL WEAKNESSES

### SW-01: No Stripe Webhook Signature Verification (CRITICAL)
**Risk:** 🔴 CVSS 9.1 (Critical)
**Location:** No `/api/webhooks/stripe` route exists
**Description:** Stripe sends payment events to a webhook endpoint. Without signature verification using `stripe.webhooks.constructEvent()`, any actor can POST fake payment confirmations.
**Impact:** Attacker can trigger order confirmations, payment status changes, or refunds with fabricated payloads.
**Fix:**
```typescript
// apps/web/src/app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }
  // process event...
}
```
**Priority:** IMMEDIATE — before any Stripe transactions go live

---

### SW-02: No Input Schema Validation on API Mutations (CRITICAL)
**Risk:** 🔴 CVSS 7.5
**Location:** All POST/PATCH routes in `/api/`
**Description:** `request.json()` is called and used directly without schema validation. Malformed or malicious payloads bypass business logic guards.
**Affected routes (HIGH priority):**
- `POST /api/orders` — no validation on order creation
- `POST /api/quotes` — no validation on quote submission
- `PATCH /api/orders/[id]` — status transitions not validated
- `POST /api/payments` — payment amounts not validated
- `POST /api/copilot` — message content not sanitized

**Fix:** Install and apply Zod:
```typescript
import { z } from 'zod';

const CreateOrderSchema = z.object({
  quote_id: z.string().uuid(),
  total_amount: z.number().positive().max(999999),
  currency: z.enum(['EUR', 'USD', 'GBP']),
});

const body = CreateOrderSchema.safeParse(await request.json());
if (!body.success) {
  return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
}
```
**Priority:** P1 — within 1 week

---

## HIGH WEAKNESSES

### SW-03: No Content Security Policy (HIGH)
**Risk:** 🟠 CVSS 6.5
**Location:** `middleware.ts` security headers section
**Description:** `X-Content-Type-Options`, `X-XSS-Protection`, and `X-Frame-Options` are set, but no `Content-Security-Policy` header exists.
**Impact:** If an XSS injection occurs (e.g., via a malicious supplier name stored in DB and rendered as text), the browser has no CSP to block script execution.
**Current headers present:**
```
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ X-XSS-Protection: 1; mode=block
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Permissions-Policy: camera=(), microphone=(), geolocation=()
✅ HSTS: max-age=63072000
❌ Content-Security-Policy: MISSING
```
**Fix:**
```typescript
// In middleware.ts headers
response.headers.set(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'nonce-{nonce}' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.supabase.co https://cdn.midocean.com",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com wss://*.supabase.co",
    "frame-src https://js.stripe.com",
  ].join('; ')
);
```

---

### SW-04: No Idempotency on Financial Mutations (HIGH)
**Risk:** 🟠 CVSS 6.1
**Location:** Payment API routes
**Description:** Stripe API calls lack `Idempotency-Key` headers. Network retries or duplicate requests can trigger double-charges or double-credits.
**Impact:** Financial integrity violation. Double-charging a client causes chargeback + reputational damage.
**Fix:**
```typescript
const idempotencyKey = crypto.randomUUID();
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(total * 100),
  currency: 'eur',
}, {
  idempotencyKey,
});
// Store idempotencyKey in Supabase for audit
```

---

### SW-05: Cross-Instance Rate Limiting Gap (HIGH)
**Risk:** 🟠 CVSS 5.5
**Location:** `lib/rate-limit.ts`
**Description:** Rate limiting is implemented via in-process `Map`. Vercel serverless deploys multiple instances — each has its own counter. A coordinated request burst across instances bypasses the rate limit completely.
**Impact:** Anthropic API cost exposure if AI endpoints are abused across instances. Per-instance limit is 30/60s but effective multi-instance limit is N×30 where N = active instances.
**Fix:** Replace with Redis/Upstash cross-instance rate limiter:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '60 s'),
});
```

---

### SW-06: ADMIN_EMAILS Relies on Code-Level Constant (MEDIUM)
**Risk:** 🟡 CVSS 4.5
**Location:** `middleware.ts`, multiple API routes
**Description:** Admin access is granted via `ADMIN_EMAILS` array in code. Any code change or misconfiguration could expand/restrict admin access.
**Strength:** The constant is documented in CLAUDE.md as immutable. Read-only at runtime.
**Weakness:** No runtime enforcement — Supabase RLS doesn't enforce this constraint.
**Fix (additional layer):** Add `user_metadata.role = 'admin'` to Supabase user records. Check both ADMIN_EMAILS AND user_metadata:
```typescript
const isAdmin = ADMIN_EMAILS.includes(user.email ?? '') 
  && user.app_metadata?.role === 'admin';
```

---

### SW-07: Service Role Key Exposure Risk (MEDIUM)
**Risk:** 🟡 CVSS 5.0
**Location:** Admin API routes using `SUPABASE_SERVICE_ROLE_KEY`
**Description:** Service role key bypasses ALL RLS. If a route using service role key has an authorization bug, attacker gets full database access.
**Current usage:** Financial reconciliation, admin reporting routes
**Fix:**
- Always verify admin identity BEFORE creating service role client
- Never log the service role key
- Ensure service role client is never returned to client
- Add explicit `null` check: fail closed if key missing

```typescript
// Pattern used in admin routes
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
}
const adminSupabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
```

---

## MEDIUM WEAKNESSES

### SW-08: No Request Size Limits on API Routes (MEDIUM)
**Risk:** 🟡
**Description:** No explicit `Content-Length` check on POST bodies. A malicious client can POST a very large payload to exhaust memory.
**Affected:** Copilot route (3000 char cap on message but not on full body), artwork upload route
**Fix:**
```typescript
const body = await request.text();
if (body.length > 100_000) {
  return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
}
```

### SW-09: Console.log May Leak Internal State (LOW)
**Risk:** 🟢
**Description:** Server-side `console.log` statements in production could log sensitive data to Vercel logs (accessible to anyone with Vercel project access).
**Files:** Several API routes have `console.error` with Supabase error objects that may contain query internals.
**Fix:** Replace with structured logging, ensure PII and financial amounts are never logged.

### SW-10: One-Time Token SHA-256 Blocklist — Memory-Only (LOW)
**Risk:** 🟢
**Description:** Used magic link tokens stored in module-level `Set`. Restarts clear the set, allowing token replay.
**Location:** `apps/web/src/app/auth/recover/route.ts` (SHA-256 blocklist implementation)
**Fix:** Persist used tokens to Supabase `used_magic_tokens` table with TTL cleanup.
**Note:** If already using Supabase table for this, confirm the table exists: `SELECT * FROM used_magic_tokens LIMIT 1;`

---

## IMPLEMENTED CORRECTLY ✅

| Control | Implementation | Status |
|---|---|---|
| Magic link auth | Supabase one-time tokens | ✅ |
| Session management | HTTP-only SameSite=Lax cookies | ✅ |
| Middleware auth guard | Every request validated | ✅ |
| Admin email gate | Immutable constant | ✅ |
| RLS | 226 tables, all protected | ✅ |
| pgvector operations | Auth-gated | ✅ |
| Security headers | 8 headers active | ✅ |
| HSTS | 63072000s max-age | ✅ |
| Storage access | Supabase RLS policies | ✅ |
| Audit log | All sensitive operations | ✅ |
| poweredBy: false | Next.js config | ✅ |
| Rate limiting (AI) | In-process, 30/60s | ✅ (partial) |

---

## Remediation Roadmap

**Week 1 (Critical):**
1. Build Stripe webhook handler with `constructEvent()` — SW-01
2. Add Zod schema validation on financial routes — SW-02

**Week 2 (High):**
3. Add CSP header to middleware — SW-03
4. Add idempotency keys to Stripe calls — SW-04

**Month 1 (Medium):**
5. Add Upstash Redis for cross-instance rate limiting — SW-05
6. Add request size limits — SW-08
7. Persist magic link blocklist to Supabase — SW-10

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-29*
