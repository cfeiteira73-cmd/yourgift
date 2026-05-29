'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

// ── EmptyState ─────────────────────────────────────────────────────────────────
//
// Apple-grade empty state: consistent icon, title, description, optional CTA.
// Replaces ad-hoc "emoji + text" patterns across the portal.
//
// Usage:
//   <EmptyState
//     icon="📦"
//     title="Sem encomendas"
//     description="As tuas encomendas aparecem aqui quando criares a primeira."
//     cta={{ label: 'Criar encomenda', href: '/quotes/new' }}
//   />
//
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  cta,
  size = 'md',
  className,
}: EmptyStateProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const iconBg = size === 'sm' ? 48 : size === 'lg' ? 72 : 60;
  const titleSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  const descSize = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  const py = size === 'sm' ? 24 : size === 'lg' ? 56 : 40;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${py}px 24px`,
        textAlign: 'center',
      }}
    >
      {/* Icon container */}
      <div style={{
        width: iconBg,
        height: iconBg,
        borderRadius: Math.round(iconBg * 0.28),
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        fontSize: iconSize,
      }}>
        {icon}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: titleSize,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.7)',
        margin: '0 0 8px',
        lineHeight: 1.4,
      }}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p style={{
          fontSize: descSize,
          color: 'rgba(255,255,255,0.35)',
          margin: '0 0 20px',
          lineHeight: 1.6,
          maxWidth: 320,
        }}>
          {description}
        </p>
      )}

      {/* CTA */}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(77,163,255,0.12)',
              color: 'rgb(77,163,255)',
              border: '1px solid rgba(77,163,255,0.2)',
              textDecoration: 'none',
              transition: 'all 150ms',
            }}
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(77,163,255,0.12)',
              color: 'rgb(77,163,255)',
              border: '1px solid rgba(77,163,255,0.2)',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {cta.label}
          </button>
        )
      )}
    </motion.div>
  );
}
