# SYSTEM EVOLUTION MAP — YourGift OS
**Generated:** 2026-05-28  
**Architect:** Principal Systems Architect  
**Mission:** Transform YourGift into the world's most advanced merchandising, procurement, production and fulfillment operating system.

---

## 1. MONOREPO TOPOLOGY

```
yourgift-os/
├── apps/
│   ├── web/        → Next.js 14 — main app (www.yourgift.pt) — port 3000
│   │   ├── (marketing)/  → Public marketing pages
│   │   ├── (portal)/     → Admin portal (BLOCKED: geral@yourgift.pt + geral@agencygroup.pt)
│   │   └── client-portal/→ Client portal (all other authenticated users)
│   └── admin/      → Next.js 14 — internal ops admin (admin.yourgift.pt) — port 3002
├── services/
│   └── api/        → NestJS 10 — REST API (yourgift-api.onrender.com) — port 3001
│       └── prisma/ → PostgreSQL schema + migrations (Supabase hosted)
├── packages/
│   └── shared/     → Shared types/utilities
└── terraform/      → AWS ECS Fargate infrastructure + multi-region
```

**Database:** Supabase PostgreSQL (eu-west-1) — `hzfzdjmprtlsnrpsjdgh`  
**Auth:** Supabase SSR (apps/web), JWT Bearer (services/api + apps/admin)  
**Storage:** Supabase Storage (client-assets bucket)  
**CDN:** CloudFront (cdn.yourgift.pt)  
**Email:** Resend  
**Payments:** Stripe (test keys — NOT live)  
**Suppliers:** Midocean (live key), PF Concept (keys missing), Stricker  

---

## 2. SERVICES/API — NestJS 10

### Module Inventory (122 modules | 117 controllers | 183 services)

**PRODUCTION-SAFE (fully implemented, do not touch core logic):**
| Module | Status | Notes |
|--------|--------|-------|
| `orders` | ✅ Production-safe | Full CRUD, status FSM |
| `quotes` + `rfq` | ✅ Production-safe | Multi-item, margin calc |
| `products` | ✅ Production-safe | Midocean/PF Concept sync |
| `pricing` | ✅ Production-safe | Rules engine, volume tiers |
| `payments` | ✅ Production-safe | Stripe sessions + webhooks |
| `reconciliation` | ✅ Production-safe | Stripe reconciliation + scheduler |
| `ledger` | ✅ Production-safe | Double-entry, append-only |
| `refunds` | ✅ Production-safe | Has spec tests |
| `subscriptions` | ✅ Production-safe | Has spec tests |
| `auth` + `admin-auth` | ✅ Production-safe | JWT, MFA, SAML |
| `webhooks` | ✅ Production-safe | Outbound + delivery tracking |
| `event-log` + `event-sourcing` | ✅ Production-safe | Append-only event stream |
| `queue` + workers | ✅ Production-safe | email/pdf/financial/supplier-sync workers |
| `allowance-ledger` (store-portal) | ✅ Production-safe | Append-only, immutable |
| `suppliers` + `supplier-intelligence` | ✅ Partial | SLA prediction exists |
| `production` + `production-pipeline` | ✅ Partial | Status tracking |
| `shipment-tracking` | ✅ Partial | Events model |
| `approvals` | ✅ Production-safe | Multi-stage approval chain |
| `campaigns` + `company-stores` | ✅ Production-safe | Store portal live |
| `budgets` | ✅ Production-safe | Budget ledger |
| `clients` + `companies` | ✅ Production-safe | Multi-tenant |
| `notifications` | ✅ Partial | Framework exists |
| `artwork` | ✅ Partial | Upload + review states |

**INFRASTRUCTURE (do not touch):**
| Module | Notes |
|--------|-------|
| `prisma` | Prisma service singleton |
| `health` | Health checks |
| `rate-limit` | Redis-backed rate limiting |
| `tracing` | OpenTelemetry traces |
| `observability` | Metrics/logs |
| `sre` | Auto-remediation + rollback |
| `security-certification` | Evidence export |

**ADVANCED / AI SYSTEMS (partially wired):**
| Module | Status |
|--------|--------|
| `ai` + `ai-design` | Partial — design jobs model exists |
| `procurement-agent` | Partial — brief parser |
| `intelligence` | Framework |
| `analytics` | Framework |
| `financial-intelligence` | Framework |
| `retention` | Partial — churn risk model |
| `demand-forecast` | Model exists, service partial |
| `supplier-routing` | Matrix model exists |
| `learning-loop` | Framework |
| `automation` | Rules + executions model |
| `workflows` | DAG engine |
| `projection` (CQRS) | Models + rebuild log |

