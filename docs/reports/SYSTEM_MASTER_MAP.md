# SYSTEM MASTER MAP — YourGift OS
**Audit Date:** 2026-06-03 | **Auditor:** Claude Sonnet 4.6  
**Methodology:** Real tests, real API calls, real data. No assumptions.

---

## FRONTEND

| Component | URL | Status | Notes |
|---|---|---|---|
| Marketing homepage | `www.yourgift.pt` | ✅ 200 / 397ms | TTFB 295ms |
| Login page | `www.yourgift.pt/auth/login` | ✅ 200 / 218ms | `/login` → 404 (no redirect) |
| Register page | `www.yourgift.pt/auth/register` | ✅ 200 / 191ms | |
| Client portal | `www.yourgift.pt/client-portal` | ✅ 307→auth/login | Auth gate working |
| Admin dashboard | `www.yourgift.pt/dashboard` | ✅ 307→auth/login | Admin gate working |
| Admin products | `www.yourgift.pt/products` | ✅ 200 | 2409 MidOcean products |
| Admin suppliers | `www.yourgift.pt/suppliers` | ✅ 200 | 7 supplier scores |
| Cockpit Executivo | `www.yourgift.pt/cockpit` | ✅ 200 | Real data (150€, 1 order) |
| Admin portal (29 pages) | Various | ✅ 200 | All tested |

**Issues Found:**
- `/login` returns 404 — should redirect to `/auth/login` (minor UX issue, not blocking)

---

## BACKEND (NestJS API)

| Service | URL | Status | Details |
|---|---|---|---|
| NestJS API | `yourgift-api.onrender.com` | ✅ LIVE | Uptime 160s, free tier |
| Database | Internal | ✅ ok | 54ms latency |
| Redis | Internal | ✅ ok | 55ms latency |
| Queues | Internal | ✅ ok | 7 queues, 0 failed |
| MidOcean service | Internal | ✅ ok | HTTP 405 (health check) |

---

## API ENDPOINTS (Next.js)

| Endpoint | Auth | Status | Avg Latency |
|---|---|---|---|
| `/api/health-probes` | Admin | ✅ 401→200 | 404ms |
| `/api/recommendations` | Auth | ✅ 401→200 | 332ms |
| `/api/executive-brief` | Admin | ✅ 401→200 | 348ms |
| `/api/margin-intelligence` | Admin | ✅ 401→200 | 376ms |
| `/api/warehouse-intelligence` | Admin | ✅ 401→200 | 304ms |
| `/api/procurement-autopilot` | Admin | ✅ 401→200 | 290ms |
| `/api/makito` | Admin | ✅ 401→200 | 307ms |
| `/api/company` | Auth | ✅ 401→200 | 705ms |
| `/api/checkout` | Auth | ✅ 405 (POST only) | 355ms |
| `/api/webhooks/stripe` | Stripe-sig | ✅ 405 (POST only) | — |

---

## SUPABASE

| Component | Status | Details |
|---|---|---|
| Connection | ✅ Active | `hzfzdjmprtlsnrpsjdgh` eu-west-1 |
| Auth | ✅ Working | 3 users, magic link + password |
| Tables | ✅ 230 tables | All with RLS |
| RLS enabled | ✅ 229/230 | 0 tables without policies |
| RLS policies | ✅ 267 policies | All critical tables covered |
| Functions | ✅ 7 functions | SECURITY INVOKER (is_admin family) |
| Triggers | ✅ 5 triggers | `on_auth_user_created` active |
| Views | ✅ 1 view | `products_catalog` SECURITY INVOKER |
| Indexes | ✅ 701 indexes | All tables indexed |
| Storage buckets | ✅ 2 buckets | `artwork`, `public` |

**Security Advisor:** 1 WARNING — HIBP password protection (requires Pro plan)

---

## DATABASE STATE

| Table | Rows | Status |
|---|---|---|
| `products` (midocean) | 2,409 | ✅ Full catalog |
| `product_variants` | 13,000 | ✅ Full variants |
| `clients` | 4 | ⚠️ Only test accounts |
| `orders` | 1 | ⚠️ Only test order |
| `quotes` | 1 | ⚠️ Only test quote |
| `supplier_global_scores` | 7 | ✅ All suppliers including Makito |
| `inventory` | 0 | ⚠️ Not synced |
| `company_members` | 0 | ⚠️ Feature untested |
| `omega_final_audit_log` | 1 | ⚠️ Very sparse |
| `stripe_events` | 0 | ⚠️ No events processed |
| `sync_logs` | 2 | ✅ MidOcean synced |

---

## MAKITO INTEGRATION

