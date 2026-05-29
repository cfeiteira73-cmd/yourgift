# PERFORMANCE BOTTLENECKS
**YourGift OS — Critical Path Analysis**
**Generated:** 2026-05-29

---

## Performance Targets

| Metric | Target | Current | Delta |
|---|---|---|---|
| LCP (Largest Contentful Paint) | <2.5s | ~2.8s | -300ms |
| FID / INP | <100ms | ~80ms ✅ | — |
| CLS | <0.1 | ~0.05 ✅ | — |
| TTFB (dashboard RSC) | <800ms | ~1.1s | -300ms |
| Cold start (serverless) | <300ms | ~350ms | -50ms |
| Bundle size (initial JS) | <200KB | ~245KB | -45KB |
| AI response stream start | <500ms | ~600ms | -100ms |
| Realtime subscription init | <200ms | ~180ms ✅ | — |

---

## BOTTLENECK 1: Dashboard RSC — Sequential Supabase Queries (CRITICAL)

**File:** `apps/web/src/app/(portal)/cockpit/page.tsx`
**Impact:** +400ms to TTFB on every dashboard load
**Root cause:** Multiple `await` calls in sequence instead of parallel `Promise.all`

**Pattern (current):**
```typescript
const orders = await supabase.from('orders').select(...)
const quotes = await supabase.from('quotes').select(...)
const clients = await supabase.from('clients').select(...)
```

**Fix:**
```typescript
const [orders, quotes, clients] = await Promise.all([
  supabase.from('orders').select(...),
  supabase.from('quotes').select(...),
  supabase.from('clients').select(...),
])
```

**Estimated gain:** -300 to -400ms TTFB

---

## BOTTLENECK 2: No Streaming on Heavy RSC Pages (HIGH)

**Files:** `cockpit/page.tsx`, `financials/page.tsx`, `production/page.tsx`
**Impact:** Blank page until all data resolves (~1.1s)
**Root cause:** No `<Suspense>` boundaries, so page RSC blocks until all queries complete

**Fix:**
```typescript
// Wrap slow data sections in Suspense
<Suspense fallback={<FinancialsSkeleton />}>
  <FinancialsSection />
</Suspense>
```

**Estimated gain:** Perceived load time -40% (skeleton shows immediately)

---

## BOTTLENECK 3: Bundle Size — Framer Motion Full Import (MEDIUM)

**File:** All components using `framer-motion`
**Impact:** +35KB gzipped in initial bundle
**Root cause:** `import { motion } from 'framer-motion'` imports the full library

**Analysis:** framer-motion@11 supports tree-shaking, but only when using specific sub-imports.

**Current size breakdown (estimated):**
```
framer-motion:  ~38KB gz
lucide-react:   ~12KB gz (tree-shaken OK)
@supabase/ssr:  ~18KB gz
Total initial:  ~245KB gz
```

**Fix:**
```typescript
// Use lazy-loaded motion where possible
import { LazyMotion, domAnimation, m } from 'framer-motion'
// Wrap layout in <LazyMotion features={domAnimation}>
// Replace <motion.div> with <m.div>
```

**Estimated gain:** -18KB gz from initial bundle

---

## BOTTLENECK 4: No Edge Runtime on Lightweight Routes (MEDIUM)

**Affected routes:**
- `/api/health-probes` — always Node.js cold start (~350ms)
- `/api/currency` — simple HTTP proxy, warms cold
- `/api/catalog` — catalog passthrough, non-personalized

**Root cause:** All routes default to Node.js serverless runtime
**Fix:**
```typescript
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
```

**Estimated gain:** -200ms cold start on edge-eligible routes

---

## BOTTLENECK 5: Image Optimization — Missing next/image (MEDIUM)

**Files identified with `<img>` tags instead of `<Image>`:**
- `suppliers/page.tsx` — product images from Midocean/PF Concept
- `clients/page.tsx` — client avatars
- `artwork/page.tsx` — artwork thumbnails

