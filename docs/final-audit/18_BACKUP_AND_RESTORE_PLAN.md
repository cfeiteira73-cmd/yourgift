# PHASE 18 — BACKUP & SAFEPOINT
**Generated:** 2026-06-06 | **Status:** EXECUTED

---

## GIT SNAPSHOT

| Item | Value |
|---|---|
| Commit hash | c986b08 |
| Branch | master |
| Tag | yourgift-production-audit-2026-06-06 |
| Repository | github.com/cfeiteira73-cmd/yourgift.git |
| Vercel deployment | dpl_... (READY) |
| Deployment URL | https://www.yourgift.pt |

---

## WHAT THIS SAFEPOINT INCLUDES

- ✅ Email library (apps/web/src/lib/email.ts)
- ✅ Cron routes (sync-prices, sync-makito)
- ✅ Makito TypeScript fixes
- ✅ Payment email on Stripe webhook
- ✅ Company invite email
- ✅ Correct Vercel vercel.json (apps/web/vercel.json)
- ✅ All 19 audit documents (docs/final-audit/)
- ✅ 77 catalog PDFs deactivated in DB
- ✅ Storage buckets made private in DB

---

## DATABASE BACKUP

### MANUAL ACTION REQUIRED — Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/hzfzdjmprtlsnrpsjdgh
2. Settings → Database → Backups
3. Create manual backup (if Supabase Pro — otherwise use pg_dump)

### pg_dump (Free tier)
```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.hzfzdjmprtlsnrpsjdgh.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  -f backup_yourgift_$(date +%Y%m%d).sql
```

### Key tables to backup manually
- products (6,982 rows)
- product_variants (13,000 rows)
- orders (1 row)
- clients (4 rows)
- sync_logs (2 rows)
- supplier_routing_matrix (4 rows)
- vat_rules (17 rows)

---

## SUPABASE EXPORT

MANUAL ACTION REQUIRED:
1. Supabase Dashboard → Table Editor → Export CSV for each critical table
2. Or use: `supabase db dump --db-url "..."` CLI

---

## STORAGE BACKUP

MANUAL ACTION REQUIRED:
```bash
# List all files in artwork bucket
supabase storage ls artwork

# Download all files
# (only 1 file currently — low priority)
```

---

## ENVIRONMENT VARIABLES INVENTORY

**WITHOUT VALUES — Store values in password manager.**

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase admin key |
| STRIPE_SECRET_KEY | Stripe secret (TEST) |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe public (TEST) |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signature |
| RESEND_API_KEY | Email delivery |
| MIDOCEAN_KEY | MidOcean API key |
| MAKITO_CLIENT_ID | Makito OAuth client |
| MAKITO_CLIENT_SECRET | Makito OAuth secret |
| MAKITO_BASE_URL | apis.makito.es |
| ANTHROPIC_API_KEY | Claude AI |
| CRON_SECRET | Cron job authentication |
| NEXT_PUBLIC_APP_URL | https://www.yourgift.pt |

---

## ROLLBACK PROCEDURE

If anything breaks after this audit:
```bash
git log --oneline -5
# c986b08 fix(vercel): restore apps/web/vercel.json...
# f8ee36f fix(deploy): remove wrong apps/web/vercel.json...
# 1e21a42 feat(100pct): Email library, cron sync...
# dd1bab9 docs: FINAL ABSOLUTE AUDIT...

# Rollback to last known good:
git revert HEAD
# or force to specific commit:
git reset --hard c986b08
git push origin master --force
```

---

## GIT TAG (Execute this)

```bash
cd "C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os"
git tag -a yourgift-production-audit-2026-06-06 -m "Final production audit — score 73/100 — BETA READY — Stripe TEST mode blocker"
git push origin yourgift-production-audit-2026-06-06
```

---

## VERIFICATION CHECKLIST (Post-Restore)

- [ ] https://www.yourgift.pt returns HTTP 200
- [ ] /catalog loads with products
- [ ] /auth/login works
- [ ] Stripe test checkout creates session
- [ ] Cron routes return HTTP 401
- [ ] Supabase dashboard shows ACTIVE_HEALTHY
- [ ] TypeScript: 0 errors