**EXPERIMENTAL / NOT WIRED (safe to improve):**
chaos, failure-lab, simulate, proof-engine, benchmark-report, chaos, network-intelligence, globalization, event-platform, employee-portal, onboarding-wizard

---

## 3. APPS/ADMIN — Next.js 14

**Pages (85+ routes):**
- `dashboard` — Kanban pipeline + KPIs + AI insights
- `production` — SLA monitor + control tower
- `orders` + `orders/[id]` — Order detail with timeline
- `suppliers` + `supplier-intelligence`
- `quotes`
- `clients` + `companies`
- `analytics` + `financial` + `financial-intelligence`
- `ledger` + `reconciliation` + `payments`
- `campaigns`
- `inventory`
- `automation` + `workflows` + `approvals`
- `incidents` + `reliability` + `observability`
- `settings`, `webhooks`, `notifications`
- ... and 50+ more specialized pages

**Components:**
- `ShellLayout` — top bar + sidebar + breadcrumb
- `CommandBar` — ⌘K palette
- `AICopilotPanel` — sliding copilot
- `Sidebar` — collapsible nav with sections
- `KpiCard`, `StatusBadge`, `DataTable`, `OrderTimeline`

**Auth:** JWT Bearer token in localStorage (admin-specific, separate from Supabase)  
**API:** Calls `yourgift-api.onrender.com` (NestJS)  

---

## 4. APPS/WEB — Next.js 14

### Marketing Routes (`/(marketing)/`)
| Route | Status |
|-------|--------|
| `/` | ✅ Homepage |
| `/about`, `/blog`, `/catalog` | ✅ |
| `/branded-merch`, `/corporate-gifts` | ✅ |
| `/enterprise`, `/fulfillment`, `/packaging` | ✅ |
| `/how-it-works`, `/rfq`, `/quote` | ✅ |
| `/store/[slug]` | ✅ Company store (live) |
| `/company-stores` | ✅ |

### Portal Routes (`/(portal)/`) — Admin only
| Route | Status |
|-------|--------|
| `/dashboard` | ✅ Full — Command Center + Realtime |
| `/orders` + `/orders/[id]` | ✅ |
| `/quotes` + `/quotes/[id]` + `/quotes/new` | ✅ |
| `/products` + `/products/[id]` | ✅ |
| `/production` | ✅ |
| `/suppliers` | ✅ |
| `/clients` | ✅ |
| `/billing` | ✅ |
| `/assets` | ✅ |
| `/reports` + `/reports/[shareToken]` | ✅ |
| `/marketing` | ✅ |
| `/integrations` | ✅ |
| `/settings` | ✅ |

### Client Portal Routes (`/client-portal/`)
| Route | Status |
|-------|--------|
| `/client-portal` | ✅ Dashboard — KPIs + recent activity |
| `/client-portal/orders` | ✅ Order list + StatusTimeline |
| `/client-portal/quotes` | ✅ Request form + filters |
| `/client-portal/assets` | ✅ Drag-drop Supabase Storage upload |
| `/client-portal/products` | ✅ Catalog + quote request modal |
| `/client-portal/billing` | ✅ Invoices + overdue alerts |
| `/client-portal/settings` | ✅ Profile + notifications + sign out |

### Auth Routes (`/auth/`)
| Route | Status |
|-------|--------|
| `/auth/login` | ✅ |
| `/auth/register` | ✅ |
| `/auth/recover` | ✅ |
| `/auth/callback` + `/auth/confirm` | ✅ |
| `/auth/magic` | ✅ |
| `/auth/logout` | ✅ |
| `/auth/sso-complete` | ✅ |
| `/auth/bootstrap` | ✅ |
| `/auth/metrics` | ✅ |

### Portal Components
- `PortalLayout` — admin sidebar + GlobalSearch ⌘K + AICopilot + mobile nav
- `ClientPortalLayout` — client sidebar + mobile nav
- `CommandCenter` — dashboard server component
- `GlobalSearch` — command palette with Supabase search
- `AICopilot` — floating chat → `/api/copilot` → Anthropic claude-3-haiku
- `RealtimeWatcher` — Supabase Realtime postgres_changes subscription

---

## 5. DATABASE — PRISMA SCHEMA

