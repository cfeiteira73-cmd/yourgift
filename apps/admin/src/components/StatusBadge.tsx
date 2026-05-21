'use client';

export type OrderStatus =
  | 'created'
  | 'paid'
  | 'approved'
  | 'producing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'pending'
  | 'payment_confirmed'
  | 'in_production';

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  created: {
    label: 'Criado',
    bg: 'bg-[#1a2030]',
    text: 'text-[#8ba8c7]',
    dot: 'bg-[#4d6a87]',
  },
  pending: {
    label: 'Pendente',
    bg: 'bg-[#1a2030]',
    text: 'text-[#8ba8c7]',
    dot: 'bg-[#4d6a87]',
  },
  paid: {
    label: 'Pago',
    bg: 'bg-[#0d1f3a]',
    text: 'text-[#4da3ff]',
    dot: 'bg-[#4da3ff]',
  },
  payment_confirmed: {
    label: 'Pago',
    bg: 'bg-[#0d1f3a]',
    text: 'text-[#4da3ff]',
    dot: 'bg-[#4da3ff]',
  },
  approved: {
    label: 'Aprovado',
    bg: 'bg-[#1a0f3a]',
    text: 'text-[#a78bfa]',
    dot: 'bg-[#a78bfa]',
  },
  producing: {
    label: 'Em Produção',
    bg: 'bg-[#2a1f00]',
    text: 'text-[#f59e0b]',
    dot: 'bg-[#f59e0b]',
  },
  in_production: {
    label: 'Em Produção',
    bg: 'bg-[#2a1f00]',
    text: 'text-[#f59e0b]',
    dot: 'bg-[#f59e0b]',
  },
  shipped: {
    label: 'Enviado',
    bg: 'bg-[#062030]',
    text: 'text-[#74e7ff]',
    dot: 'bg-[#74e7ff]',
  },
  delivered: {
    label: 'Entregue',
    bg: 'bg-[#062515]',
    text: 'text-[#63e6be]',
    dot: 'bg-[#63e6be]',
  },
  cancelled: {
    label: 'Cancelado',
    bg: 'bg-[#2a0a0a]',
    text: 'text-[#f87171]',
    dot: 'bg-[#f87171]',
  },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-[#1a2030]',
    text: 'text-[#8ba8c7]',
    dot: 'bg-[#4d6a87]',
  };

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${cfg.bg} ${cfg.text} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
