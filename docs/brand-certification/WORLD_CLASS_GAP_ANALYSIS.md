# WORLD-CLASS BRAND GAP ANALYSIS — YourGift
**Gap between Current YourGift and World-Class Premium Brand**

---

## CRITICAL Gaps

| Gap | Evidence | Impact | Fix Effort |
|---|---|---|---|
| Auth emails not branded | Supabase default templates | HIGH — first impression | 4h — custom templates |
| No PDF quote/invoice | Documents not generated | HIGH — B2B expectation | 8h — react-pdf |
| No cookie consent banner | GDPR requirement | LEGAL | 2h — cookie-consent lib |

## HIGH Priority Gaps

| Gap | Evidence | Impact | Fix Effort |
|---|---|---|---|
| Quote approval flow | Uses `mailto:` link | Trust drop | 4h — proper modal/API |
| No order tracking URL | Clients can't track shipping | Anxiety | 2h — add tracking field |
| No email notification on quote approval | Clients wait | Frustration | 3h — Resend trigger |
| Product images quality varies | Some Makito images are thumbnails | Premium perception | 1h — min size filter |
| No 404 page for marketing routes | /privacy-policy, /terms are 404 | Trust drop | 2h — create stubs |

## MEDIUM Priority Gaps

| Gap | Evidence | Impact | Fix Effort |
|---|---|---|---|
| FAQ not in main navigation | Hidden in footer | Discoverability | 30min |
| Blog is static/dummy content | Placeholder articles | Credibility | Ongoing |
| No WhatsApp in nav on desktop | Only float button | Accessibility | 30min |
| No live chat (only WhatsApp) | Not integrated | Premium expectation | 4h — Crisp/Intercom |
| Hero video subtitle/captions | Video has captions but unused | Accessibility | 1h |

## LOW Priority Gaps

| Gap | Evidence | Impact | Fix Effort |
|---|---|---|---|
| No PWA manifest | No "Add to Home Screen" | Mobile engagement | 2h |
| No Lighthouse score optimization | Build serves unoptimized fonts | Performance | 4h |
| No social meta images (OG) | Generic title only | Social sharing | 2h |
| No structured data (FAQ schema) | Missing from FAQ page | SEO | 1h |

---

## Summary
- **Critical:** 3 gaps
- **High:** 5 gaps  
- **Medium:** 5 gaps
- **Low:** 4 gaps

**To reach 95+/100:** Address all Critical + High gaps (~31h total effort)