### Core Models (NEVER TOUCH — financial integrity)
| Model | Notes |
|-------|-------|
| `LedgerEntry` + `LedgerTransaction` | Double-entry, append-only |
| `AllowanceLedgerEntry` | Append-only employee allowance |
| `ProcurementEvent` | Event sourcing stream, append-only |
| `Order` + `OrderItem` | Core transactional |
| `Quote` + `QuoteItem` | RFQ pipeline |
| `Refund` | Financial correctness |
| `WebhookDelivery` | Audit trail |

### Safe to Extend (additive only)
| Model | Extension Opportunity |
|-------|----------------------|
| `Artwork` | + AI scores, vectorization status, print-safe detection |
| `Product` + `ProductVariant` | + AI embeddings, carbon score |
| `Supplier` (implicit) | Create dedicated model + enrichment fields |
| `Order` | + estimated_delivery, production_stage, sla_deadline |
| `Client` | + notification_prefs (column exists in Supabase but not Prisma) |
| `BrandTemplate` | + design intelligence fields |
| `AIDesignJob` + `DesignMockup` | + quality scores |

### Missing from Supabase (exists in Prisma, needs migration)
- `invoices` table (referenced in client portal billing page)
- `notification_prefs` column on clients
- Several advanced financial models may not be migrated yet

---

## 6. WHAT ALREADY EXISTS (DO NOT REBUILD)

✅ Double-entry financial ledger  
✅ Append-only event sourcing (ProcurementEvent)  
✅ CQRS read projections (OrderProjection, AggregateSnapshot)  
✅ Stripe payment + webhook + reconciliation  
✅ Multi-tenant isolation (tenantId everywhere)  
✅ Approval chains (multi-stage: hr | manager | finance)  
✅ Budget management with spend limits  
✅ Campaign management  
✅ Company stores (white-label employee portals)  
✅ Product catalog with supplier sync (Midocean live)  
✅ Pricing rules engine (volume, tier, client, category)  
✅ Queue system with dead-letter queue  
✅ Workflow DAG engine  
✅ Automation rules engine  
✅ Supplier performance model + SLA prediction  
✅ Supplier routing matrix  
✅ Demand forecasting model  
✅ Client financial snapshots + cohort analysis  
✅ Churn risk scoring  
✅ AI design jobs + brand templates  
✅ Supabase Realtime subscriptions  
✅ GlobalSearch ⌘K command palette  
✅ AICopilot (Anthropic claude-3-haiku)  
✅ Role-based access control (middleware email allowlist)  
✅ E2E tests (Playwright)  
✅ Integration tests (procurement, payment, reconciliation, circuit-breaker)  
✅ Shadow replay infrastructure (Terraform Lambda)  
✅ Multi-region Terraform (ECS, RDS, ElastiCache, WAF, Route53)  

---

## 7. WHAT IS PARTIAL / NEEDS COMPLETION

⚠️ **Artwork Intelligence** — Upload exists, AI vectorization/quality scoring not wired  
⚠️ **AI Design Studio** — Models exist, API not connected to real generative AI  
⚠️ **Supplier Intelligence** — Model exists, self-improving loop not running  
⚠️ **Demand Forecasting** — Model exists, computation service incomplete  
⚠️ **Client Portal Billing** — Uses `invoices` table that needs Supabase migration  
⚠️ **Client Settings** — `notification_prefs` JSON column needs Supabase migration  
⚠️ **Production Pipeline** — Visual manufacturing pipeline exists as UI, needs API integration  
⚠️ **Shipment Radar** — Events model exists, live tracking not wired  
⚠️ **Financial Intelligence** — CFO dashboard exists in admin app, charts partially real  
⚠️ **Notifications** — Framework exists, push/email not fully wired per-event  
⚠️ **Stripe** — Test keys only. Real payments not live.  
⚠️ **PF Concept** — API keys missing  
⚠️ **AWS infrastructure** — Terraform ready but not deployed (using Render for API)  

---

## 8. WHAT IS DUPLICATED / OVERLAPPING

🔄 **Two admin portals:**  
- `apps/web/(portal)/` — client-facing admin portal (Supabase auth, premium UX)  
- `apps/admin/` — internal ops admin (JWT auth, calls NestJS API directly)  
→ **Decision:** `apps/web/(portal)/` is the primary product portal. `apps/admin/` is internal ops tooling. Both serve different purposes. Keep both. Bridge them.

