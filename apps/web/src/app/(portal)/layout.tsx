import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Portal group layout ───────────────────────────────────────────────────────
//
// Provides the full portal chrome (sidebar, header, AI copilot) for ALL portal
// pages. Pages that render their own <PortalLayout> are protected from
// double-wrapping by the nesting guard in PortalLayout.tsx (PortalLayoutContext).
//
// ─────────────────────────────────────────────────────────────────────────────

export default function PortalRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalLayout>{children}</PortalLayout>;
}
