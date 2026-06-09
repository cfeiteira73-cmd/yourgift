# FIRST REAL PAYMENT CHECKLIST — YourGift
**Execute this after Stripe live keys are added**

---

## Pre-Flight (5 min)

- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_` (verify in Vercel)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
- [ ] `STRIPE_WEBHOOK_SECRET` starts with `whsec_`
- [ ] Stripe webhook endpoint exists: `https://www.yourgift.pt/api/webhooks/stripe`
- [ ] Webhook subscribes to: `checkout.session.completed`, `payment_intent.*`, `charge.dispute.*`
- [ ] Vercel redeployed after env var changes

---

## Test Customer Setup

```
Name:     YourGift Test
Email:    Use a real email you control (not geral@yourgift.pt)
Company:  Empresa Teste Lda.
```

---

## Test Product

```
Go to: https://www.yourgift.pt/catalog/produtos
Select: Any active product with price > €0
Note the product name and ref for verification
```

---

## Minimum Amount

```
Minimum valid amount: €1.00
Recommended for first test: €1.00 (minimum real charge)
Stripe minimum: €0.50 EUR
Use: The actual product price (do not override)
```

---

## Step-by-Step Execution

### Step 1: Create Quote (Client side)
- [ ] Register test customer account at `/auth/register`
- [ ] Go to `/client-portal/products`
- [ ] Select product → "Pedir Orçamento"
- [ ] Fill: quantity=1, notes="Teste primeiro pagamento"
- [ ] Submit quote
- [ ] **Expected**: Quote appears with ref `YGQ-XXXXX`

### Step 2: Process Quote (Admin side)
- [ ] Login as `geral@yourgift.pt`
- [ ] Go to `/quotes` → find the test quote
- [ ] Click "Aprovar" → Set price (real price from supplier)
- [ ] Send to client
- [ ] **Expected**: Quote status = "Enviado ao Cliente"

### Step 3: Approve Quote (Client side)
- [ ] Login as test customer
- [ ] Go to `/client-portal` → find quote
- [ ] Click "Aprovar Proposta"
- [ ] **Expected**: Order created with ref `YGO-XXXXX`

### Step 4: Checkout (Client side)
- [ ] In client portal, find the order
- [ ] Click "Pagar"
- [ ] **Expected**: Redirect to Stripe checkout (stripe.com)
- [ ] Use Stripe test card: `4242 4242 4242 4242` / exp: any future / CVC: any

> **Note**: On live mode, use a real card. First payment should be €1.
> After test, issue refund immediately via Stripe dashboard.

### Step 5: Verify Payment
After completing Stripe checkout:

- [ ] Browser redirects to `/orders/{id}?payment=success` ✓
- [ ] Order page shows "Pago" status ✓
- [ ] Test customer receives payment confirmation email ✓
- [ ] **Check Stripe Dashboard** → Payments → Confirm payment appears

### Step 6: Verify Webhook
- [ ] Stripe Dashboard → Developers → Webhooks → your endpoint
- [ ] Check: `checkout.session.completed` → Status: **Succeeded**
- [ ] Check: No 5xx errors in webhook delivery log

### Step 7: Verify Order in Portal
- [ ] Admin portal → `/orders`
- [ ] Find order `YGO-XXXXX`
- [ ] Status should be: `Pago` / `paid`
- [ ] `paid_at` timestamp should be set
- [ ] Stripe session ID should be visible

### Step 8: Verify Event Log
- [ ] Admin portal → `/activity`
- [ ] Should show: `payment_confirmed` event for this order
- [ ] Should show: `checkout_session_created` event

### Step 9: Verify Supplier Dispatch
- [ ] Admin portal → `/production`
- [ ] Should show order entering production queue
- [ ] If NestJS had cold start: manually trigger via "Enviar para Fornecedor" button

### Step 10: Verify Email
- [ ] Check test customer inbox
- [ ] Should receive: `Pagamento recebido — YGO-XXXXX | YourGift`
- [ ] Email should match brand (dark, bronze, Montserrat)

---

## Refund After Test

Once confirmed working:
```
Stripe Dashboard → Payments → find the €1 charge → Refund
```

---

## PASS Criteria

| Check | Required |
|---|---|
| Payment completes on Stripe | YES |
| Browser redirects correctly | YES |
| Webhook delivers successfully | YES |
| Order status = paid in portal | YES |
| `paid_at` timestamp set | YES |
| Payment email received | YES |
| Event log entry created | YES |
| No 5xx errors in Vercel logs | YES |

## All 8 checks PASS = REVENUE PROVEN ✓
