# 01 SYSTEM MASTER INVENTORY
**Date:** 2026-06-04 | **Status:** VERIFIED WITH REAL DATA

## INFRASTRUCTURE
| Component | URL | Status | Live |
|---|---|---|---|
| Frontend (Next.js 14) | www.yourgift.pt | ✅ HTTP 200 | YES |
| NestJS API | yourgift-api.onrender.com | ⚠️ FREE TIER SLEEPS | YES |
| GitHub Repo | cfeiteira73-cmd/yourgift | ✅ | YES |
| Vercel Deploy | Auto on push | ✅ | YES |

## FRONTEND PAGES (all tested)
- 17 routes: ALL PASS (200/307/401/405 as expected)
- Marketing: homepage, catalog, about, how-it-works, blog, quote, rfq
- Auth: login, register
- Client portal: dashboard, products, quotes, orders, assets, billing
- Admin portal: 29 pages all accessible

## INTEGRATIONS
| Integration | Status | Latency | Notes |
|---|---|---|---|
| Supabase | ✅ LIVE | <100ms | eu-west-1 |
| MidOcean | ✅ LIVE | 303→200 1.5s | S3 redirect |
| Makito | ✅ LIVE | 880-char token | Auth OK |
| Stripe | ⚠️ TEST | — | charges_enabled=false |
| Resend Email | ✅ LIVE | — | Both domains verified |
| Upstash Redis | ✅ CONFIGURED | — | Rate limiting |
| Anthropic AI | ✅ CONFIGURED | — | Key in Vercel |

## DATABASE
- 229 tables | 267 RLS policies | 0 tables without policy
- 1,993 MidOcean products | 4,573 Makito products | 6,566 total
- 1 paid order (test) | 1 quote | 4 clients | 3 auth users

## WHAT IS UNUSED/ORPHAN
- 176 empty tables (architecture over-engineering, not harmful)
- PF Concept integration (code exists, no keys)
- Printful integration (referenced but not built)

## WHAT MUST NEVER BE TOUCHED
- ADMIN_EMAILS = ['geral@yourgift.pt','geral@agencygroup.pt']
- Stripe webhook secrets
- Supabase service_role key
- Makito credentials
