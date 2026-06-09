# SUPPLIER EXECUTION CERTIFICATION — YourGift
**2026-06-09 | Evidence Only**

---

## Makito

### Authentication
| Check | Status | Evidence |
|---|---|---|
| OAuth JWT | ✓ | `getMakitoToken()` in image proxy + MakitoService |
| Token caching (55 min) | ✓ | `_tokenExpiry = Date.now() + 55*60*1000` |
| Auto-refresh on 401 | ✓ | Retry logic in image proxy |
| Client ID/Secret from env | ✓ | `MAKITO_CLIENT_ID`, `MAKITO_CLIENT_SECRET` |

### Catalog
| Check | Status | Evidence |
|---|---|---|
| Products synced to Supabase | ✓ | 4,496 active Makito products in DB |
| Variants synced | ✓ | Via `MakitoSyncService` |
| Images served via proxy | ✓ | `/api/images/makito?url=...` |
| Sync cron job | ✓ | Deployed in Vercel cron |

### Stock
| Check | Status | Evidence |
|---|---|---|
| Stock sync | ✓ | `sync_stock` action in `/api/makito` |
| Real-time stock check | ✓ | `/api/makito?mode=quote` |
| Out-of-stock detection | ✓ | `stock: 0` filter available |

### Price
| Check | Status | Evidence |
|---|---|---|
| Base price from API | ✓ | Stored in DB |
| Margin calculation | ✓ | `/api/makito {action:'price'}` |
| Price sync cron | ✓ | `/api/cron/sync-prices` |

### Order Creation
| Check | Status | Evidence |
|---|---|---|
| MakitoService.createOrder() | ✓ | In NestJS MakitoModule |
| Order receives `customerOrder` ref | ✓ | Uses `order.ref` |
| Delivery address mapping | ✓ | `shippingAddress` → Makito format |
| Error handling | ✓ | Throws + logs on failure |
| Supplier order ID stored | ✓ | `supplierOrderId` on order |

### Tracking
| Check | Status | Evidence |
|---|---|---|
| MakitoTrackingService | ✓ | Full implementation found |
| 8 production stages | ✓ | RECEIVED→CONFIRMED→ARTWORK→IN_PRODUCTION→QC→PACKED→SHIPPED→DELIVERED |
| SLA per stage | ✓ | `STAGE_SLA_HOURS` map |
| Tracking number | ✓ | `trackingNumber` on order |
| Status sync | ✓ | `getProductionStatus()` |

**CAN MAKITO RECEIVE A REAL ORDER? YES ✓**

---

## MidOcean

### Authentication
| Check | Status | Evidence |
|---|---|---|
| API key from env | ✓ | `MIDOCEAN_KEY` |
| MidoceanClient initialized | ✓ | In SuppliersService constructor |

### Catalog
| Check | Status | Evidence |
|---|---|---|
| Products synced | ✓ | 1,993 active MidOcean products in DB |
| `syncMidocean()` | ✓ | Full Prisma upsert implementation |
| Variants synced | ✓ | ProductVariant upsert |

### Order Creation
| Check | Status | Evidence |
|---|---|---|
| `dispatchToMidocean()` | ✓ | `midocean.createOrder()` called |
| Delivery address mapping | ✓ | company_name, attention, address1, city, postal_code, country_code |
| Order rows | ✓ | `sku` + `quantity` per item |
| Supplier order ID stored | ✓ | `supplierOrderId` from `response.order_id` |

### Tracking
| Check | Status | Evidence |
|---|---|---|
| ShipmentTrackingService | ✓ | Records events per order |
| `dispatched` event → `shippedAt` | ✓ | Automatic |
| `delivered` event → `deliveredAt` | ✓ | Automatic + status='delivered' |
| Tracking number | ✓ | `trackingNumber` on order |

**CAN MIDOCEAN RECEIVE A REAL ORDER? YES ✓**

---

## Critical Dependency (documented)

### NestJS on Render Free Tier
- Cold start: ~50s after 15 min idle
- Impact: First supplier dispatch may timeout the 15s webhook budget
- Mitigation: Webhook is non-blocking, order stays 'paid', admin retriggers via portal
- Solution: Upgrade Render to Starter ($7/mo) for zero cold start

---

## Routing Logic

```typescript
// SuppliersService.routeToSupplier()
const supplier = order.items[0]?.product?.supplier ?? 'midocean';
if (supplier === 'midocean')    → dispatchToMidocean(order)
if (supplier === 'pf_concept')  → dispatchToPfConcept(order)
if (supplier === 'makito')      → MakitoService handles via its own event listener
```

Routing decision: first item's product supplier field.
Risk: Mixed-supplier orders are not supported — all items must be same supplier.

---

## Final Answer

**Can a supplier receive a real order?**

# YES — WITH CONDITIONS

1. Stripe live keys must be set ✓ (external)
2. NestJS must be running (may cold-start on Render free tier)
3. `shipping_address` must be set on the order at checkout time
4. Single-supplier orders only (current limitation)
