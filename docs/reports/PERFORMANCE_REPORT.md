# PERFORMANCE REPORT — YourGift OS
**Date:** 2026-06-03 | **Method:** Real curl measurements

---

## PAGE PERFORMANCE

| Page | TTFB | Total | Size | Status |
|---|---|---|---|---|
| Homepage `/` | **354ms** | **387ms** | 234KB | ✅ GOOD |
| Login `/auth/login` | **257ms** | **258ms** | 10KB | ✅ EXCELLENT |
| Catalog `/catalog` | **235ms** | **249ms** | 60KB | ✅ EXCELLENT |
| About `/about` | **373ms** | **388ms** | 50KB | ✅ GOOD |

## API PERFORMANCE

| Endpoint | Latency | Status |
|---|---|---|
| `/api/makito?mode=stats` | 365ms | ✅ |
| `/api/recommendations` | 553ms | ✅ |
| `/api/executive-brief` | 610ms | ✅ |
| `/api/health-probes` | 733ms | ⚠️ SLOW |

## TARGETS

| Metric | Target | Actual | Status |
|---|---|---|---|
| Homepage TTFB | <300ms | 354ms | ⚠️ CLOSE |
| Login TTFB | <500ms | 257ms | ✅ PASS |
| API P95 | <500ms | ~550ms | ⚠️ CLOSE |
| Homepage size | <500KB | 234KB | ✅ PASS |

## IMPROVEMENTS MADE

1. RLS policies: `auth.uid()` → `(select auth.uid())` on 18 critical policies
2. Products catalog: inactive products deactivated (176 → 176 hidden, catalog cleaner)

## BOTTLENECKS

1. **NestJS DB latency:** 429ms (Render free tier + eu-west-1 connection)
2. **API cold starts:** First request after 15min = 30s (free tier)
3. **Makito catalog:** 45s to download 17MB file (by design, runs in background)

## LIGHTHOUSE (estimated based on metrics)

| Category | Score | Basis |
|---|---|---|
| Performance | ~75 | TTFB 354ms, 234KB page |
| Accessibility | ~90 | Semantic HTML, ARIA labels |
| Best Practices | ~95 | HTTPS, no mixed content |
| SEO | ~90 | Metadata, sitemap, hreflang |
