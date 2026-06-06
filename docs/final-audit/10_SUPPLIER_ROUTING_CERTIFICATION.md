# PHASE 10 — SUPPLIER ROUTING CERTIFICATION
**Generated:** 2026-06-06 | **Status:** IMPLEMENTED, NOT LIVE-TESTED

---

## ROUTING MATRIX (DB)

| Rows | Status |
|---|---|
| 4 routing rules | ✅ Configured |

---

## ROUTING FLOW

```
Stripe checkout.session.completed
→ Order status = paid
→ NestJS API: yourgift-api.onrender.com/api/v1/payments/webhook
→ Supplier routing logic
→ Check supplier_routing_matrix
→ Route to Makito OR MidOcean
→ Place supplier order
→ Receive supplier order ID
→ Update order.supplier_order_id
→ Trigger tracking
```

---

## NESTJS WEBHOOK URL (FIXED)

Previous issue: NestJS webhook URL was wrong (`/stripe/webhook` → 404)
Fixed in commit 44a324e: Updated via Stripe API to `/api/v1/payments/webhook`
Current URL: `yourgift-api.onrender.com/api/v1/payments/webhook` ✅

---

## SUPPLIER ROUTING RULES (4 rows)

Rules stored in `supplier_routing_matrix` table.
Routing logic evaluates:
- Product supplier field (makito/midocean)
- Category rules
- Stock availability
- Fallback rules

---

## ROUTING VERIFICATION STATUS

| Check | Status |
|---|---|
| payment.confirmed triggers routing | ✅ Code verified |
| Supplier decision recorded | ✅ Code exists |
| Supplier response stored | ✅ Code exists |
| Failure path visible | ✅ Audit log |
| No silent failure | ✅ Error handling |
| Retries | ⚠️ Not implemented |
| Dead letters | ⚠️ event_dlq exists but not wired |

---

## SUPPLIER INTEGRATIONS

### Makito Order Placement
- API: apis.makito.es
- Auth: JWT (MAKITO_CLIENT_ID + MAKITO_CLIENT_SECRET) ✅
- Integration: integrations/makito package (TypeScript 0 errors) ✅
- Test: NOT tested with live order (blocked by Stripe test mode)

### MidOcean Order Placement
- API: api.midocean.com
- Auth: API key (MIDOCEAN_KEY) ✅
- Integration: NestJS services/api/src/suppliers
- Test: NOT tested with live order

---

## KNOWN GAPS

| Gap | Severity |
|---|---|
| NestJS Render free tier may sleep | HIGH — supplier orders could be delayed |
| No retry mechanism for failed supplier orders | MEDIUM |
| Dead letter queue not wired | MEDIUM |
| No timeout protection on supplier API calls | MEDIUM |
| Supplier order confirmation not emailed to admin | LOW |

---

## NESTJS ALWAYS-ON

MANUAL ACTION REQUIRED:
- Upgrade Render from Free to Starter ($7/month)
- This prevents the 50-second cold start on supplier order placement
- Current: `render.yaml` already has `minInstances: 1` but free tier ignores this

---

## VERDICT

Supplier routing: **BETA READY** (code correct, not live-tested)
- Architecture: correct ✅
- Database: configured ✅
- API credentials: present ✅
- Never executed with real payment (Stripe test mode blocks this)

**Score: 60/100** (not live-tested due to Stripe blocker)
