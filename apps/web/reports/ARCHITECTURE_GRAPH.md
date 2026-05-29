# ARCHITECTURE GRAPH
**YourGift OS — System Topology**
**Generated:** 2026-05-28

---

## System Topology

```
                         ┌─────────────────────────────────────────────┐
                         │              CLIENT LAYER                    │
                         │  Browser / Mobile / PWA                     │
                         └──────────────┬──────────────────────────────┘
                                        │ HTTPS/TLS 1.3
                         ┌──────────────▼──────────────────────────────┐
                         │           EDGE LAYER                         │
                         │  Vercel Edge Network + CloudFront CDN        │
                         │  8 Security Headers · HSTS · CSP-equiv      │
                         └──────────────┬──────────────────────────────┘
                                        │
               ┌────────────────────────▼─────────────────────────┐
               │              NEXT.JS 14 APP ROUTER               │
               │              (Vercel Serverless)                  │
               │                                                   │
               │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
               │  │  (marketing) │  │   (portal)  │  │  auth/  │ │
               │  │  RSC pages  │  │  CSR + RSC  │  │ flows   │ │
               │  │  12 routes  │  │  57 pages   │  │ 5 pages │ │
               │  └─────────────┘  └──────┬──────┘  └─────────┘ │
               │                          │                        │
               │  ┌────────────────────────────────────────────┐  │
               │  │           API LAYER (48 routes)             │  │
               │  │  /api/copilot  /api/brain  /api/analytics  │  │
               │  │  /api/orders   /api/quotes /api/financial  │  │
               │  │  /api/payments /api/audit  /api/support    │  │
               │  │  ... 38 more routes                        │  │
               │  └────────────────────────────────────────────┘  │
               └────────────────────────┬─────────────────────────┘
                                        │
          ┌─────────────────────────────┼──────────────────────────────┐
          │                             │                              │
┌─────────▼─────────┐       ┌──────────▼──────────┐     ┌────────────▼────────┐
│    SUPABASE       │       │   ANTHROPIC API      │     │  EXTERNAL APIs      │
│                   │       │                      │     │                     │
│  PostgreSQL       │       │  claude-3-haiku      │     │  exchangerate-api   │
│  (226 RLS tables) │       │  max_tokens: 768     │     │  Midocean catalog   │
│  pgvector         │       │  Rate: 30/60s        │     │  PF Concept         │
│  Realtime         │       │  History: 20 msgs    │     │  DHL/CTT tracking   │
│  Auth (magic link)│       │  3000 chars/msg cap  │     │  Stripe (planned)   │
│  Storage          │       │                      │     │                     │
│  Edge Functions   │       │                      │     │                     │
└───────────────────┘       └──────────────────────┘     └─────────────────────┘
```

---

## Data Flow: Order Lifecycle

```
Client Portal
    │
    ▼ POST /api/quotes (create quote)
Supabase: quotes table (status: draft)
    │
    ▼ Client submits quote
quotes.status → 'submitted'
    │
    ▼ Admin reviews in /cockpit
quotes.status → 'pricing' → 'approved'
    │
    ▼ Client accepts → POST /api/orders
Supabase: orders table (status: confirmed)
    │
    ├─ RealtimeWatcher → client dashboard refreshes
    │
    ▼ Production assigns
orders.status → 'in_production'
    │
    ├─ SLA monitor checks expected_hours
    ├─ omega_final_sla_breaches if exceeded
    │
    ▼ Quality check
qc_inspections → pass/fail
    │
    ▼ Ship
orders.status → 'shipped'
    │
    ▼ Deliver
orders.status → 'delivered'
    │
    ▼ Invoice
invoices table → audit_log: 'invoice_paid'
    │
    ▼ Reconciliation
omega_final_reconciliation_runs → confirm match
```

---

## Authentication Flow

```
User → /auth/login
    │
    ▼ POST magic link (Supabase Auth)
Email delivery (Resend/SMTP)
    │
    ▼ User clicks link → /auth/recover?token=...
Supabase validates token (one-time use, SHA-256 blocklist)
    │
    ▼ Session cookie set (HTTP-only, SameSite=Lax)
    │
    ▼ middleware.ts intercepts ALL requests
supabase.auth.getUser() on every request
    │
    ├─ No session → redirect /auth/login?next=<path>
    ├─ Session valid → refresh cookie → continue
    └─ Admin check → ADMIN_EMAILS.includes(email)
```

---

## AI Processing Pipeline

```
Client message
    │
    ▼ POST /api/copilot
Rate limit check: 30/60s (in-process Map)
    │
    ▼ Supabase auth.getUser()
    │
    ▼ buildContext() — 5 parallel Supabase queries
    │  ├─ clients table (profile)
    │  ├─ orders table (recent 10, status, amounts)
    │  ├─ inventory_alerts (unresolved)
    │  ├─ quotes count
    │  └─ products count
    │
    ▼ buildSystemPrompt(context)
    │  Portuguese PT instructions
    │  Real-time operational context injected
    │
    ▼ Anthropic API (claude-3-haiku)
    │  max_tokens: 768
    │  History: last 20 msgs × 3000 chars
    │
    ▼ Response → client
Context summary: { activeOrders, inventoryAlerts }
```

---

## Component Dependency Graph

```
PortalLayout (root)
    ├── PortalLayoutContext (nesting guard)
    ├── GlobalSearch
    │   └── Supabase: orders, quotes, clients
    ├── CommandPalette
    │   └── keyboard: Cmd+K
    ├── AICopilot
    │   └── /api/copilot (rate limited)
    ├── NotificationCenter
    │   └── /api/notifications (Supabase Realtime)
    ├── ToastContainer
    │   └── ToastNotification events
    └── RealtimeIndicator
        └── Supabase connection status

RealtimeWatcher (Dashboard)
    └── supabase.channel('order-updates')
        ├── orders INSERT/UPDATE → router.refresh()
        └── quotes INSERT/UPDATE → router.refresh()
```

---

## Middleware Security Layers

```
Request
    │
    ▼ Layer 1: Supabase session refresh
    │  getSession() → updateSession() → cookie refresh
    │
    ▼ Layer 2: Admin route protection
    │  /admin/* → ADMIN_EMAILS check
    │
    ▼ Layer 3: Security headers injection
    │  X-Frame-Options, X-Content-Type-Options
    │  Referrer-Policy, X-XSS-Protection
    │  X-DNS-Prefetch-Control, Permissions-Policy
    │  HSTS (HTTPS only)
    │
    ▼ Layer 4: poweredByHeader: false
    │
    ▼ Response to client
```

---

## Infrastructure Architecture (AWS)

```
Internet
    │
    ▼ CloudFront CDN (eu-west-1)
    │  WAF rules
    │  SSL termination
    │
    ▼ Application Load Balancer
    │  Health checks
    │  Target groups
    │
    ▼ ECS Fargate Cluster
    │  ├─ NestJS API (port 3001) — task definition
    │  └─ Next.js Admin (port 3002) — task definition
    │
    ├─ Aurora PostgreSQL (RDS)
    │  Multi-AZ, automated backups
    │
    ├─ ElastiCache Redis
    │  Session store, rate limiting
    │
    ├─ S3 buckets
    │  Artwork files, reports, exports
    │
    └─ Secrets Manager
       DB credentials, API keys, SMTP
```

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-28*
