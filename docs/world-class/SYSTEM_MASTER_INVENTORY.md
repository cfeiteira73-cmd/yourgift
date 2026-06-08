# SYSTEM MASTER INVENTORY — YourGift
**Generated:** 2026-06-07 | **Commit:** pending

---

## Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    yourgift.pt (Vercel Pro)                  │
│              Next.js 14 App Router · eu-west-1              │
├─────────────────┬───────────────────┬───────────────────────┤
│   MARKETING     │   ADMIN PORTAL    │   CLIENT PORTAL       │
│   /(marketing)  │   /(portal)       │   /client-portal      │
│   Public        │   Auth: Admin     │   Auth: Client        │
├─────────────────┴───────────────────┴───────────────────────┤
│                 NestJS API (Render) — yourgift-api.onrender  │
├─────────────────────────────────────────────────────────────┤
│              Supabase (hzfzdjmprtlsnrpsjdgh)                │
│         PostgreSQL 17 · eu-west-1 · RLS: 100%              │
└─────────────────────────────────────────────────────────────┘
```

## Public Pages (Marketing)
| Route | Status | SEO | Notes |
|---|---|---|---|
| / | ✅ 200 | ✅ | Cinematic video hero |
| /catalog | ✅ 200 | ✅ | Category overview |
| /catalog/produtos | ✅ 200 | ✅ | 6,491 products, search, categories |
| /how-it-works | ✅ 200 | ✅ | Process steps |
| /about | ✅ 200 | ✅ | Company info |
| /blog | ✅ 200 | ✅ | Static articles |
| /contact | ✅ 200 | ✅ | Contact form |
| /faq | ✅ 200 | ✅ | 5 categories, 17 Qs |
| /rfq | ✅ 200 | ✅ | Quote request |
| /corporate-gifts | ✅ 200 | ✅ | Solution page |
| /branded-merch | ✅ 200 | ✅ | Solution page |
| /packaging | ✅ 200 | ✅ | Solution page |
| /company-stores | ✅ 200 | ✅ | Solution page |
| /fulfillment | ✅ 200 | ✅ | Solution page |
| /enterprise | ✅ 200 | ✅ | Enterprise page |
| /privacy-policy | ✅ 200 | ✅ | GDPR compliance |
| /terms | ✅ 200 | ✅ | Legal terms |

## Admin Portal Pages (54 pages)
| Route group | Count | Auth |
|---|---|---|
| Dashboard, cockpit, executive, strategist | 4 | Admin |
| Orders (new, list, detail, success) | 4 | Admin |
| Quotes (list, new, detail, decision) | 4 | Admin |
| Products (list, detail) | 2 | Admin |
| Suppliers, procurement, inventory | 3 | Admin |
| Clients, client-success | 2 | Admin |
| Artwork, assets, configurator | 3 | Admin |
| Financials, billing, reconciliation | 3 | Admin |
| Reports, analytics, forecasting | 3 | Admin |
| Security, audit, runbooks | 3 | Admin |
| Settings, integrations, account | 3 | Admin |
| AI: autopilot, ml, intel, strategist | 4 | Admin |
| Ops: ops, ops-center, control-tower | 3 | Admin |
| Sales, marketing, marketplace | 3 | Admin |
| Other specialist pages | 10 | Admin |

## Client Portal Pages
| Route | Status | Auth |
|---|---|---|
| /client-portal | ✅ | Client |
| /client-portal/orders | ✅ | Client |
| /client-portal/quotes | ✅ | Client |
| /client-portal/assets | ✅ | Client |
| /client-portal/products | ✅ | Client |
| /client-portal/billing | ✅ | Client |
| /client-portal/settings | ✅ | Client |

## API Routes (70+)
| Category | Count | Auth |
|---|---|---|
| Auth (callback, confirm, magic, logout) | 5 | Public/Session |
| Commerce (checkout, webhooks/stripe) | 2 | Protected/Signed |
| Cron (sync-prices, sync-makito) | 2 | CRON_SECRET |
| AI routes (copilot, executive-brief, etc.) | 30+ | Admin |
| Catalog/products | 3 | Public anon |
| PDF generation (quote) | 1 | Admin |
| Makito proxy (images, catalog) | 2 | Internal |
| Health probes | 1 | CRON_SECRET |

## Database (Supabase)
- **Tables:** 220+
- **RLS Policies:** 267
- **Active products:** 6,491
- **Variants:** 13,000
- **Orders:** 1 (test)
- **Region:** eu-west-1

## Storage Buckets
| Bucket | Public | Files |
|---|---|---|
| artwork | ❌ private | 1 |
| client-assets | ❌ private | 0 |

## Cron Jobs (Vercel)
| Job | Schedule | Route |
|---|---|---|
| sync-prices | Daily 02:00 UTC | /api/cron/sync-prices |
| sync-makito | Sunday 03:00 UTC | /api/cron/sync-makito |

## Integrations
| Service | Status | Purpose |
|---|---|---|
| Supabase | ✅ ACTIVE_HEALTHY | DB, Auth, Storage |
| Stripe | ⚠️ TEST MODE | Payments |
| Resend | ✅ Configured | Email (yourgift.pt verified) |
| Makito API | ✅ Configured | Supplier catalog + orders |
| MidOcean API | ✅ Configured | Supplier catalog + prices |
| Anthropic Claude | ✅ Configured | AI copilot features |
| Upstash Redis | ✅ Configured | Rate limiting |
| NestJS API | ✅ Render (free tier) | Supplier routing |

## AI Systems
- AICopilot (general AI assistant in admin)
- Executive briefs, procurement autopilot
- Artwork intelligence, margin intelligence
- Warehouse intelligence, ML predictions

## Suppliers
- **Makito**: OAuth JWT, apis.makito.es, 4,573 products
- **MidOcean**: API key, api.midocean.com, 2,409 products (1,993 active)
