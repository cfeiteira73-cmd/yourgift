# PHASE 1 — FULL SYSTEM INVENTORY
**Generated:** 2026-06-06 | **Commit:** c986b08 | **Status:** VERIFIED

---

## 1. DEPLOYMENT

| Item | Value |
|---|---|
| Domain | www.yourgift.pt |
| Platform | Vercel (Pro) |
| Framework | Next.js 14 App Router |
| Region | eu-west-1 |
| Latest commit | c986b08 (READY) |
| Root Directory | apps/web |
| Build command | cd ../.. && pnpm --filter @yourgift/shared run build && pnpm --filter web run build |
| Output directory | .next |

---

## 2. BACKEND SERVICES

| Service | Status | Notes |
|---|---|---|
| Supabase (yourgift-os) | ACTIVE_HEALTHY | eu-west-1, PostgreSQL 17 |
| NestJS API | yourgift-api.onrender.com | Free tier (sleeps) |
| Stripe | TEST mode | sk_test_... — live keys missing |
| Resend | Configured | domain yourgift.pt verified |
| Anthropic Claude | Configured | sk_ant_... present |
| MidOcean API | Configured | api.midocean.com |
| Makito API | Configured | apis.makito.es |
| Upstash Redis | Configured | Rate limiting |
| Vercel Cron | Deployed | 2 jobs: sync-prices + sync-makito |

---

## 3. PAGES (84 total)

### Marketing (12 pages)
| Path | Status | Auth |
|---|---|---|
| / | HTTP 200 ✅ | Public |
| /catalog | HTTP 200 ✅ | Public |
| /about | HTTP 200 ✅ | Public |
| /how-it-works | HTTP 200 ✅ | Public |
| /enterprise | HTTP 200 ✅ | Public |
| /corporate-gifts | HTTP 200 ✅ | Public |
| /branded-merch | HTTP 200 ✅ | Public |
| /packaging | HTTP 200 ✅ | Public |
| /company-stores | HTTP 200 ✅ | Public |
| /fulfillment | HTTP 200 ✅ | Public |
| /rfq | HTTP 200 ✅ | Public |
| /quote | HTTP 200 ✅ | Public |
| /blog | HTTP 200 ✅ | Public |

### Auth (5 pages)
| Path | Status | Auth |
|---|---|---|
| /auth/login | HTTP 200 ✅ | Public |
| /auth/register | HTTP 200 ✅ | Public |
| /auth/recover | HTTP 200 ✅ | Public |
| /auth/sso-complete | HTTP 200 ✅ | Public |
| /auth/metrics | HTTP 200 ✅ | Admin |

### Admin Portal (60+ pages)
| Path | Status | Auth |
|---|---|---|
| /dashboard | Protected | Admin |
| /orders | Protected | Admin |
| /orders/[id] | Protected | Admin |
| /orders/new | Protected | Admin |
| /quotes | Protected | Admin |
| /quotes/[id] | Protected | Admin |
| /products | Protected | Admin |
| /suppliers | Protected | Admin |
| /artwork | Protected | Admin |
| /production | Protected | Admin |
| /clients | Protected | Admin |
| /financials | Protected | Admin |
| /settings | Protected | Admin |
| /security | Protected | Admin |
| /audit | Protected | Admin |
| /analytics | Protected | Admin |
| ... (45+ more) | Protected | Admin |

### Client Portal (6 pages)
| Path | Status | Auth |
|---|---|---|
| /client-portal | HTTP 307 → login ✅ | Client |
| /client-portal/orders | Protected | Client |
| /client-portal/quotes | Protected | Client |
| /client-portal/billing | Protected | Client |
| /client-portal/assets | Protected | Client |
| /client-portal/settings | Protected | Client |

---

## 4. API ROUTES (70 total)

### Auth Routes
| Route | Method | Status |
|---|---|---|
| /auth/callback | GET | ✅ |
| /auth/confirm | GET | ✅ |
| /auth/logout | POST | ✅ |
| /auth/magic | POST | ✅ |
| /auth/bootstrap | POST | ✅ |
| /api/v1/auth/health | GET | HTTP 200 |
| /api/v1/auth/fix-google | POST | ✅ |

