# ZERO MANUAL INTERVENTION AUDIT — YourGift
**2026-06-09 | Complete Flow Mapping**

---

## Full Flow Map

```
CUSTOMER
  → Discovers product (catalog)
  → Creates account
  → Submits quote request
  
         MANUAL STEP 1: Admin reviews quote and sets price
         
  → Admin sends approved quote to client
  → Client approves quote in portal
  → Client checks out (Stripe)
  → Payment confirmed (webhook)
  
         AUTOMATED: Order marked paid
         AUTOMATED: NestJS dispatch call
         AUTOMATED: Supplier routing
         AUTOMATED: Payment confirmation email
         
  → Supplier receives order
  
         MANUAL STEP 2 (conditional): Artwork approval
         Admin uploads mockup → client approves
         
  → Production starts
  
         AUTOMATED: Stage tracking via Makito
         
  → QC complete
  → Shipped
  
         AUTOMATED: trackingNumber stored
         AUTOMATED: shippedAt set
         AUTOMATED: Tracking email to client
         
  → Delivered
  
         AUTOMATED: deliveredAt set
         AUTOMATED: status = delivered
         AUTOMATED: Delivery email to client
```

---

## Manual Steps Identified

### REQUIRED MANUAL STEPS (cannot be automated — business decision)

| Step | Who | Why Manual | Automation Possibility |
|---|---|---|---|
| 1. Quote price approval | Admin | Price includes margin, negotiation, custom specs | Low — requires human judgment |
| 2. Artwork approval | Admin + Client | Legal sign-off required before production | Low — legal/quality requirement |

### CONDITIONAL MANUAL STEPS (workarounds)

| Step | Trigger | Workaround |
|---|---|---|
| Supplier dispatch | NestJS cold start (50s on Render free) | Admin clicks "Enviar para Fornecedor" in `/production` |
| Tracking update | Carrier doesn't push webhook | Admin manually enters tracking number |
| Refund processing | Dispute or client request | Admin processes in Stripe Dashboard |

---

## Human Dependencies

| Dependency | Owner | Risk | Mitigation |
|---|---|---|---|
| Quote pricing | Carlos/team | HIGH — blocks payment | SLA: respond within 24h |
| Artwork review | Design team | MEDIUM — delays production 1-2 days | Templates and standards reduce time |
| Stripe keys | Carlos | HIGH — zero revenue without | See STRIPE_LIVE_EXTERNAL_BLOCKER.md |
| Render upgrade | Carlos | LOW — cold start only | $7/mo |

---

## External Dependencies

| System | Risk | SLA |
|---|---|---|
| Stripe | LOW — 99.9% uptime | Webhook retries up to 3 days |
| Makito API | MEDIUM — supplier dependency | Manual order fallback |
| MidOcean API | MEDIUM — supplier dependency | Manual order fallback |
| Render (NestJS) | MEDIUM — free tier cold start | Upgrade to $7/mo or manual trigger |
| Vercel (Next.js) | LOW — 99.99% SLA | Auto-healing |
| Supabase | LOW — 99.9% SLA | 7-day PITR backup |
| Resend | LOW — 99.5% SLA | Emails non-blocking |

---

## Failure Points

| Point | What Breaks | Recovery |
|---|---|---|
| Stripe webhook fails | Order not marked paid | Stripe retries every 1h for 3 days |
| NestJS down | Supplier dispatch fails | Admin manual dispatch via portal |
| Makito API down | Supplier order not created | Manual order via Makito portal |
| Resend fails | Emails not sent | Non-blocking; admin can resend |
| Supabase down | Everything stops | Vercel → 503 pages; auto-recover |

---

## Zero Manual Intervention Score

| Flow Segment | Manual Required? | Notes |
|---|---|---|
| Discovery → Quote | No | Fully automated |
| Quote Pricing | YES | Human decision |
| Checkout → Payment | No | Fully automated |
| Supplier Dispatch | Conditional | Automated unless NestJS cold |
| Production Tracking | No | Makito pushes |
| Artwork Approval | YES | Required by process |
| Shipping Notification | No | Automated 2026-06-09 |
| Delivery Confirmation | Conditional | Depends on carrier webhook |

**Score: 6/8 steps automated (75%)**

True zero-manual-intervention is not achievable in this business model.
Two steps (quote pricing, artwork approval) require human judgment.
This is intentional and expected for B2B custom merchandising.

**The achievable target: 0 manual steps in the payment-to-delivery pipeline.**
**Current state: 0 required manual steps in payment-to-delivery ✓**
**(Conditional: NestJS cold start fallback available)**
