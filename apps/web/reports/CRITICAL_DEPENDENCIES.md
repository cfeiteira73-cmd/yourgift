# CRITICAL DEPENDENCIES
**YourGift OS — Dependency Map & Risk Assessment**
**Generated:** 2026-05-28

---

## Runtime Dependencies

### Tier 1: Single Points of Failure

| Dependency | Version | Purpose | Failure Impact | Fallback |
|---|---|---|---|---|
| **Supabase** | ^2.45.0 | Auth, DB, Realtime | Complete blackout | error.tsx boundary |
| **Vercel** | — | Hosting, CDN, deploy | Service unreachable | — |
| **Anthropic API** | — | AI copilot, brain | AI features down | Graceful fallback message |

### Tier 2: Degraded Operation

| Dependency | Version | Purpose | Failure Impact | Fallback |
|---|---|---|---|---|
| **exchangerate-api.com** | — | Currency rates | Stale rates shown | Hardcoded FALLBACK_RATES |
| **Midocean API** | — | Product catalog | Catalog empty | Supabase products_catalog |
| **PF Concept API** | — | Product catalog | Catalog empty | Supabase products_catalog |
| **Resend / SMTP** | — | Magic link email | Login impossible | None |
| **Stripe** | ^14.0.0 | Payments | Payment flow broken | None |

---

## Package Dependencies

### Production (`dependencies`)
```json
{
  "next":                  "^14.2.0",   // Core framework
  "@supabase/supabase-js": "^2.45.0",   // Database + auth
  "@supabase/ssr":         "^0.5.0",    // SSR session management
  "framer-motion":         "^11.11.11", // Animation engine
  "stripe":                "^14.0.0",   // Payment processing
  "@stripe/stripe-js":     "^3.0.0",    // Stripe Elements
  "@stripe/react-stripe-js":"^2.7.0",   // React Stripe components
  "swr":                   "^2.2.5",    // Data fetching (hooks)
  "react":                 "^18.3.0",
  "react-dom":             "^18.3.0",
  "lucide-react":          "^0.462.0",  // Icons
  "clsx":                  "^2.1.1",    // Class merging
  "tailwind-merge":        "^2.3.0",    // Tailwind class dedup
  "class-variance-authority": "^0.7.1",
  "tailwindcss-animate":   "^1.0.7"
}
```

### Significant Omissions (intentional)
```
❌ @upstash/redis       — not installed; rate limiting is in-process
❌ zod                  — not installed; no schema validation
❌ @tanstack/react-query — using SWR instead
❌ prisma               — using Supabase directly (no ORM)
❌ drizzle              — same
❌ recharts/chart.js    — no charting library; SVG inline only
❌ @dnd-kit/core        — no drag-drop library
```

---

## Build Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `typescript` | ^5.4.0 | Type safety |
| `tailwindcss` | ^3.4.0 | CSS framework |
| `autoprefixer` | ^10.4.19 | CSS vendor prefixes |
| `postcss` | ^8.4.38 | CSS processing |
| `@playwright/test` | ^1.49.0 | E2E testing |

---

## Supabase Service Dependencies

```
Authentication:  Supabase Auth (magic link)
                 → Depends on SMTP/email delivery (Resend)
                 → One-time token validation

Database:        PostgreSQL 15+ with pgvector
                 → RLS enabled on 226 tables
                 → Connection pooling via PgBouncer

Realtime:        Supabase Realtime (WebSocket)
                 → Watches: orders, quotes (order-updates channel)
                 → Triggers: router.refresh() on INSERT/UPDATE

Storage:         Supabase Storage
                 → Artwork uploads
                 → Report files

Edge Functions:  (if any)
                 → SLA breach detection (planned)
                 → Webhook retry (planned)
```

---

## Dependency Version Risk Assessment

| Package | Risk | Reason |
|---|---|---|
| `next@^14.2.0` | Medium | Major version lock; Next.js 15 released |
| `framer-motion@^11` | Low | Stable, actively maintained |
| `stripe@^14.0.0` | Medium | Stripe v15 API changes possible |
| `@supabase/supabase-js@^2.45.0` | Low | Stable |
| `@supabase/ssr@^0.5.0` | Medium | Relatively new package |

---

## Missing Critical Dependencies

### Should be installed

| Package | Purpose | Priority |
|---|---|---|
| `zod` | Schema validation on API routes | P1 |
| `@upstash/redis` | Cross-instance rate limiting | P2 |
| `@dnd-kit/core` | Production job drag-drop scheduling | P3 |

---

## Environment Variable Dependencies

```bash
# Required — Production WILL FAIL without these
NEXT_PUBLIC_SUPABASE_URL=          # ✅ Set
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # ✅ Set
NEXT_PUBLIC_APP_URL=               # ✅ Set
NEXT_PUBLIC_API_URL=               # ✅ Set

# Required — Features degrade without these
ANTHROPIC_API_KEY=                 # ❌ MISSING — AI completely down
SUPABASE_SERVICE_ROLE_KEY=         # ❌ MISSING — Admin financial ops broken
EXCHANGE_RATE_API_KEY=             # ❌ MISSING — Stale rates used

# Optional — Nice to have
STRIPE_SECRET_KEY=                 # ❓ Unknown — needed for Stripe integration
STRIPE_WEBHOOK_SECRET=             # ❓ Unknown — needed for webhook verification
RESEND_API_KEY=                    # ❓ Unknown — needed for magic link emails
CRON_SECRET=                       # ❓ Unknown — needed for cron jobs
```

---

## Dependency Chain: Auth Critical Path

```
User Login
    │
    ▼ Resend/SMTP (magic link delivery)
    │  ← DEPENDENCY: Email provider must be operational
    │
    ▼ Supabase Auth (token validation)
    │  ← DEPENDENCY: Supabase project operational
    │
    ▼ middleware.ts (session check)
    │  ← DEPENDENCY: NEXT_PUBLIC_SUPABASE_URL + ANON_KEY set
    │
    ▼ Portal access granted
```

If ANY step fails, user cannot log in. No fallback exists for auth failure.

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-28*
