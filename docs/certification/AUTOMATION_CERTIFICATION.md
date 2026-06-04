# AUTOMATION CERTIFICATION
**Date:** 2026-06-04

## AUTOMATION FLOW MAP

```
Customer Registration
  → Supabase Auth trigger (on_auth_user_created)
  → Creates clients record automatically ✅

Payment Completed (checkout.session.completed)
  → Web App webhook → DB update (payment_status=paid) ✅
  → NestJS webhook → payment.confirmed event ✅ (FIXED)
    → SuppliersService.routeToSupplier() ✅
      → MidOcean: dispatchToMidocean() ✅
      → Makito: MakitoService (event-driven) ✅
    → NotificationsService ⚠️ (not verified)

Payment Failed (payment_intent.payment_failed)
  → DB update (status=payment_failed) ✅
  → payment.failed event ✅

Order Status Updates
  → NestJS polling (10s) via JobsService ✅
  → Event-driven updates ✅

Supplier Tracking
  → MakitoTrackingService.pollActiveOrders() ✅
  → Updates tracking_number in orders ✅
```

## MANUAL INTERVENTIONS IDENTIFIED

| Step | Manual? | How to Automate |
|---|---|---|
| Stripe live keys | YES (human) | Cannot automate |
| Artwork approval | YES (human) | Review → auto-approve | 
| Makito order confirmation | NO (automatic) | ✅ |
| Stock alerts | Notification only | ✅ |

## CRITICAL FIXES MADE

1. **NestJS webhook URL** — was wrong (404) → FIXED → supplier routing now works
2. **Company invite email** — was TODO → IMPLEMENTED → Resend email sent on invite

## JOB QUEUE

| Job Type | Status |
|---|---|
| order.fulfill | ✅ Defined |
| artwork.process | ✅ Defined |
| notification.send | ✅ Defined |
| product.sync | ✅ Defined |

## VERDICT: PASS with caveats
**0 unintentional manual steps after payment** (once Stripe live keys are set)
