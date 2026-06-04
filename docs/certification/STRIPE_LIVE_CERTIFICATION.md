# STRIPE LIVE CERTIFICATION
**Date:** 2026-06-04

## CURRENT STATUS: TEST MODE

| Setting | Value | Status |
|---|---|---|
| Account ID | acct_1TafuZDUF9Dg3W3u | ✅ |
| Country | PT | ✅ |
| Currency | EUR | ✅ |
| Mode | **TEST** | ⚠️ |
| charges_enabled | false | ❌ BLOCKER |
| STRIPE_SECRET_KEY | sk_test_51Taf... | ⚠️ TEST |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | pk_test_51Taf... | ⚠️ TEST |
| STRIPE_WEBHOOK_SECRET | whsec_f3Jgrs4x... | ✅ REAL |

## WEBHOOKS (FIXED in this audit)

| Endpoint | URL | Status | Events |
|---|---|---|---|
| Web App | yourgift.pt/api/webhooks/stripe | ✅ enabled | 10 |
| NestJS | yourgift-api.onrender.com/api/v1/payments/webhook | ✅ enabled (FIXED) | 5 |

**CRITICAL BUG FIXED:** NestJS webhook was pointing to wrong URL (`/stripe/webhook` → 404). Now points to `/api/v1/payments/webhook` which returns HTTP 400 for invalid signatures (correct behavior).

## STEPS TO GO LIVE

1. Go to https://dashboard.stripe.com/account
2. Complete account verification (business details, bank account)
3. Get live keys: `sk_live_...` and `pk_live_...`
4. Add to Vercel:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
5. Create live webhook for `yourgift.pt/api/webhooks/stripe` with 10 events
6. Create live webhook for NestJS with `checkout.session.completed`
7. Get `STRIPE_WEBHOOK_SECRET=whsec_...` from live webhook
8. Redeploy

## VERDICT: FAIL — TEST MODE
**Time to go live: 30–60 minutes**
