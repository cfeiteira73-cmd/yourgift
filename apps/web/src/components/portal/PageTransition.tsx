'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { pageVariants, springGentle } from '@/lib/motion';

// ── PageTransition ─────────────────────────────────────────────────────────────
//
// Apple/Linear-grade page-level transition wrapper.
// Wraps page content in AnimatePresence + motion.div for cinematic route changes.
//
// Usage — wrap your page's root content (not inside PortalLayout):
//
//   export default function MyPage() {
//     return (
//       <PageTransition>
//         <div>... page content ...</div>
//       </PageTransition>
//     );
//   }
//
// Or use the pre-built PageShell which includes the PortalLayout wrapper:
//
//   export default function MyPage() {
//     return (
//       <PageShell title="My Page">
//         ... content ...
//       </PageShell>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

interface PageTransitionProps {
  children: React.ReactNode;
  /** Delay before entrance animation starts (seconds) */
  delay?: number;
  /** Vertical distance of entrance slide (px) */
  distance?: number;
  /** Custom className on the wrapper div */
  className?: string;
  style?: React.CSSProperties;
}

export function PageTransition({
  children,
  delay = 0,
  distance = 12,
  className,
  style,
}: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: distance }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{
          ...springGentle,
          delay,
          opacity: { duration: 0.2 },
        }}
        className={className}
        style={{ width: '100%', ...style }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Staggered section entrance ─────────────────────────────────────────────────

interface SectionProps {
  children: React.ReactNode;
  index?: number;
  style?: React.CSSProperties;
  className?: string;
}

/** Fade-up entrance for individual sections within a page */
export function Section({ children, index = 0, style, className }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springGentle, delay: 0.05 + index * 0.07 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ── KPI card with number morph ─────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number; // positive = up, negative = down
  color?: string;
  index?: number;
  onClick?: () => void;
}

export function KPICard({
  label,
  value,
  sub,
  trend,
  color = '#fff',
  index = 0,
  onClick,
}: KPICardProps) {
  const trendColor = trend === undefined ? undefined : trend >= 0 ? 'rgb(99,230,190)' : 'rgb(239,68,68)';

  return (
    <motion.div
      className="yg-card"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springGentle, delay: 0.04 + index * 0.06 }}
      whileHover={{ y: -2, scale: 1.01, transition: { type: 'spring', stiffness: 500, damping: 28 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transform: 'translateZ(0)',
      }}
    >
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <motion.p
          key={String(value)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{ fontSize: 28, fontWeight: 700, color, margin: 0, lineHeight: 1 }}
        >
          {value}
        </motion.p>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</p>
      )}
    </motion.div>
  );
}

// ── Morphing status indicator ──────────────────────────────────────────────────

interface StatusPillProps {
  status: string;
  color: string;
  bg: string;
  pulse?: boolean;
}

export function StatusPill({ status, color, bg, pulse = false }: StatusPillProps) {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 600,
        background: bg, color,
      }}
    >
      {pulse ? (
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
          <motion.span
            animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: color, opacity: 0.5,
            }}
          />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        </span>
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      )}
      {status}
    </motion.span>
  );
}
