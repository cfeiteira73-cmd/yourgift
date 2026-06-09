# STRIPE LIVE — EXTERNAL BLOCKER DOCUMENTATION
**YourGift | 2026-06-09**

---

## Status

```
STRIPE: TEST MODE ⛔
Revenue: $0 possible
Time to fix: ~30 minutes
Owner: Carlos (external action — no code required)
```

---

## Exact Manual Actions (in order)

### Step 1 — Add Stripe Secret Key
```
Vercel Dashboard → yourgift project → Settings → Environment Variables
Name:  STRIPE_SECRET_KEY
Value: [your live secret key from Stripe dashboard]
Environments: Production ✓  Preview □  Development □
```
> Get from: dashboard.stripe.com → Developers → API Keys → Secret key (Live)

---

### Step 2 — Add Stripe Publishable Key
```
Vercel Dashboard → yourgift project → Settings → Environment Variables
Name:  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
Value: [your live publishable key from Stripe dashboard]
Environments: Production ✓  Preview □  Development □
```
> Get from: dashboard.stripe.com → Developers → API Keys → Publishable key (Live)

---

### Step 3 — Create Live Webhook Endpoint
```
Stripe Dashboard → Developers → Webhooks → Add endpoint

Endpoint URL: https://www.yourgift.pt/api/webhooks/stripe
Events to listen to:
  ✓ checkout.session.completed
  ✓ payment_intent.succeeded
  ✓ payment_intent.payment_failed
  ✓ charge.dispute.created
```

---

### Step 4 — Add Webhook Signing Secret
```
After creating the webhook, Stripe shows the signing secret:
  [signing secret shown by Stripe after creating webhook]

Vercel Dashboard → yourgift project → Settings → Environment Variables
Name:  STRIPE_WEBHOOK_SECRET
Value: [whsec_... signing secret shown after creating webhook]
Environments: Production ✓  Preview □  Development □
```

---

### Step 5 — Redeploy
```
Vercel Dashboard → yourgift project → Deployments → Redeploy latest
OR: push any commit to master → auto-deploy triggers
```

---

### Step 6 — Execute First Real Payment
```
Go to: https://www.yourgift.pt/catalog/produtos
Select any product → click "Pedir Orçamento"
Create client account → submit quote
Admin portal → approve quote → send to client
Client portal → approve quote → proceed to checkout
Enter real card details
Complete payment
```
> Expected: Stripe checkout completes → webhook fires → order created → email sent

---

### Step 7 — Confirm Webhook Delivery
```
Stripe Dashboard → Developers → Webhooks → your endpoint
Check: checkout.session.completed → Status: Succeeded
```
> If failed: check Vercel runtime logs for webhook errors

---

### Step 8 — Confirm Order Creation
```
YourGift Admin Portal → /orders
Should show: new order with status "Confirmed" and Stripe session ID
```

---

### Step 9 — Confirm Supplier Routing
```
YourGift Admin Portal → /production
Should show: supplier routing triggered (Makito or MidOcean)
NestJS API: check Render logs for supplier order request
```

---

## Do Not Mark Revenue Ready Until

- [ ] Real payment of €1+ completed
- [ ] Webhook confirmed delivered (not just sent)
- [ ] Order appears in /orders with status Confirmed
- [ ] Confirmation email received by test client
- [ ] Supplier routing logged in production panel

---

## Current Webhook Code (already deployed)

```typescript
// src/app/api/webhooks/stripe/route.ts
// Signature verification: ✓ stripe.webhooks.constructEvent()
// checkout.session.completed → creates order → sends email
// Already deployed at: https://www.yourgift.pt/api/webhooks/stripe
```

No code changes required. Only Vercel env vars + Stripe dashboard setup.

---

## Estimated Time

| Action | Time |
|---|---|
| Steps 1-2 (Vercel env vars) | 5 min |
| Steps 3-4 (Stripe webhook) | 10 min |
| Step 5 (redeploy) | 3 min |
| Steps 6-9 (test payment) | 15 min |
| **Total** | **~30 min** |

---

## After Completion

Classification upgrades from:
```
INTERNAL 90+ CERTIFIED
```
to:
```
REVENUE READY ✓
```

---

*This is the only remaining external blocker.*
*All infrastructure, webhooks, emails, and supplier routing are deployed and ready.*
*yourgift.pt | 2026-06-09*
