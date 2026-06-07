'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { SparklineCard } from '@/components/portal/RevenueSparkline';

interface Order { id: string; ref: string; status: string; total_amount: number | null; created_at: string; }
interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

const BILLING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  delivered:          { label: 'Pago',      color: '#b8975e',  bg: 'rgba(184,151,94,0.10)'  },
  shipped:            { label: 'Pago',      color: '#b8975e',  bg: 'rgba(184,151,94,0.10)'  },
  producing:          { label: 'Pendente',  color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)'  },
  in_production:      { label: 'Pendente',  color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)'  },
  confirmed:          { label: 'Pendente',  color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)'  },
  payment_confirmed:  { label: 'Pago',      color: '#b8975e',  bg: 'rgba(184,151,94,0.10)'  },
  pending:            { label: 'Por pagar', color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.1)'   },
  cancelled:          { label: 'Cancelado', color: 'rgba(240,236,228,0.42)', bg: 'rgba(120,130,150,0.1)' },
  approved:           { label: 'Aprovado',  color: '#d4b47a',  bg: 'rgba(154,124,74,0.10)'  },
  draft:              { label: 'Rascunho',  color: 'rgba(240,236,228,0.42)', bg: 'rgba(100,112,130,0.1)' },
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function invoiceRef(ref: string) {
  return ref.replace('#YG-', 'FT-YG-');
}

