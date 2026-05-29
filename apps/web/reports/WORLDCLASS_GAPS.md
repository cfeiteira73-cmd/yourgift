# WORLDCLASS GAPS REPORT
**YourGift OS — Gap Analysis vs Stripe/Shopify/Linear/Notion Standards**
**Generated:** 2026-05-28

---

## Benchmark Standards

| Standard | Area | What it means for YourGift |
|---|---|---|
| **Stripe** | Financial precision | Zero-error ledger, idempotency, webhook signing |
| **Shopify** | Operations scale | Production queues, supplier routing, inventory |
| **Apple** | UX quality | 60fps, spring physics, zero jank, premium density |
| **Linear** | Speed | Sub-100ms interactions, instant feedback |
| **Notion** | Usability | Collaborative, real-time, flexible, keyboard-first |
| **Vercel** | Infrastructure | Edge-first, zero downtime, instant deploys |

---

## GAP 1: No Real-Time Production Dashboard (HIGH)

**Stripe standard:** Every payment event is visible in real-time with <500ms latency.
**Current state:** Production page requires manual refresh to see status changes.
**Missing:** WebSocket subscription on `orders` table for production stages.
**Fix:** Add Supabase Realtime channel to `production/page.tsx` watching `orders.status`.

---

## GAP 2: No Live Operations Command Center (HIGH)

**Shopify standard:** Operations teams see all failing jobs, stuck queues, payment failures in real-time.
**Current state:** No live operations center — admin must check multiple pages.
**Missing:** `/live-ops` page aggregating: stuck orders, SLA breaches, failed webhooks, disputed payments, AI anomalies.
**Fix:** Build `/ops-center` page with Supabase Realtime + polling fallback.

---

## GAP 3: No Drag-and-Drop Production Scheduling (MEDIUM)

**Shopify standard:** Visual Kanban for order pipeline management.
**Current state:** Production page is a table view — no drag-drop reordering.
**Missing:** DnD library integration for production job queue.
**Fix:** Add `@dnd-kit/core` for drag-drop production queue.

---

## GAP 4: No Collaborative Artwork Annotations (HIGH)

**Notion standard:** Multiple users can annotate, comment, and approve in the same view.
**Current state:** Artwork page shows versions but no real-time annotation layer.
**Missing:** Annotation canvas, client-visible comments, approval workflow.
**Fix:** Extend artwork approval with per-point annotations (pinned comments).

---

## GAP 5: No Client Multi-User Support (CRITICAL)

**Notion/Linear standard:** Teams, workspaces, members with roles.
**Current state:** One Supabase user = one client. No multi-user companies.
**Missing:** `company_members` table, role matrix (owner/manager/viewer).
**Fix:** Schema migration + RLS policy update (medium effort).

---

## GAP 6: No Stripe Webhook Receiver (HIGH — Financial)

**Stripe standard:** Every payment event verified and processed.
**Current state:** No inbound Stripe webhook handler. Payment confirmation manual.
**Missing:** `/api/webhooks/stripe` with `stripe.webhooks.constructEvent()`.
**Fix:** Create Stripe webhook receiver + update order status on payment events.

---

## GAP 7: No Idempotency on Financial Mutations (HIGH)

**Stripe standard:** Every mutation is idempotent — retry-safe.
**Current state:** Payment processing has no idempotency keys.
**Risk:** Network retry could double-charge or double-credit.
**Fix:** Add `Idempotency-Key: uuidv4()` header to Stripe API calls.

---

## GAP 8: Audit CSV Missing Date Range Filter (MEDIUM)

**Enterprise standard:** Compliance exports must be date-bounded.
**Current state:** CSV export defaults to 90 days, no date range parameter.
**Fix:** Add `since` and `until` query params to export mode.

---

## GAP 9: No Zod Validation on API Bodies (MEDIUM)

**Production standard:** Every API mutation validates shape at the boundary.
**Current state:** `request.json()` parsed without schema validation.
**Risk:** Malformed payloads bypass business logic, cause unexpected behavior.
**Fix:** Add Zod schemas to financial + payment routes.

---

## GAP 10: No Edge Runtime on Latency-Sensitive Routes (MEDIUM)

**Vercel standard:** Sub-50ms globally for simple data lookups.
**Current state:** All routes on Node.js serverless (~100ms cold start).
**Fix:** Move `/api/health-probes`, `/api/currency`, `/api/catalog` to Edge Runtime.

---

## GAP 11: No CSP (Content Security Policy) Header (MEDIUM)

**Security standard:** Strict CSP prevents XSS even if injection occurs.
**Current state:** X-Content-Type-Options + X-XSS-Protection present but no CSP.
**Fix:** Add `Content-Security-Policy` with nonce-based script allowlist.

---

## GAP 12: No Loading State on Dashboard Error (MEDIUM)

**Apple standard:** Every possible state has a design.
**Current state:** Dashboard RSC throws to `error.tsx` on Supabase failure.
**Fix:** Wrap `Promise.all` in dashboard in try/catch with partial data rendering.

---

## GAP 13: Mobile Viewport Not Auto-Detected (LOW)

**Apple standard:** App automatically detects mobile and adapts.
**Current state:** `/mobile` page exists but users must navigate there manually.
**Fix:** Add viewport detection redirect in `(portal)/layout.tsx`.

---

## GAP 14: No Keyboard Shortcuts Beyond Cmd+K (LOW)

**Linear standard:** Every action has a keyboard shortcut.
**Current state:** Only Cmd+K (command palette) documented.
**Fix:** Add `?` to open keyboard shortcut reference; `g o` for orders, etc.

---

## GAP 15: No Stripe Payment Links (LOW)

**Shopify standard:** One-click payment link for invoices.
**Current state:** Invoices visible but no payment link generation.
**Fix:** Generate Stripe Payment Links per invoice, email to client.

---

## Priority Matrix

```
            IMPACT
            HIGH │ MEDIUM │ LOW
           ──────┼────────┼────
HIGH      │G1,G2 │G4,G5   │G7
EFFORT    │G6,G7 │G9,G10  │
           ──────┼────────┼────
MEDIUM    │G3    │G8,G11  │G13
           ──────┼────────┼────
LOW       │G5 DB │G12     │G14,G15
```

### Sprint 1 (Immediate, <1 week)
1. G2: Live Operations Center page
2. G1: Realtime on production page
3. G8: CSV date range filter

### Sprint 2 (1-2 weeks)
4. G6: Stripe webhook receiver
5. G7: Idempotency keys
6. G9: Zod validation on financial routes

### Sprint 3 (2-4 weeks)
7. G4: Artwork annotation layer
8. G10: Edge Runtime migration
9. G11: CSP header

### Sprint 4 (1-2 months)
10. G5: Multi-user companies (schema migration)
11. G3: DnD production scheduling
12. G13: Auto mobile detection

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-28*