🔄 **Two copilot implementations:**  
- `apps/web/src/components/portal/AICopilot.tsx` — floating chat in web portal  
- `apps/admin/src/components/AICopilotPanel.tsx` — sliding panel in admin  
→ **Decision:** Keep both. Extract to shared package eventually.

🔄 **Supabase vs Prisma/NestJS:**  
- `apps/web` uses Supabase client directly for most data  
- `apps/admin` calls NestJS API (which uses Prisma)  
→ **Decision:** Continue this pattern. Web portal = Supabase for speed. Admin = NestJS for complex ops.

---

## 9. WHAT IS MISSING

🔴 **Artwork Intelligence Pipeline** — No vectorization, no print-safe detection, no Pantone matching  
🔴 **Visual Order Builder** — No drag-drop logo positioning / mockup preview  
🔴 **Live Production Board** — No real-time factory view (admin has UI shell)  
🔴 **Live Shipment Radar** — No carrier API integration  
🔴 **Executive Financial Cockpit** — Margin intelligence not real  
🔴 **AI Procurement Assistant** — Framework only, not context-aware  
🔴 **Semantic Search** — No vector embeddings on products/orders  
🔴 **Supplier Carbon Score** — Not implemented  
🔴 **Multi-currency** — EUR only in practice  
🔴 **Client portal catalog** — Uses sample data, not real Supabase products  
🔴 **invoices table** — Missing Supabase migration  
🔴 **Widget engine / drag-drop dashboard** — Not built  
🔴 **Role-aware dashboard** — Single view, no role switching  

---

## 10. WHAT MUST NEVER BE TOUCHED

🚫 `AllowanceLedgerEntry` — append-only, financial correctness  
🚫 `LedgerEntry` / `LedgerTransaction` — double-entry accounting  
🚫 `ProcurementEvent` stream — event sourcing integrity  
🚫 Stripe webhook handler — payment reconciliation  
🚫 `Refund` service + tests  
🚫 `Subscription` service + tests  
🚫 `Reconciliation` scheduler  
🚫 JWT auth / admin-auth flows  
🚫 SAML integration  
🚫 Rate limiting guards  
🚫 `Order` FSM transitions (status state machine)  
🚫 `middleware.ts` email allowlist (ADMIN_EMAILS security boundary)  
🚫 E2E + integration tests  

---

## 11. EVOLUTION ROADMAP

### SPRINT A — Foundation & Data (NOW)
1. Create missing Supabase migrations (`invoices`, `notification_prefs`, products activation)
2. Wire real product catalog to client portal (`/client-portal/products`)
3. Create `SYSTEM_EVOLUTION_MAP.md` ← **THIS FILE**

### SPRINT B — Admin Dashboard Evolution (HIGH IMPACT)
1. Transform `apps/admin` dashboard into Live Command Center
2. Live Production Board (real NestJS data)
3. Supplier Intelligence real data
4. Financial cockpit real margins

### SPRINT C — Artwork Intelligence (DIFFERENTIATOR)
1. Artwork upload → quality scoring
2. Print-safe area detection
3. DPI intelligence
4. Collaborative proofing (comments + approvals)

### SPRINT D — Client Portal Enhancement
1. Visual order builder with product configurator
2. Brand kit management
3. AI-powered reorder recommendations
4. 1-click reorder

### SPRINT E — Production Operating System
1. Visual manufacturing pipeline (real data)
2. SLA monitoring + breach alerts
3. Supplier health radar
4. Automatic failover routing

### SPRINT F — Financial Intelligence
1. Real margin engine
2. Profitability by client/product/supplier
3. Cashflow forecasting
4. Anomaly detection

### SPRINT G — AI Operating Brain
1. Semantic product search (pgvector)
2. AI procurement assistant (context-aware)
3. Operational summaries
4. Predictive operations

---

## 12. IMMEDIATE PRIORITIES (NEXT BUILD)

**P0 — Blocking production use:**
1. `invoices` table Supabase migration
2. `notification_prefs` column migration
3. Real Stripe keys activation plan
4. PF Concept API keys

**P1 — High business value:**
1. Admin `apps/admin` dashboard — connect to real API data
2. Client portal catalog — real products from Supabase
3. Artwork proofing workspace
4. Live production board

**P2 — Competitive differentiation:**
1. AI design mockup generator
2. Semantic product search
3. Supplier reliability scoring (real data)
4. Executive margin cockpit

---

*This document is the single source of truth for system evolution decisions.*  
*Always check here before building anything new.*  
*Always update here when something new is built.*
