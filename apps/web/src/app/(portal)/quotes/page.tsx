'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Quote {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  event_date: string | null;
  delivery_date: string | null;
  pricing_snapshot: Record<string, unknown> | null;
}

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  draft:     { label: 'Rascunho',    color: 'rgb(100,112,130)', bg: 'rgba(100,112,130,0.1)', border: 'rgba(100,112,130,0.2)', icon: '✏️' },
  submitted: { label: 'Submetido',   color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: '📤' },
  pricing:   { label: 'A calcular',  color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.1)', border: 'rgba(116,231,255,0.2)', icon: '⚙️' },
  proposed:  { label: 'Proposta',    color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.1)',  border: 'rgba(77,163,255,0.2)',  icon: '📋' },
  approved:  { label: 'Aprovado',    color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)',  border: 'rgba(99,230,190,0.2)',  icon: '✅' },
  rejected:  { label: 'Recusado',    color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   icon: '❌' },
  converted: { label: 'Convertido',  color: 'rgb(167,243,208)', bg: 'rgba(167,243,208,0.1)', border: 'rgba(167,243,208,0.2)', icon: '🎯' },
  expired:   { label: 'Expirado',    color: 'rgb(80,92,110)',   bg: 'rgba(80,92,110,0.1)',   border: 'rgba(80,92,110,0.2)',   icon: '⏰' },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: '6px', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '0.7rem' }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Filter config ─────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',     label: 'Todos' },
  { key: 'open',    label: 'Em aberto',   statuses: ['submitted', 'pricing', 'proposed'] },
  { key: 'pending', label: 'Pendentes',   statuses: ['draft', 'submitted'] },
  { key: 'done',    label: 'Resolvidos',  statuses: ['approved', 'converted', 'rejected', 'expired'] },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

// ── Quote Card ────────────────────────────────────────────────────────────────

