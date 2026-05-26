'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface Invoice {
  id: string;
  ref: string;
  status: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  order_ref: string | null;
  pdf_url: string | null;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Rascunho',  color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' },
  pending:   { label: 'Pendente',  color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  paid:      { label: 'Pago ✓',    color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
  overdue:   { label: 'Em Atraso', color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
  cancelled: { label: 'Cancelado', color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.08)' },
};

const FILTERS = ['Todas', 'Pendentes', 'Pagas', 'Em Atraso'];

export default function ClientBillingPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/billing'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        const { data: inv } = await supabase
          .from('invoices')
          .select('id,ref,status,amount,due_date,paid_at,created_at,order_ref,pdf_url')
          .eq('client_id', c.id)
          .order('created_at', { ascending: false });
        setInvoices((inv ?? []) as Invoice[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = invoices.filter(inv => {
    if (filter === 'Todas') return true;
    if (filter === 'Pendentes') return inv.status === 'pending';
    if (filter === 'Pagas') return inv.status === 'paid';
    if (filter === 'Em Atraso') return inv.status === 'overdue';
    return true;
  });

  const totalPending = invoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const s = (st: string) => STATUS[st] ?? { label: st, color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' };

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Faturação</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Consulta e descarrega as tuas faturas</p>
        </motion.div>

        {/* KPI summary */}
        {!loading && invoices.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.625rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Valor Pendente', value: `€${totalPending.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: overdueCount > 0 ? 'rgb(245,158,11)' : 'rgb(77,163,255)', icon: '⏳' },
              { label: 'Total Pago', value: `€${totalPaid.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: 'rgb(99,230,190)', icon: '✅' },
              { label: 'Faturas em Atraso', value: String(overdueCount), color: overdueCount > 0 ? 'rgb(239,68,68)' : 'rgb(80,92,110)', icon: overdueCount > 0 ? '🚨' : '🟢' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '1rem' }}>{kpi.icon}</span>
                  <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '0.875rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🚨</span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(239,68,68)' }}>Tens {overdueCount} fatura{overdueCount !== 1 ? 's' : ''} em atraso</div>
              <div style={{ fontSize: '0.65rem', color: 'rgb(180,100,100)', marginTop: '0.15rem' }}>Por favor regulariza a situação ou contacta-nos: <a href="mailto:geral@yourgift.pt" style={{ color: 'rgb(239,68,68)', textDecoration: 'underline' }}>geral@yourgift.pt</a></div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: '0.35rem 0.875rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: filter === f ? 600 : 400, cursor: 'pointer', background: filter === f ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: filter === f ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: filter === f ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 150ms' }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '80px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(80,92,110)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧾</div>
            <div style={{ fontSize: '0.85rem', marginBottom: '0.375rem' }}>
              {invoices.length === 0 ? 'Ainda não tens faturas' : 'Nenhuma fatura nesta categoria'}
            </div>
            {invoices.length === 0 && (
              <div style={{ fontSize: '0.72rem', color: 'rgb(60,72,90)' }}>As faturas aparecerão aqui assim que as encomendas forem confirmadas</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map((inv, i) => {
              const st = s(inv.status);
              const isOverdue = inv.status === 'overdue';
              return (
                <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '0.875rem 1rem', borderLeft: `3px solid ${st.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgb(220,230,245)' }}>{inv.ref}</span>
                        {inv.order_ref && <span style={{ fontSize: '0.6rem', color: 'rgb(80,92,110)', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>ref. {inv.order_ref}</span>}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>
                        Emitida em {new Date(inv.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {inv.due_date && ` · Vence ${new Date(inv.due_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}`}
                        {inv.paid_at && ` · Pago a ${new Date(inv.paid_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: inv.status === 'paid' ? 'rgb(99,230,190)' : 'rgb(225,235,250)' }}>
                        €{inv.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>{st.label}</span>
                      {inv.pdf_url ? (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                          style={{ background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.65rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 600 }}>
                          ↓ PDF
                        </a>
                      ) : (
                        <a href={`mailto:geral@yourgift.pt?subject=Fatura ${inv.ref}`}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.65rem', color: 'rgb(120,130,150)', textDecoration: 'none', fontWeight: 600 }}>
                          Pedir
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Contact note */}
        {!loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ marginTop: '1.5rem', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '1rem' }}>💬</span>
            <div style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)', lineHeight: 1.5 }}>
              Questões sobre faturação? Contacta a nossa equipa em{' '}
              <a href="mailto:geral@yourgift.pt?subject=Questão sobre faturação" style={{ color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 600 }}>geral@yourgift.pt</a>
            </div>
          </motion.div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
