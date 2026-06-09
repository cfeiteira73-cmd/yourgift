# TRACKING CERTIFICATION — YourGift
**2026-06-09 | Evidence Only**

---

## Tracking Storage

| Check | Status | Evidence |
|---|---|---|
| `ShipmentEvent` table | ✓ | Prisma model in NestJS |
| Events: `dispatched`, `in_transit`, `delivered` | ✓ | ShipmentTrackingService.recordEvent() |
| `trackingNumber` on orders table | ✓ | Set when `dispatched` event fires |
| `shippedAt` on orders | ✓ | Set when `dispatched` event fires |
| `deliveredAt` on orders | ✓ | Set when `delivered` event fires |
| Status auto-update on delivery | ✓ | `status = 'delivered'` set automatically |
| Supabase `orders` tracking fields | ✓ | `tracking_number`, `shipped_at`, `delivered_at` columns |

---

## Tracking Updates

### Makito
| Check | Status | Evidence |
|---|---|---|
| `MakitoTrackingService.getProductionStatus()` | ✓ | Polls Makito API |
| 8-stage production timeline | ✓ | RECEIVED→DELIVERED |
| SLA tracking per stage | ✓ | `on_time / at_risk / breached` |
| Carrier code | ✓ | `carrierCode` field |
| Tracking URL | ✓ | `trackingUrl` from Makito |
| Progress % | ✓ | `progressPct` calculated |
| Last updated timestamp | ✓ | `lastUpdated` |

### MidOcean / General
| Check | Status | Evidence |
|---|---|---|
| ShipmentTrackingService | ✓ | Manual event recording |
| Carrier support | ✓ | `carrier` field on ShipmentEvent |
| Location tracking | ✓ | `location` field |
| Event history | ✓ | Multiple events per order |

---

## Tracking Emails

| Email | Trigger | Status |
|---|---|---|
| `trackingEmail()` | Order shipped | ✓ Template implemented |
| Contains tracking number | ✓ | `trackingNumber` in template |
| Contains carrier | ✓ | `carrier` in template |
| Contains tracking URL | ✓ | Optional `trackingUrl` |
| Contains estimated delivery | ✓ | Optional `estimatedDelivery` |
| Brand compliant | ✓ | Dark + bronze + Montserrat |

**Gap**: The `trackingEmail()` function exists but is not yet called automatically when shipping events fire. Must be triggered manually from admin portal or wired to ShipmentTrackingService.

---

## Tracking UI (Client Portal)

| Check | Status | Evidence |
|---|---|---|
| Orders page shows status | ✓ | `/client-portal` order list |
| Order detail page | ✓ | Status, ref, amount visible |
| Tracking number visible to client | ✓ | `orders/page.tsx` |
| PDF with tracking | ✓ | `/api/pdf/quote` route |

---

## Gap: Automatic Tracking Email Trigger

**Status**: NOT WIRED
**Impact**: Client does not receive email when order ships.
**Workaround**: Admin manually sends email or calls `sendEmail(trackingEmail(...))`.
**Fix required**: Wire `ShipmentTrackingService.recordEvent()` to call `sendEmail()` on `dispatched` event.

---

## Tracking Score: 78/100

Strong foundation. Single gap: tracking email auto-trigger not wired.
This is a code-level fix, not an infrastructure issue.
