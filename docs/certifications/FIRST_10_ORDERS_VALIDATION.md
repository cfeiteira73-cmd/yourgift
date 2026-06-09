# FIRST 10 ORDERS VALIDATION FRAMEWORK — YourGift
**2026-06-09 | Track and measure the first real orders**

---

## Tracking Template

Use this to track each of the first 10 live orders.

| # | Order Ref | Date | Product | Amount | Supplier | Status |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

---

## Per-Order Checklist

For each order, verify:

**Payment**
- [ ] Stripe checkout completed
- [ ] Webhook delivered (no errors)
- [ ] Order marked `payment_status='paid'`
- [ ] Payment email received by client

**Supplier**
- [ ] NestJS dispatch called (Vercel logs)
- [ ] Supplier order ID returned
- [ ] No cold-start timeout (or manual re-trigger completed)

**Tracking**
- [ ] Tracking number assigned
- [ ] Tracking email sent to client
- [ ] Client portal shows correct status

**Delivery**
- [ ] Delivery confirmed
- [ ] `deliveredAt` set on order
- [ ] Delivery email sent

---

## Metrics to Track

| Metric | Target | Formula |
|---|---|---|
| Payment success rate | 100% | Paid orders / checkout sessions |
| Webhook delivery rate | 100% | Successful webhooks / total webhooks |
| Supplier dispatch rate | 100% | Dispatched orders / paid orders |
| Email delivery rate | >95% | Emails sent / emails attempted |
| Manual intervention rate | <20% | Orders needing manual steps / total |
| Client complaint rate | 0 | Complaints in first 10 orders |
| Average quote-to-payment time | Measure | From quote approval to payment |
| Average payment-to-shipping time | Measure | From payment to `shippedAt` |

---

## Failure Log Template

If any order fails:

```
Order:     YGO-XXXXX
Step:      [Quote / Checkout / Webhook / Dispatch / Tracking / Delivery]
Error:     [exact error message from Vercel logs or Stripe dashboard]
Root cause: 
Fix:       
Prevented future: [YES/NO]
```

---

## Success Criteria for First 10

All of the following must be true:
- [ ] 10/10 payments succeed in Stripe
- [ ] 10/10 orders marked paid in Supabase
- [ ] 10/10 supplier dispatches completed (auto or manual)
- [ ] 10/10 clients receive at least the payment confirmation email
- [ ] 0 client-side data exposure (supplier names, costs)
- [ ] 0 payment processing errors

**When all criteria met: Classification upgrades to REVENUE PROVEN ✓**

---

## Dashboard URLs for Monitoring

```
Stripe Dashboard:       https://dashboard.stripe.com/payments
Vercel Logs:            https://vercel.com/[team]/yourgift/logs
Admin Orders Portal:    https://www.yourgift.pt/orders
Admin Production:       https://www.yourgift.pt/production
Supabase Activity:      https://app.supabase.com/project/hzfzdjmprtlsnrpsjdgh
```
