# STRIPE REVENUE VALIDATION — YourGift
**Phase 7 — Verified Truth Only**

---

## Current Status: ⛔ TEST MODE

```
STRIPE_SECRET_KEY = sk_test_...
STRIPE_WEBHOOK_SECRET = whsec_... (test)
```

**This is the #1 blocker for revenue.**

---

## Infrastructure Verified ✅

| Component | Status | Evidence |
|---|---|---|
| Checkout route | ✅ POST /api/checkout → 405 (correct, GET only) | Tested live |
| Webhook route | ✅ POST /api/webhooks/stripe → 400 (no sig) | Tested live |
| Webhook handler | ✅ Signature verification implemented | Code review |
| Idempotency | ✅ `omega_final_payment_events` table | DB verified |
| Order creation | ✅ On checkout.session.completed | Code review |
| Payment email | ✅ Sends via Resend on payment | Code review |
| Supplier routing | ✅ NestJS webhook at /api/v1/payments/webhook | Fixed commit 44a324e |

## Webhook Endpoint
```
URL: https://www.yourgift.pt/api/webhooks/stripe
Events: checkout.session.completed, payment_intent.*,
        charge.dispute.*, invoice.*, charge.refunded
```

## ⛔ BLOCKER: Actions Required (Carlos only)

1. Go to https://dashboard.stripe.com
2. Switch to Live mode
3. Copy `sk_live_...` → Vercel env var `STRIPE_SECRET_KEY`
4. Copy `pk_live_...` → Vercel env var `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. Create webhook endpoint → `https://www.yourgift.pt/api/webhooks/stripe`
6. Copy `whsec_...` (live) → Vercel env var `STRIPE_WEBHOOK_SECRET`
7. Place test order with real card (€1 minimum)

**Estimated time: 30 minutes**

## Revenue Status: NOT READY ❌
**Blocked solely by missing live Stripe keys. Infrastructure is complete.**