function QuoteCard({ quote, index }: { quote: Quote; index: number }) {
  const cfg = STATUS_MAP[quote.status] ?? STATUS_MAP.draft;
  const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);

  const daysAgo = Math.floor((Date.now() - new Date(quote.created_at).getTime()) / 86400000);
  const ageLabel = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo}d`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2 }}
    >
      <Link href={`/quotes/${quote.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px', padding: '1.25rem 1.5rem',
            transition: 'border-color 150ms, background 150ms',
            display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = `${cfg.color}35`;
            (e.currentTarget as HTMLElement).style.background = `linear-gradient(145deg, ${cfg.bg} 0%, rgba(255,255,255,0.015) 100%)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)';
          }}
        >
          {/* Status icon */}
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
          }}>
            {cfg.icon}
          </div>

          {/* Main info */}
          <div style={{ flex: 1, minWidth: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: 'rgb(220,228,238)' }}>
                {quote.ref ?? `QT-${quote.id.slice(0, 8).toUpperCase()}`}
              </span>
              <StatusPill status={quote.status} />
            </div>
            {quote.notes && (
              <p style={{ fontSize: '0.78rem', color: 'rgb(100,112,130)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
                {quote.notes}
              </p>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
            {quote.delivery_date && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Entrega
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(170,180,198)' }}>
                  {new Date(quote.delivery_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(80,92,110)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Submetido
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(100,112,130)' }}>
                {ageLabel}
              </div>
            </div>
          </div>

          {/* Amount + arrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              {quote.total_amount != null && quote.total_amount > 0 ? (
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(99,230,190)', letterSpacing: '-0.02em' }}>
                  {fmt(quote.total_amount)}
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)', fontStyle: 'italic' }}>
                  Sob consulta
                </div>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(80,92,110)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ quotes }: { quotes: Quote[] }) {
  const total = quotes.length;
  const totalValue = quotes.reduce((s, q) => s + (q.total_amount ?? 0), 0);
  const pending = quotes.filter(q => ['submitted', 'pricing'].includes(q.status)).length;
  const approved = quotes.filter(q => ['approved', 'converted'].includes(q.status)).length;
  const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);

  const stats = [
    { label: 'Total', value: String(total), color: 'rgb(170,180,198)' },
    { label: 'Pendentes', value: String(pending), color: 'rgb(245,158,11)' },
    { label: 'Aprovados', value: String(approved), color: 'rgb(99,230,190)' },
    { label: 'Valor total', value: totalValue > 0 ? fmt(totalValue) : '—', color: 'rgb(77,163,255)' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px', padding: '0.875rem 1rem',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(70,82,100)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            {stat.label}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {stat.value}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/quotes'); return; }

      const { data: clientData } = await supabase
        .from('clients').select('id, name, company, tier')
        .eq('auth_user_id', user.id).single();
      setClient(clientData as ClientProfile | null);

      if (!clientData) { setLoading(false); return; }

      const { data } = await supabase
        .from('quotes')
        .select('id, ref, status, total_amount, notes, created_at, event_date, delivery_date, pricing_snapshot')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      setQuotes((data ?? []) as Quote[]);
            } catch (err) {
        console.error("[quotes] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    let list = quotes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => (o.ref ?? '').toLowerCase().includes(q) || (o.notes ?? '').toLowerCase().includes(q));
    }
    const tab = FILTERS.find(f => f.key === filter);
    if (tab && tab.key !== 'all' && 'statuses' in tab) {
      list = list.filter(o => (tab.statuses as readonly string[]).includes(o.status));
    }
    return list;
  }, [quotes, search, filter]);

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <div style={{ padding: '2rem 2rem 4rem', maxWidth: '960px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.25rem' }}>
              Orçamentos
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'rgb(100,112,130)' }}>
              {quotes.length} orçamento{quotes.length !== 1 ? 's' : ''} no total
            </p>
          </div>
          <Link href="/quotes/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgb(77,163,255)', color: 'rgb(7,17,31)',
            padding: '0.625rem 1.125rem', borderRadius: '10px',
            fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
            boxShadow: '0 0 16px rgba(77,163,255,0.25)',
          }}>
            + Novo Orçamento
          </Link>
        </motion.div>

        {/* Summary bar */}
        {!loading && quotes.length > 0 && <SummaryBar quotes={quotes} />}

        {/* Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ position: 'relative', marginBottom: '1rem' }}
        >
          <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(80,92,110)', pointerEvents: 'none' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por referência ou notas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '0.625rem 1rem 0.625rem 2.5rem',
              fontSize: '0.875rem', color: 'rgb(230,237,245)', outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          />
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
        >
          {FILTERS.map((f) => (
            <button type="button"
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '9999px',
                fontSize: '0.8rem', fontWeight: filter === f.key ? 600 : 400,
                cursor: 'pointer', transition: 'all 150ms',
                background: filter === f.key ? 'rgba(77,163,255,0.15)' : 'rgba(255,255,255,0.04)',
                color: filter === f.key ? 'rgb(77,163,255)' : 'rgb(100,112,130)',
                border: filter === f.key ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map((n) => (
              <motion.div
                key={n}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: n * 0.15 }}
                style={{ height: '76px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center', padding: '4rem 2rem',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '18px',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.875rem', opacity: 0.5 }}>📋</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'rgb(200,210,225)', marginBottom: '0.5rem' }}>
              {search || filter !== 'all' ? 'Nenhum resultado encontrado' : 'Ainda não tens orçamentos'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'rgb(80,92,110)', marginBottom: '1.5rem', maxWidth: '320px', margin: '0 auto 1.5rem' }}>
              {search || filter !== 'all' ? 'Tenta mudar os filtros.' : 'Pede o teu primeiro orçamento e recebe proposta em 24h.'}
            </p>
            {!search && filter === 'all' && (
              <Link href="/quotes/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                background: 'rgb(77,163,255)', color: 'rgb(7,17,31)',
                padding: '0.625rem 1.25rem', borderRadius: '10px',
                fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
              }}>
                + Criar orçamento
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filtered.map((q, i) => <QuoteCard key={q.id} quote={q} index={i} />)}
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgb(70,82,100)', marginTop: '0.5rem' }}>
                {filtered.length} orçamento{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </AnimatePresence>
        )}
      </div>
    </PortalLayout>
  );
}
