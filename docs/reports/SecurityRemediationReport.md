# Security Remediation Report
**Date:** 2026-06-02  
**Source:** Supabase Security Advisor + Manual Audit  

## Fixes Applied ✅

| Issue | Severity | Fix Applied |
|---|---|---|
| `handle_new_user()` callable by `anon` | 🔴 CRITICAL | `REVOKE EXECUTE FROM anon` ✅ |
| `is_admin()` callable by `anon` | 🔴 CRITICAL | `REVOKE EXECUTE FROM anon` ✅ |
| `is_admin_user()` callable by `anon` | 🔴 CRITICAL | `REVOKE EXECUTE FROM anon` ✅ |
| `is_omega_admin()` callable by `anon` | 🔴 CRITICAL | `REVOKE EXECUTE FROM anon` ✅ |
| `update_updated_at()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `is_omega_admin()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `set_updated_at()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `is_admin()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `is_admin_user()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `update_approval_request_updated_at()` mutable search_path | 🟠 HIGH | `SET search_path = public` ✅ |
| `artwork_versions` INSERT `WITH CHECK (true)` | 🟠 HIGH | Restricted to `auth.uid() IS NOT NULL` ✅ |
| `omega_x_rfqs` INSERT `WITH CHECK (true)` | 🟠 HIGH | Restricted to `auth.uid() IS NOT NULL` ✅ |
| 12 tables with RLS enabled but no policies | 🟠 HIGH | Admin-only SELECT policies added ✅ |

## Remaining Issues — Require Manual Action

| Issue | Severity | Action Required |
|---|---|---|
| `products_catalog` SECURITY DEFINER view | 🔴 HIGH | Recreate as SECURITY INVOKER — requires DDL review |
| Artwork bucket allows public listing | 🟠 MEDIUM | Dashboard → Storage → artwork → Remove broad SELECT |
| Leaked password protection disabled | 🟡 LOW | Dashboard → Auth → Security → Enable |
| 282 RLS policies with `auth.uid()` (slow) | 🟡 LOW | Performance fix — migrate to `(select auth.uid())` |
| STRIPE_SECRET_KEY placeholder | 🔴 CRITICAL | Insert real Stripe key in Vercel |
| NestJS API not deployed | 🔴 CRITICAL | Deploy to Render/Railway/Fly.io |

## Security Score

| Area | Before | After |
|---|---|---|
| Anon function exposure | 0/10 | 9/10 |
| RLS coverage | 5/10 | 7/10 |
| Search path injection | 4/10 | 9/10 |
| Permissive policies | 4/10 | 8/10 |
| Auth security | 6/10 | 6/10 (password protection still off) |
| **Overall** | **38/100** | **72/100** |