export default function BillingPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login?next=/billing'); return; }
        const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
        setClient(c as ClientProfile | null);
        if (!c) return;
        const { data } = await supabase.from('orders').select('id,ref,status,total_amount,created_at').eq('client_id', c.id).not('status', 'eq', 'draft').order('created_at', { ascending: false });
        setOrders((data ?? []) as Order[]);
      } catch (err) {
        console.error('[billing] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const stats = useMemo(() => {
    const paid = orders.filter(o => ['delivered','shipped','payment_confirmed'].includes(o.status)).reduce((s,o) => s + (o.total_amount ?? 0), 0);
    const pending = orders.filter(o => ['producing','in_production','confirmed','approved'].includes(o.status)).reduce((s,o) => s + (o.total_amount ?? 0), 0);
    const overdue = orders.filter(o => o.status === 'pending').reduce((s,o) => s + (o.total_amount ?? 0), 0);
    return { paid, pending, overdue, total: paid + pending + overdue };
  }, [orders]);

  // Build 6-month revenue sparkline from orders
  const sparklineData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString('pt-PT', { month: 'short' });
      const value = orders
        .filter(o => {
          const od = new Date(o.created_at);
          return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && !['cancelled','draft'].includes(o.status);
        })
        .reduce((s, o) => s + (o.total_amount ?? 0), 0);
      return { label, value };
    });
  }, [orders]);

  const filtered = useMemo(() => {
    if (filter === 'paid') return orders.filter(o => ['delivered','shipped','payment_confirmed'].includes(o.status));
    if (filter === 'pending') return orders.filter(o => ['producing','in_production','confirmed','approved'].includes(o.status));
    if (filter === 'overdue') return orders.filter(o => o.status === 'pending');
    return orders.filter(o => o.status !== 'cancelled');
  }, [orders, filter]);

  const TABS = [
    { key:'all', label:'Todas', count: orders.length },
    { key:'paid', label:'Pagas', count: orders.filter(o=>['delivered','shipped','payment_confirmed'].includes(o.status)).length },
    { key:'pending', label:'Pendentes', count: orders.filter(o=>['producing','in_production','confirmed','approved'].includes(o.status)).length },
    { key:'overdue', label:'Por pagar', count: orders.filter(o=>o.status==='pending').length },
  ] as const;

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding:'1.5rem 2rem 3rem', maxWidth:'900px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'#f0ece4', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Faturação</h1>
          <p style={{ fontSize:'0.78rem', color:'rgba(240,236,228,0.24)' }}>Histórico de faturas e pagamentos</p>
        </motion.div>

        {/* Revenue sparkline bar */}
        {!loading && orders.length > 0 && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.04 }}
            style={{ marginBottom:'1rem' }}>
            <SparklineCard
              title="Receita — Últimos 6 meses"
              value={fmtEur(stats.total)}
              data={sparklineData}
              color="#b8975e"
              width={180}
            />
          </motion.div>
        )}

        {/* Summary cards */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem', marginBottom:'1.25rem' }}>
          {[
            { label:'Total Faturado', value: fmtEur(stats.total), color:'#d4b47a',   icon:'💶' },
            { label:'Pagas',          value: fmtEur(stats.paid),  color:'#b8975e',   icon:'✅' },
            { label:'Pendentes',      value: fmtEur(stats.pending),color:'rgb(245,158,11)',  icon:'⏳' },
            { label:'Por Pagar',      value: fmtEur(stats.overdue),color:'rgb(239,68,68)',   icon:'⚠️' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 + i*0.05 }}
              className="yg-card" style={{ padding:'1rem 1.125rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.375rem' }}>
                <span style={{ fontSize:'0.6rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'rgba(240,236,228,0.24)' }}>{s.label}</span>
                <span style={{ fontSize:'0.9rem' }}>{s.icon}</span>
              </div>
              <div style={{ fontSize:'1.15rem', fontWeight:800, color:s.color, letterSpacing:'-0.03em' }}>{s.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
          style={{ display:'flex', gap:'0.375rem', marginBottom:'1.25rem' }}>
          {TABS.map(tab => (
            <button type="button" key={tab.key} onClick={() => setFilter(tab.key as typeof filter)}
              style={{ padding:'0.4rem 0.875rem', borderRadius:'9999px', fontSize:'0.78rem', fontWeight:filter===tab.key ? 600 : 400, cursor:'pointer', border: filter===tab.key ? '1px solid rgba(154,124,74,0.35)' : '1px solid rgba(240,236,228,0.06)', background: filter===tab.key ? 'rgba(154,124,74,0.12)' : 'rgba(240,236,228,0.04)', color: filter===tab.key ? '#d4b47a' : 'rgba(240,236,228,0.42)', transition:'all 150ms' }}>
              {tab.label} {tab.count > 0 && <span style={{ opacity:0.7 }}>({tab.count})</span>}
            </button>
          ))}
        </motion.div>

        {/* Invoice table */}
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height:'52px', borderRadius:'12px', background:'rgba(240,236,228,0.04)', animation:'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="yg-card" style={{ padding:'4rem 2rem', textAlign:'center' }}>
            <p style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🧾</p>
            <p style={{ fontSize:'1rem', fontWeight:600, color:'rgba(240,236,228,0.72)', marginBottom:'0.375rem' }}>Sem faturas nesta categoria</p>
            <p style={{ fontSize:'0.78rem', color:'rgba(240,236,228,0.24)' }}>Altera o filtro para ver outros registos.</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 90px 120px 90px 80px', gap:'0.75rem', padding:'0.5rem 1rem', marginBottom:'0.375rem' }}>
              {['Nº Fatura','Encomenda','Data','Valor','Estado','Ação'].map(h => (
                <span key={h} style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'rgba(240,236,228,0.24)' }}>{h}</span>
              ))}
            </div>
            <AnimatePresence mode="popLayout">
              {filtered.map((order, i) => {
                const bs = BILLING_STATUS[order.status] ?? BILLING_STATUS.pending;
                return (
                  <motion.div key={order.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                    transition={{ delay: i * 0.04 }}
                    className="yg-card"
                    style={{ display:'grid', gridTemplateColumns:'100px 1fr 90px 120px 90px 80px', gap:'0.75rem', alignItems:'center', padding:'0.875rem 1rem', marginBottom:'0.5rem' }}>
                    <span style={{ fontSize:'0.68rem', fontFamily:'monospace', fontWeight:700, color:'rgb(160,175,195)' }}>{invoiceRef(order.ref)}</span>
                    <span style={{ fontSize:'0.72rem', fontWeight:600, color:'rgba(240,236,228,0.72)' }}>{order.ref}</span>
                    <span style={{ fontSize:'0.7rem', color:'rgba(240,236,228,0.42)' }}>{fmtDate(order.created_at)}</span>
                    <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#b8975e' }}>{order.total_amount ? fmtEur(order.total_amount) : '—'}</span>
                    <span style={{ fontSize:'0.65rem', fontWeight:700, color:bs.color, background:bs.bg, padding:'0.2rem 0.5rem', borderRadius:'9999px', textAlign:'center' }}>{bs.label}</span>
                    <Link href={`/orders/${order.id}`} style={{ fontSize:'0.68rem', color:'#d4b47a', textDecoration:'none', fontWeight:600 }}>Ver →</Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
