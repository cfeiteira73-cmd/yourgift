# UX GAPS REPORT
**YourGift OS — Apple-Grade UX Analysis**
**Generated:** 2026-05-28

---

## UX Quality Standards

| Standard | Metric | Current | Target |
|---|---|---|---|
| Animation smoothness | FPS | 60fps ✅ | 60fps |
| Loading feedback | Skeleton presence | 95% ✅ | 100% |
| Error states | User-facing messages | 85% ✅ | 100% |
| Empty states | Custom vs generic | 60% ⚠️ | 100% |
| Mobile optimization | Responsive pages | 80% ⚠️ | 100% |
| Keyboard navigation | Cmd+K + tab | Partial ⚠️ | Full |
| Touch targets | ≥44px | 90% ✅ | 100% |
| Color contrast | WCAG AA | 92% ✅ | 100% |

---

## UX GAP 1: Generic Empty States (MEDIUM)

**Standard:** Figma/Linear level — every empty state has context, illustration, and a clear CTA.
**Current:** Most portal pages show emoji + generic text when data is empty.
**Affected pages:**
- `/billing` — "Sem faturas nesta categoria" (OK, contextual)
- `/production` — no styled empty state
- `/suppliers` — no styled empty state
- `/clients` — no styled empty state

**Fix:** Add consistent `EmptyState` component with icon, title, description, optional CTA button.

---

## UX GAP 2: No Page-Level Transitions (MEDIUM)

**Standard:** Linear — silky page transitions with spring physics.
**Current:** Pages load with initial animation but no inter-page transition.
**Missing:** `AnimatePresence` at the layout level for route transitions.
**Fix:** Add page transition wrapper in `(portal)/layout.tsx`.

---

## UX GAP 3: No Keyboard Shortcut Map (LOW)

**Standard:** Every power user app has a keyboard shortcut reference.
**Current:** Cmd+K opens command palette. No other documented shortcuts.
**Missing:** `?` to open keyboard shortcut overlay.
**Fix:** Add keyboard shortcut modal triggered by `?` key.

---

## UX GAP 4: Sidebar Doesn't Collapse on Mobile (HIGH)

**Standard:** Apple — sidebar auto-dismisses after navigation on mobile.
**Current:** No mobile sidebar dismiss behavior implemented.
**Affected:** All 57 portal pages on mobile.
**Fix:** Add `useEffect` listening to `pathname` changes to close sidebar on mobile.

---

## UX GAP 5: No Skeleton on First Load for Cockpit/Financials (MEDIUM)

**Current:** Some pages flash blank content before data arrives.
**Affected:** `cockpit/page.tsx`, `financials/page.tsx` during initial mount.
**Fix:** Add `loading` state UI that shows skeleton IMMEDIATELY before any fetch starts.

---

## UX GAP 6: Date Formatting Inconsistency (LOW)

**Standard:** Consistent date format across entire app.
**Current:** Some pages use `dd/MM/yyyy`, others use `2 Jun 2024`, others ISO.
**Fix:** Create shared `fmtDate(iso, format?)` utility in `lib/utils.ts`.

---

## UX GAP 7: No Toast on Successful Operations (MEDIUM)

**Standard:** Every mutation gives immediate visual confirmation.
**Current:** ToastContainer exists but not wired to all mutation flows.
**Missing:** Success toasts on: quote submitted, order created, artwork uploaded, settings saved.
**Fix:** Connect mutation handlers to `useToast()` hook across portal forms.

---

## UX GAP 8: No Focus Management After Modal Close (LOW)

**Standard:** WCAG 2.1 — focus returns to trigger element after modal closes.
**Current:** Modals close without returning focus.
**Fix:** Use `useRef` to store and restore focus in modal components.

---

## UX GAP 9: Chart/Graph Absence in Financial Pages (MEDIUM)

**Standard:** Stripe — every financial page has at least one visual.
**Current:** `financials/page.tsx` and `billing/page.tsx` are text-only tables.
**Missing:** Revenue sparkline, monthly trend chart.
**Fix:** Add lightweight SVG sparkline (no external chart lib needed).

---

## UX GAP 10: No Confirmation Dialog for Destructive Actions (HIGH)

**Standard:** No destructive action without explicit confirmation.
**Current:** Cancel order, delete webhook, archive client — no confirmation dialogs.
**Risk:** Accidental data loss.
**Fix:** Add confirmation dialog pattern (reusable `ConfirmDialog` component).

---

## UX GAP 11: Copy-to-Clipboard on Invoice Refs (LOW)

**Standard:** Every reference number has a copy button.
**Current:** Invoice refs and order refs are read-only text.
**Fix:** Add click-to-copy with tooltip feedback on all reference fields.

---

## UX GAP 12: No Bulk Operations on Tables (MEDIUM)

**Standard:** Shopify — select multiple, apply action.
**Current:** Each table row has individual actions only.
**Missing:** Multi-select + bulk status change on orders, quotes, clients.
**Fix:** Add checkbox column + bulk action bar (floating bottom panel).

---

## Apple-Grade UX Checklist

### Implemented ✅
- [x] Spring physics animations (Framer Motion presets)
- [x] GPU-accelerated cards (translateZ(0))
- [x] Shimmer skeletons on loading
- [x] Command palette (Cmd+K)
- [x] Toast notifications
- [x] Realtime indicator
- [x] Mobile command center page (/mobile)
- [x] Touch event handling (pull-to-refresh)
- [x] Backdrop blur glassmorphism

### Missing ❌
- [ ] Inter-page transitions
- [ ] Sidebar auto-close on mobile nav
- [ ] Keyboard shortcut overlay (?)
- [ ] Confirmation dialogs for destructive actions
- [ ] Revenue sparklines on financial pages
- [ ] Bulk table operations
- [ ] Click-to-copy on reference fields
- [ ] Consistent empty state component
- [ ] Success toasts on all mutations

---

## Priority Order

**P0 (safety/correctness):**
1. Confirmation dialogs for destructive actions

**P1 (user experience):**
2. Sidebar auto-close on mobile
3. Success toasts on mutations
4. Revenue sparklines on billing/financials

**P2 (delight):**
5. Inter-page transitions
6. Click-to-copy on refs
7. Keyboard shortcut overlay
8. Consistent empty state component

---

*Generated by OMEGA WORLDCLASS Phase 1 | 2026-05-28*
