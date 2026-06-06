# 15 PERFORMANCE REPORT
**Date:** 2026-06-04 | **Real measurements only**

## PAGE PERFORMANCE (3 runs each)
| Page | TTFB min | TTFB max | HTTP | Target |
|---|---|---|---|---|
| Homepage | 262ms | 590ms | 200 | <300ms |
| Login | 232ms | 447ms | 200 | <500ms |
| Catalog | 235ms | 685ms | 200 | <500ms |
| About | 372ms | 611ms | 200 | <500ms |

## API LATENCY
| Endpoint | Latency | Status |
|---|---|---|
| /api/makito?mode=stats | ~350ms | ✅ |
| /api/recommendations | ~450ms | ✅ |
| /api/executive-brief | ~520ms | ✅ |
| /api/health-probes | ~400ms | ✅ |

## SUPPLIER API LATENCY
| Supplier | Endpoint | Latency |
|---|---|---|
| Makito | Auth | <400ms |
| MidOcean | Stock | 1.5s (303→redirect) |

## VERDICT
- Homepage: ⚠️ 262-590ms (variable, target <300ms)
- APIs: ✅ All <600ms
- No hydration errors confirmed