### Commerce Routes
| Route | Method | Status |
|---|---|---|
| /api/checkout | POST | HTTP 405 GET, POST works |
| /api/webhooks/stripe | POST | HTTP 405 GET, POST=200 |
| /api/catalog | GET | HTTP 401 (protected) |
| /api/payments | GET/POST | Protected |
| /api/makito | GET | Proxy |
| /api/images/makito | GET | Image proxy |
| /api/company | GET/POST | Protected |

### Cron Routes
| Route | Method | Status |
|---|---|---|
| /api/cron/sync-prices | GET | HTTP 401 (CRON_SECRET) ✅ |
| /api/cron/sync-makito | GET | HTTP 401 (CRON_SECRET) ✅ |

### AI Routes (30+)
| Route | Status |
|---|---|
| /api/copilot | Protected |
| /api/executive-brief | Protected |
| /api/procurement-autopilot | Protected |
| /api/margin-intelligence | Protected |
| /api/artwork-intelligence | Protected |
| ... (25+ more) | Protected |

### Webhook Routes
| Route | Status |
|---|---|
| /api/webhooks/stripe | Active (signature-verified) |
| /api/webhooks/outbound | Protected |

---

## 5. DATABASE (Supabase hzfzdjmprtlsnrpsjdgh)

| Metric | Value |
|---|---|
| Total tables | 220+ |
| Tables with RLS | 220+ (100%) |
| Tables with policies | 220+ |
| Tables without policies | 0 ✅ |
| Security advisors | 1 WARN (HIBP) |
| PostgreSQL version | 17.6.1 |
| Region | eu-west-1 |

### Core Business Tables
| Table | Rows | RLS | Status |
|---|---|---|---|
| products | 6,982 | ✅ | Active (6,489 active) |
| product_variants | 13,000 | ✅ | Active |
| orders | 1 | ✅ | 1 test order |
| order_items | 0 | ✅ | |
| clients | 4 | ✅ | |
| artworks | 0 | ✅ | |
| quotes | 1 | ✅ | |
| sync_logs | 2 | ✅ | |

---

## 6. STORAGE BUCKETS

| Bucket | Public | Files | Status |
|---|---|---|---|
| artwork | false ✅ | 1 | Fixed (was public) |
| client-assets | false ✅ | 0 | Fixed (was public) |

---

## 7. ENVIRONMENT VARIABLES

| Variable | Status | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | Configured |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | Configured |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | Configured |
| STRIPE_SECRET_KEY | ⚠️ TEST | sk_test_... |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | ⚠️ TEST | pk_test_... |
| STRIPE_WEBHOOK_SECRET | ✅ | whsec_... |
| RESEND_API_KEY | ✅ | Configured |
| MIDOCEAN_KEY | ✅ | Configured |
| MAKITO_CLIENT_ID | ✅ | Configured |
| MAKITO_CLIENT_SECRET | ✅ | Configured |
| MAKITO_BASE_URL | ✅ | apis.makito.es |
| ANTHROPIC_API_KEY | ✅ | Configured |
| CRON_SECRET | ✅ Vercel | In Vercel env (not local) |
| NEXT_PUBLIC_APP_URL | ✅ | Configured |

---

## 8. CRON JOBS

| Job | Schedule | Route | Status |
|---|---|---|---|
| sync-prices | 0 2 * * * (daily 02:00 UTC) | /api/cron/sync-prices | ✅ Deployed |
| sync-makito | 0 3 * * 0 (Sunday 03:00 UTC) | /api/cron/sync-makito | ✅ Deployed |

---

## 9. SECURITY FUNCTIONS

| Function | Type | Status |
|---|---|---|
| handle_new_user | SECURITY DEFINER | ✅ Legitimate (creates client on signup) |

---

## SUMMARY

- Total routes tested: 25 key routes
- Total HTTP 200: 15
- Total HTTP 307 (correct redirect): 1
- Total HTTP 401 (correct auth): 7
- Total HTTP 405 (correct method): 2
- Broken routes: 0 ✅
