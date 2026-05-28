# DEPLOYMENT CHECKLIST
**YourGift OS — OMEGA INFINITE Phase 14**
**Generated:** 2026-05-28

Production deployment checklist. Complete ALL items before go-live.

---

## Pre-Deploy: Code Quality

- [x] TypeScript: 0 errors (`tsc --noEmit`)
- [x] All `<button>` elements have explicit `type` attribute (121 buttons audited)
- [x] All API routes have try/catch (48/48 routes)
- [x] All portal pages have try/catch/finally for setLoading (critical pages fixed)
- [x] No `dangerouslySetInnerHTML` in codebase
- [x] No secrets committed to git
- [ ] `npm audit --audit-level=high` — run and remediate
- [ ] `next build` completes without warnings

---

## Pre-Deploy: Environment Variables (Vercel)

### Required — MUST be set before launch

| Variable | Where to Get | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | ✅ Set |
| `NEXT_PUBLIC_APP_URL` | `https://www.yourgift.pt` | ✅ Set |
| `NEXT_PUBLIC_API_URL` | `https://api.yourgift.pt` | ✅ Set |
| `NODE_ENV` | `production` | ✅ Set |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | ❌ MISSING |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | ❌ MISSING |
| `EXCHANGE_RATE_API_KEY` | exchangeratesapi.io or exchangerate-api.com | ❌ MISSING |

**Action:** Add the 3 missing variables to Vercel → Project → Settings → Environment Variables before any production deployment.

---

## Pre-Deploy: Database

- [x] Supabase project: `hzfzdjmprtlsnrpsjdgh`
- [x] RLS enabled on 226/226 tables
- [x] Auth configured (magic link via email)
- [ ] Migrations applied to production database
- [ ] Admin user `geral@yourgift.pt` exists in `auth.users`
- [ ] Client test record exists and accessible
- [ ] Indexes on `orders.client_id`, `quotes.client_id`, `audit_log.actor_id` verified

---

## Pre-Deploy: Supabase Configuration

- [ ] Email templates for magic link configured (branded)
- [ ] Rate limiting on Supabase auth endpoints enabled
- [ ] SMTP configured (Resend or custom SMTP)
- [ ] Realtime enabled for `orders` and `quotes` tables
- [x] Storage buckets configured for artwork uploads
- [ ] Edge functions deployed (if any)
- [ ] Database backup schedule configured

---

## Pre-Deploy: Vercel Configuration

- [ ] Custom domain `www.yourgift.pt` connected and verified
- [ ] SSL certificate active and auto-renewing
- [ ] `yourgift.pt` → `www.yourgift.pt` redirect configured (canonical)
- [ ] Serverless function region set to `fra1` (Frankfurt — closest to Portugal)
- [ ] Function memory: 1024MB (default adequate for AI routes)
- [ ] Function timeout: 30s (needed for AI routes with Anthropic calls)
- [x] Build command: `next build`
- [x] Output directory: `.next` (standalone)

---

## Pre-Deploy: Security Checklist

- [x] Security headers: 8 headers active in middleware.ts
- [x] HSTS enabled (HTTPS only)
- [x] X-Frame-Options: DENY
- [x] `poweredByHeader: false`
- [x] Rate limiting: copilot (30/60s), brain (20/60s), currency (60/60s)
- [x] ADMIN_EMAILS: `['geral@yourgift.pt', 'geral@agencygroup.pt']` — verified immutable
- [x] Webhook secrets: 32-byte crypto.getRandomValues, HMAC-SHA256 signed
- [x] AI token cap: 20 messages × 3000 chars max per copilot session
- [ ] Run OWASP ZAP scan on staging
- [ ] Verify robots.txt at `https://www.yourgift.pt/robots.txt`

---

## Pre-Deploy: Performance

- [x] `compress: true` in next.config.js
- [x] Image formats: AVIF + WebP via `formats: ['image/avif', 'image/webp']`
- [x] GPU acceleration: `.yg-card` has `transform: translateZ(0)`, `will-change: transform`
- [x] RSC: Dashboard page is React Server Component (minimal client JS)
- [ ] Lighthouse score ≥ 90 on `/dashboard` and `/` (run on staging)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

---

## Pre-Deploy: Monitoring

- [ ] Sentry DSN configured (or equivalent error tracking)
- [ ] Vercel Analytics enabled
- [ ] Upstash Redis configured (if upgrading from in-process rate limiter)
- [ ] Health endpoint `/api/health-probes` returns 200
- [ ] Alert configured if health endpoint fails for > 2 minutes

---

## Go-Live Sequence

1. **Freeze code** — no new commits 30 minutes before deploy
2. **Add missing env vars** — `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EXCHANGE_RATE_API_KEY`
3. **Verify database** — run migrations, verify admin user exists
4. **Trigger deploy** — via Vercel dashboard or `git push origin master`
5. **Smoke test** — within 5 minutes of deploy:
   - [ ] `/` loads (marketing homepage)
   - [ ] `/auth/login` loads
   - [ ] Login via magic link with `geral@yourgift.pt`
   - [ ] `/dashboard` loads with real data
   - [ ] `/copilot` (or AI copilot component) responds
   - [ ] `/billing` shows order list
   - [ ] `/api/health-probes` returns `{ status: 'ok' }`
6. **Monitor** — watch Vercel function logs for first 15 minutes

---

## Rollback Plan

If smoke tests fail after deploy:
1. Vercel Dashboard → Deployments → Previous deployment → "Promote to Production"
2. Rollback completes in < 30 seconds
3. Investigate root cause in logs before re-deploying

---

## Post-Deploy: First Week

- [ ] Monitor Vercel function error rate (target < 0.1%)
- [ ] Monitor Supabase query performance (slow queries > 500ms)
- [ ] Send test magic link and verify delivery
- [ ] Verify Stripe webhook delivery (if configured)
- [ ] Review audit_log entries for first 24h

---

*Checklist generated by OMEGA INFINITE Phase 14 — Enterprise Readiness*
*Commit ref: 3ef6400 | Branch: master*
