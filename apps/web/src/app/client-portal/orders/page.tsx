'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface Order { id: string; ref: string; status: string; total_amount: number | null; created_at: string; notes: string | null; }

const STATUS: Record<string, { label: string; color: string; bg: string; step: number }> = {
  draft:     { label: 'Rascunho',    color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)', step: 0 },
  pending:   { label: 'Pendente',    color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)',  step: 1 },
  confirmed: { label: 'Confirmado',  color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)',  step: 2 },
  producing: { label: 'Em Produção', color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)', step: 3 },
  shipped:   { label: 'Enviado',     color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)',  step: 4 },
  delivered: { label: 'Entregue ✓',  color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)',  step: 5 },
  cancelled: { label: 'Cancelado',   color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)',   step: -1 },
};

const STEPS = ['Pendente', 'Confirmado', 'Em Produção', 'Enviado', 'Entregue'];

const FILTERS = ['Todas', 'Ativas', 'Em Produção', 'Entregues', 'Canceladas'];

function StatusTimeline({ status }: { status: string }) {
  const s = STATUS[status];
  if (!s || s.step < 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '0.875rem' }}>
      {STEPS.map((step, i) => {
        const done = s.step > i;
        const active = s.step === i + 1;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: done || active ? s.color : 'rgba(255,255,255,0.1)', border: `2px solid ${done || active ? s.color : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: done || active ? 'rgb(7,17,31)' : 'rgb(80,92,110)', fontWeight: 800, transition: 'all 300ms' }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.5rem', color: done || active ? s.color : 'rgb(70,82,100)', whiteSpace: 'nowrap', fontWeight: active ? 700 : 400 }}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? s.color : 'rgba(255,255,255,0.08)', margin: '0 2px', marginBottom: '1rem', transition: 'background 300ms' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ClientOrdersPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('Todas');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/orders'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        const { data: ord } = await supabase.from('orders').select('id,ref,status,total_amount,created_at,notes').eq('client_id', c.id).order('created_at', { ascending: false });
        setOrders((ord ?? []) as Order[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = orders.filter(o => {
    if (filter === 'Todas') return true;
    if (filter === 'Ativas') return !['delivered', 'cancelled', 'draft'].includes(o.status);
    if (filter === 'Em Produção') return o.status === 'producing';
    if (filter === 'Entregues') return o.status === 'delivered';
    if (filter === 'Canceladas') return o.status === 'cancelled';
    return true;
  });

  const s = (st: string) => STATUS[st] ?? { label: st, color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)', step: 0 };

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>As minhas Encomendas</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>{orders.length} encomenda{orders.length !== 1 ? 's' : ''} no total</p>
        </motion.div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: '0.35rem 0.875rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: filter === f ? 600 : 400, cursor: 'pointer', background: filter === f ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: filter === f ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: filter === f ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 150ms' }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '130px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(80,92,110)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📦</div>
            <div style={{ fontSize: '0.85rem' }}>Nenhuma encomenda encontrada</div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {filtered.map((o, i) => {
                const st = s(o.status);
                return (
                  <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.04 }}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.125rem', borderLeft: `3px solid ${st.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(225,235,250)', marginBottom: '0.15rem' }}>{o.ref}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>Criado em {new Date(o.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {o.total_amount && <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'rgb(99,230,190)' }}>€{o.total_amount.toLocaleString('pt-PT')}</span>}
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>{st.label}</span>
                      </div>
                    </div>
                    {o.notes && <div style={{ fontSize: '0.68rem', color: 'rgb(100,112,130)', marginTop: '0.25rem', fontStyle: 'italic' }}>"{o.notes}"</div>}
                    <StatusTimeline status={o.status} />
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </ClientPortalLayout>
  );
}