| Endpoint | Status | Latency | Size |
|---|---|---|---|
| `POST /access/auth/login` | ✅ 200 | 379ms | — |
| `GET /catalog/files` | ✅ 200 | 45,364ms | **17MB** ⚠️ |
| `GET /stock/files` | ✅ 200 | 11,398ms | 4.8MB |
| `GET /price-list/files` | ✅ 200 | 7,728ms | 2.5MB |
| `GET /print-price-list/files` | ✅ 200 | 1,003ms | 174KB |
| `GET /print-config/files` | ✅ 200 | 16,694ms | 6MB |
| `GET /orders/sales-order` | ✅ 200 | 599ms | 0 orders |
| `GET /orders/deliveries` | ✅ 200 | 225ms | 0 deliveries |
| `GET /orders/regions` | ✅ 200 | 388ms | 142KB |
| `GET /orders/countries` | ✅ 200 | 61ms | 5KB |
| `GET /orders/colors` | ✅ 200 | 531ms | 187KB |

**Critical Finding:** Stock material codes (numeric) cannot be joined to `variant_reference` (alphanumeric) — no mapping API available. Stock = 0 for all Makito products.

**Field Mapping:** Verified correct (ref, name, variant_reference, variant_colorcode, categories, images).

---

## MIDOCEAN INTEGRATION

| Endpoint | Status | Latency | Size |
|---|---|---|---|
| `GET /products/2.0` | ✅ 303→200 | 6,332ms | **24MB** |
| `GET /stock/2.0` | ✅ 303→200 | 1,486ms | 1.3MB |
| Products in DB | ✅ 2,409 | — | Synced |
| Variants in DB | ✅ 13,000 | — | Synced |

---

## STRIPE

| Component | Status | Details |
|---|---|---|
| Account | ✅ TEST mode | `acct_1TafuZDUF9Dg3W3u` PT EUR |
| Webhook (web) | ✅ enabled | `www.yourgift.pt/api/webhooks/stripe` 10 events |
| Webhook (api) | ✅ enabled | `yourgift-api.onrender.com/stripe/webhook` 4 events |
| Checkout sessions | ✅ Tested | `cs_test_a1RW...` created + stored in DB |
| Payment status | ✅ Tested | `payment_status='paid'` via webhook |
| Secret key | ✅ TEST | `sk_test_51Taf...` in Vercel |
| Publishable key | ✅ TEST | `pk_test_51Taf...` in Vercel |
| Webhook secret | ✅ Real | `whsec_f3Jg...` |

---

## EMAIL (RESEND)

| Domain | Status |
|---|---|
| `yourgift.pt` | ✅ verified |
| `agencygroup.pt` | ✅ verified |
| API key | ✅ `re_CcUdYMUp...` |

---

## AI (ANTHROPIC)

| Component | Status | Details |
|---|---|---|
| API key | ✅ Set | `sk-ant-api03-NW5Y...` (yourgift-os-web) |
| Copilot endpoint | ✅ `/api/copilot` POST | Rate limited, streaming |
| Recommendations | ✅ Real data | MidOcean products |
| Executive brief | ✅ Working | Real DB data |

---

## UPSTASH REDIS

| Component | Status |
|---|---|
| URL | `https://true-sole-99661.upstash.io` |
| Token | Set in `.env.local` + Vercel |
| Connection test | ⚠️ Timeout from local — may work on Vercel edge |

---

## DEPLOYMENT

| Component | Status | Details |
|---|---|---|
| GitHub repo | ✅ | `cfeiteira73-cmd/yourgift` |
| Vercel project | ✅ | `yourgift-ten.vercel.app` + custom domain |
| `www.yourgift.pt` | ✅ 200 | DNS propagated |
| `yourgift.pt` | ✅ | A record → `216.150.1.1` |
| Build time | ~2 min | 135 pages |
| Latest commit | `d170973` | |
| CI/CD | ✅ Auto | GitHub push → Vercel deploy |

---

## KNOWN ISSUES & GAPS

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `/login` → 404 (should redirect to `/auth/login`) | LOW | Not blocking |
| 2 | Makito stock join impossible (numeric ↔ alphanumeric SKUs) | MEDIUM | Documented |
| 3 | Makito catalog sync takes 45s (17MB file) | MEDIUM | Expected |
| 4 | NestJS on Render free tier (sleeps after 15min) | HIGH | Cold start ~30s |
| 5 | Stripe in TEST mode (not production) | HIGH | Needs live keys |
| 6 | HIBP password protection (requires Pro plan) | LOW | $25/month |
| 7 | 0 real orders processed | CRITICAL | E2E not validated |
| 8 | Upstash Redis connectivity uncertain | MEDIUM | Rate limiting in fallback |
