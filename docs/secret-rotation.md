# YourGift OS — Secret Rotation Runbook

> **Rule**: rotate proactively on schedule. Rotate immediately if a secret is exposed or suspected compromised.
> Never commit secrets to git. All secrets live in Render Dashboard environment variables.

---

## Rotation Schedule

| Secret | Rotate every | Emergency rotation |
|---|---|---|
| `JWT_SECRET` | 90 days | Immediately if leaked (all sessions expire) |
| `RESEND_API_KEY` | 90 days | Immediately if leaked |
| `STRIPE_WEBHOOK_SECRET` | On demand | Regenerate in Stripe Dashboard → Webhooks |
| `STRIPE_KEY` | On demand | Stripe Support required |
| `SUPABASE_SERVICE_ROLE_KEY` | 180 days | Supabase Dashboard → Settings → API |
| `UPSTASH_REDIS_URL` (token) | 90 days | Upstash Console → Database → Reset token |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | 90 days | IAM → programmatic rotation (see below) |
| `MIDOCEAN_KEY` | Per Midocean policy | Midocean Developer Portal |
| `GOOGLE_CLIENT_SECRET` | 180 days | Google Cloud Console → Credentials |
| `BETTERSTACK_SOURCE_TOKEN` | 180 days | BetterStack → Logs → Sources |
| `SENTRY_DSN` | On demand | sentry.io → Project → Settings → Client Keys |

---

## 1. JWT_SECRET

> Rotating this key **immediately invalidates all active sessions**. Schedule during low-traffic window.

```bash
# Generate a new secret
openssl rand -hex 32
```

1. Copy the output
2. Render Dashboard → yourgift-api → Environment → `JWT_SECRET` → update value
3. Trigger redeploy: Render Dashboard → Manual Deploy  
4. All users will be logged out and must log in again
5. Update `.env.example` comment date

---

## 2. RESEND_API_KEY

1. resend.com → API Keys → **Create API Key** (Full Access, no domain restriction)
2. Copy the new key
3. Render Dashboard → yourgift-api → Environment → `RESEND_API_KEY` → update
4. Trigger redeploy
5. Go back to resend.com → API Keys → revoke the old key

---

## 3. STRIPE_WEBHOOK_SECRET

The webhook secret is tied to the webhook endpoint — regenerating it does **not** break existing events.

1. Stripe Dashboard → Developers → Webhooks → your endpoint → **Reveal signing secret**
2. Click **Roll secret**
3. Copy new value → Render Dashboard → `STRIPE_WEBHOOK_SECRET` → update
4. Trigger redeploy (no traffic interruption)

---

## 4. STRIPE_KEY (secret key)

> Only rotate if you suspect compromise. Requires Stripe Support to deactivate old key.

1. Stripe Dashboard → Developers → API Keys → **Create restricted key** or roll existing
2. Update Render env var `STRIPE_KEY`
3. Contact Stripe Support to revoke the old key immediately
4. Monitor for failed charges in the first 30 minutes

---

## 5. SUPABASE_SERVICE_ROLE_KEY

1. Supabase Dashboard → Project → Settings → API → **Regenerate service role key**
2. Copy new value → Render Dashboard → `SUPABASE_SERVICE_ROLE_KEY` → update
3. Trigger redeploy
4. Verify health endpoint: `GET /api/v1/health`

---

## 6. UPSTASH_REDIS_URL (token rotation)

1. Upstash Console → your Redis database → **Reset Password / Token**
2. Copy the new connection string (format: `rediss://default:TOKEN@host:6379`)
3. Render Dashboard → yourgift-api → `UPSTASH_REDIS_URL` → update
4. Trigger redeploy
5. Verify BullMQ queues resume: Admin → Queue Monitor

---

## 7. AWS IAM Keys (programmatic rotation)

```bash
# 1. Create new access key
aws iam create-access-key --user-name yourgift-s3-user

# 2. Update Render env vars
#    AWS_ACCESS_KEY_ID  → new key
#    AWS_SECRET_ACCESS_KEY → new secret

# 3. Trigger redeploy and smoke-test PDF/artwork upload

# 4. Delete the old key
aws iam delete-access-key \
  --user-name yourgift-s3-user \
  --access-key-id OLD_ACCESS_KEY_ID
```

---

## 8. SCIM Bearer Tokens (per tenant)

SCIM tokens are set per-tenant as `SCIM_TOKEN_<TENANT_ID>` in Render.

1. Generate: `openssl rand -hex 32`
2. Update Render env var `SCIM_TOKEN_<TENANT_ID>`
3. Trigger redeploy
4. Update the token in Okta/Azure AD SCIM app config (Bearer token field)
5. Test provisioning by triggering a SCIM sync in the IdP

---

## Post-Rotation Checklist

After rotating any secret:

- [ ] Trigger Render redeploy (API service)
- [ ] Health check: `curl https://yourgift-api.onrender.com/api/v1/health`
- [ ] Check Sentry for new errors (5 minutes post-deploy)
- [ ] Check BetterStack uptime monitor (should stay green)
- [ ] Verify the specific feature that uses the secret (email send, payment, etc.)
- [ ] Update rotation date in your password manager / secrets vault

---

## Emergency Compromised Secret Protocol

1. **Rotate immediately** — do not wait for the scheduled window
2. Audit access logs: Render logs, Sentry, BetterStack Logtail
3. Check for unusual API calls in the last 24–48 hours
4. If `JWT_SECRET` was leaked: all tokens are invalid after rotation (self-healing)
5. If Stripe keys leaked: contact Stripe Support immediately (+351 support number or live chat)
6. Document the incident in your incident log

---

## GitHub Actions Secrets

CI/CD secrets in GitHub are separate from runtime secrets and rarely need rotation:

| Secret | When to rotate |
|---|---|
| `RENDER_API_KEY` | If Render account is compromised |
| `CLOUDFLARE_API_TOKEN` | If Cloudflare account is compromised |

Rotate via: GitHub → Settings → Secrets and variables → Actions → update value.
