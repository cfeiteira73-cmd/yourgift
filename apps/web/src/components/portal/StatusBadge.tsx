'use client';

export type OrderStatus =
  | 'created'
  | 'paid'
  | 'approved'
  | 'producing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  // legacy keys from existing DB
  | 'pending'
  | 'confirmed'
  | 'in_production'
  | 'payment_confirmed';

export type QuoteStatus =
  | 'draft'
  | 'submitted'
  | 'pricing'
  | 'approved'
  | 'rejected'
  | 'converted';

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const ORDER_STATUS_MAP: Record<string, StatusConfig> = {
  created:           { label: 'Criada',       bg: 'rgba(107,114,128,0.12)', text: 'rgb(156,163,175)',   border: 'rgba(107,114,128,0.2)',  dot: '#9ca3af' },
  pending:           { label: 'Pendente',      bg: 'rgba(107,114,128,0.12)', text: 'rgb(156,163,175)',   border: 'rgba(107,114,128,0.2)',  dot: '#9ca3af' },
  paid:              { label: 'Pago',          bg: 'rgba(77,163,255,0.12)',  text: 'rgb(77,163,255)',    border: 'rgba(77,163,255,0.22)',  dot: '#4da3ff' },
  confirmed:         { label: 'Confirmado',    bg: 'rgba(77,163,255,0.12)',  text: 'rgb(77,163,255)',    border: 'rgba(77,163,255,0.22)',  dot: '#4da3ff' },
  payment_confirmed: { label: 'Pago',          bg: 'rgba(77,163,255,0.12)',  text: 'rgb(77,163,255)',    border: 'rgba(77,163,255,0.22)',  dot: '#4da3ff' },
  approved:          { label: 'Aprovada',      bg: 'rgba(167,139,250,0.12)', text: 'rgb(167,139,250)',   border: 'rgba(167,139,250,0.22)', dot: '#a78bfa' },
  producing:         { label: 'Em Produção',   bg: 'rgba(245,158,11,0.12)',  text: 'rgb(245,158,11)',    border: 'rgba(245,158,11,0.22)',  dot: '#f59e0b' },
  in_production:     { label: 'Em Produção',   bg: 'rgba(245,158,11,0.12)',  text: 'rgb(245,158,11)',    border: 'rgba(245,158,11,0.22)',  dot: '#f59e0b' },
  shipped:           { label: 'Enviada',       bg: 'rgba(116,231,255,0.12)', text: 'rgb(116,231,255)',   border: 'rgba(116,231,255,0.2)',  dot: '#74e7ff' },
  delivered:         { label: 'Entregue',      bg: 'rgba(99,230,190,0.12)',  text: 'rgb(99,230,190)',    border: 'rgba(99,230,190,0.2)',   dot: '#63e6be' },
  cancelled:         { label: 'Cancelada',     bg: 'rgba(239,68,68,0.12)',   text: 'rgb(239,68,68)',     border: 'rgba(239,68,68,0.2)',    dot: '#ef4444' },
};

export const QUOTE_STATUS_MAP: Record<string, StatusConfig> = {
  draft:     { label: 'Rascunho',    bg: 'rgba(107,114,128,0.12)', text: 'rgb(156,163,175)',  border: 'rgba(107,114,128,0.2)',  dot: '#9ca3af' },
  submitted: { label: 'Submetido',   bg: 'rgba(77,163,255,0.12)',  text: 'rgb(77,163,255)',   border: 'rgba(77,163,255,0.22)', dot: '#4da3ff' },
  pricing:   { label: 'A calcular',  bg: 'rgba(245,158,11,0.12)',  text: 'rgb(245,158,11)',   border: 'rgba(245,158,11,0.22)', dot: '#f59e0b' },
  approved:  { label: 'Aprovado',    bg: 'rgba(99,230,190,0.12)',  text: 'rgb(99,230,190)',   border: 'rgba(99,230,190,0.2)',  dot: '#63e6be' },
  rejected:  { label: 'Rejeitado',   bg: 'rgba(239,68,68,0.12)',   text: 'rgb(239,68,68)',    border: 'rgba(239,68,68,0.2)',   dot: '#ef4444' },
  converted: { label: 'Convertido',  bg: 'rgba(116,231,255,0.12)', text: 'rgb(116,231,255)',  border: 'rgba(116,231,255,0.2)', dot: '#74e7ff' },
};

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'quote';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, type = 'order', size = 'md' }: StatusBadgeProps) {
  const map = type === 'quote' ? QUOTE_STATUS_MAP : ORDER_STATUS_MAP;
  const cfg = map[status] ?? {
    label: status,
    bg: 'rgba(107,114,128,0.12)',
    text: 'rgb(156,163,175)',
    border: 'rgba(107,114,128,0.2)',
    dot: '#9ca3af',
  };

  const padding = size === 'sm' ? '0.2rem 0.55rem' : '0.25rem 0.75rem';
  const fontSize = size === 'sm' ? '0.7rem' : '0.75rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: size === 'sm' ? '5px' : '6px',
          height: size === 'sm' ? '5px' : '6px',
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
