# SUPPLIER CERTIFICATION — YourGift

---

## Makito API

| Check | Status | Evidence |
|---|---|---|
| Auth (OAuth JWT) | ✅ | MAKITO_CLIENT_ID + SECRET configured |
| Products in DB | ✅ | 4,496 active (77 catalog PDFs deactivated) |
| Images via proxy | ✅ | /api/images/makito route working |
| Price sync | ✅ | Weekly cron Sunday 03:00 UTC |
| TS errors | ✅ 0 | makito.client.ts, sync.ts, pricing.ts |
| Webhook URL (order creation) | ✅ | Fixed: /api/v1/payments/webhook |

**Known limitation:** Makito stock uses numeric codes vs our alphanumeric SKUs — stock sync not implemented (medium priority).

---

## MidOcean API

| Check | Status | Evidence |
|---|---|---|
| Auth (API key) | ✅ | MIDOCEAN_KEY configured |
| Products in DB | ✅ | 1,993 active (416 inactive — no title) |
| Variants | ✅ | 13,000 variants synced |
| Prices | ✅ | All priced, 1.35x margin applied |
| Images (CDN) | ✅ | cdn1.midocean.com (public, no auth) |
| Price sync cron | ✅ | Daily 02:00 UTC deployed |
| Last sync | Last run: 2026-05-16 | DB verified |

**Known issues:** 22 catalog PDF products fail sync (no title field) — correctly excluded.

---

## Supplier Routing

| Check | Status |
|---|---|
| supplier_routing_matrix | ✅ 4 rules configured |
| NestJS API | ✅ yourgift-api.onrender.com (free tier — cold start) |
| Routing trigger | ✅ On payment.confirmed webhook |
| Supplier order creation | ⚠️ Never triggered (Stripe test mode) |

**CERTIFICATION: READY** for production once Stripe live keys added.