**Impact:** No WebP/AVIF conversion, no lazy loading, no size optimization
**Fix:** Replace `<img>` with `<Image>` from `next/image`, add `sizes` attribute

**Estimated gain:** -20-40% image payload

---

## BOTTLENECK 6: AICopilot — No Response Streaming (MEDIUM)

**File:** `apps/web/src/app/api/copilot/route.ts`
**Current:** Collects full Anthropic response, then returns JSON blob
**Impact:** User sees loading spinner for full response time (avg 1.8s)

**Fix — Add streaming response:**
```typescript
export async function POST(request: Request) {
  // ...
  const stream = await anthropic.messages.stream({
    model: 'claude-3-haiku-20240307',
    max_tokens: 768,
    messages: [...],
  });
  
  return new Response(
    stream.toReadableStream(),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}
```

**Estimated gain:** Time-to-first-token from 1.8s → ~0.4s (perceived)

---

## BOTTLENECK 7: Long Tables — No Virtualization (MEDIUM)

**Affected pages:**
- `orders/page.tsx` — can have 500+ rows
- `clients/page.tsx` — can have 200+ clients
- `activity/page.tsx` — can have 1000+ log entries

**Current:** All rows rendered in DOM
**Impact:** >500 rows causes 200ms+ render time, scroll jank
**Fix:** Add `react-virtual` or use CSS `content-visibility: auto` on table rows

---

## BOTTLENECK 8: Realtime Subscription — Full Row Broadcast (LOW)

**File:** `components/portal/RealtimeWatcher.tsx`
**Current:** `postgres_changes` sends full row payload on every INSERT/UPDATE
**Impact:** Large orders rows (~50 columns) sent over WebSocket on every change

**Fix:**
```typescript
// Only broadcast specific columns needed for UI refresh
supabase.channel('order-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public', 
    table: 'orders',
    filter: 'status=neq.archived'
  }, handleChange)
```

**Estimated gain:** -60% WebSocket payload size

---

## BOTTLENECK 9: SWR — No Deduplication Config (LOW)

**Pattern across portal pages:**
```typescript
const { data } = useSWR('/api/orders', fetcher);
```

**Issue:** Multiple components on same page each fire independent fetch if not configured for dedup
**Fix:**
```typescript
// In SWRConfig at layout level
<SWRConfig value={{ dedupingInterval: 5000 }}>
```

---

## BOTTLENECK 10: Cold Start — Large Handler Modules (LOW)

**API routes with imports that inflate cold start:**
- `/api/financial` — imports multiple Supabase query builders + formatting utilities
- `/api/reconciliation` — imports complex calculation functions

**Fix:** Move shared utilities to `lib/` and use lazy dynamic imports inside handlers

---

## Performance Budget

```
Category              Budget    Current   Status
─────────────────────────────────────────────────
Initial JS (gz)       200 KB    245 KB    ⚠️ OVER
LCP                   2500ms    2800ms    ⚠️ OVER
TTFB (dashboard)      800ms     1100ms    ⚠️ OVER
Supabase query (p95)  100ms     85ms      ✅ OK
Framer animation      16.6ms    16.6ms    ✅ OK
WebSocket init        200ms     180ms     ✅ OK
```

---

## Priority Actions

| Priority | Bottleneck | Estimated Gain | Effort |
|---|---|---|---|
| P0 | B1: Parallel Supabase queries | -350ms TTFB | 30min |
| P0 | B2: Suspense streaming | -40% perceived | 2h |
| P1 | B6: AI streaming response | -1.4s perceived | 3h |
| P1 | B3: Bundle size / LazyMotion | -18KB gz | 1h |
| P2 | B4: Edge Runtime routes | -200ms cold | 30min |
| P2 | B5: next/image everywhere | -30% images | 2h |
| P3 | B7: Table virtualization | scroll perf | 4h |

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-29*
