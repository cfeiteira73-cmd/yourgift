'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface Quote { id: string; ref: string; status: string; total_amount: number | null; notes: string | null; created_at: string; }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Rascunho',   color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' },
  submitted:{ label: 'Submetido', color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  pricing:  { label: 'Em análise',color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)' },
  proposed: { label: 'Proposta enviada',color: 'rgb(77,163,255)', bg: 'rgba(77,163,255,0.12)' },
  approved: { label: 'Aprovado ✓',color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
  rejected: { label: 'Rejeitado', color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
  expired:  { label: 'Expirado',  color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.08)' },
};

const FILTERS = ['Todos', 'Pendentes', 'Propostos', 'Aprovados'];

export default function ClientQuotesPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState('Todos');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ product: '', quantity: '', notes: '' });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/quotes'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        const { data: q } = await supabase.from('quotes').select('id,ref,status,total_amount,notes,created_at').eq('client_id', c.id).order('created_at', { ascending: false });
        setQuotes((q ?? []) as Quote[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = quotes.filter(q => {
    if (filter === 'Todos') return true;
    if (filter === 'Pendentes') return ['submitted', 'pricing'].includes(q.status);
    if (filter === 'Propostos') return q.status === 'proposed';
    if (filter === 'Aprovados') return q.status === 'approved';
    return true;
  });

  async function handleRequest() {
    if (!formData.product.trim()) return;
    setRequesting(true);
    // In production: create quote record + send email to geral@yourgift.pt
    const supabase = createClient();
    if (client) {
      const ref = `#YGQ-${Date.now().toString().slice(-6)}`;
      await supabase.from('quotes').insert({
        client_id: client.id,
        ref,
        status: 'submitted',
        notes: `Produto: ${formData.product} | Qtd: ${formData.quantity} | Observações: ${formData.notes}`,
      });
      const { data: q } = await supabase.from('quotes').select('id,ref,status,total_amount,notes,created_at').eq('client_id', client.id).order('created_at', { ascending: false });
      setQuotes((q ?? []) as Quote[]);
    }
    setShowForm(false);
    setFormData({ product: '', quantity: '', notes: '' });
    setRequesting(false);
  }

  const s = (st: string) => STATUS[st] ?? { label: st, color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' };

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Os meus Orçamentos</h1>
            <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>{quotes.length} orçamento{quotes.length !== 1 ? 's' : ''} no total</p>
          </div>
          <motion.button type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowForm(true)}
            style={{ background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.125rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(77,163,255,0.25)' }}>
            + Pedir Orçamento
          </motion.button>
        </motion.div>

        {/* Request form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ background: 'rgba(77,163,255,0.06)', border: '1px solid rgba(77,163,255,0.2)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(77,163,255)', marginBottom: '0.875rem' }}>Novo Pedido de Orçamento</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
                {[
                  { label: 'Produto / Artigo', key: 'product', placeholder: 'Ex: Canetas personalizadas, t-shirts...', full: true },
                  { label: 'Quantidade aproximada', key: 'quantity', placeholder: 'Ex: 500 unidades', full: false },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                    <input value={(formData as any)[f.key]} onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'rgb(220,230,245)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>Observações adicionais</label>
                <textarea value={formData.notes} onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))} placeholder="Cores, logótipo, prazo desejado, personalização..."
                  rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'rgb(220,230,245)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.45rem 0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(140,155,175)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="button" onClick={handleRequest} disabled={requesting || !formData.product.trim()} style={{ padding: '0.45rem 1rem', borderRadius: '8px', background: 'rgb(77,163,255)', border: 'none', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700, opacity: requesting ? 0.7 : 1 }}>
                  {requesting ? 'A enviar...' : 'Enviar Pedido'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            {[1,2,3].map(i => <div key={i} style={{ height: '110px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(80,92,110)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
            <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Nenhum orçamento ainda</div>
            <button type="button" onClick={() => setShowForm(true)} style={{ fontSize: '0.75rem', color: 'rgb(77,163,255)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Pedir o primeiro agora</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map((q, i) => {
              const st = s(q.status);
              const isProposed = q.status === 'proposed';
              return (
                <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isProposed ? 'rgba(77,163,255,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '1.125rem', borderLeft: `3px solid ${st.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgb(225,235,250)', marginBottom: '0.15rem' }}>{q.ref}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{new Date(q.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {q.total_amount ? <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgb(99,230,190)' }}>€{q.total_amount.toLocaleString('pt-PT')}</span> : <span style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)' }}>Valor a definir</span>}
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>{st.label}</span>
                    </div>
                  </div>
                  {q.notes && <div style={{ fontSize: '0.68rem', color: 'rgb(100,112,130)', marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>{q.notes}</div>}
                  {isProposed && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <a href="mailto:geral@yourgift.pt?subject=Aprovação Orçamento" style={{ flex: 1, textAlign: 'center', padding: '0.45rem', borderRadius: '8px', background: 'rgba(99,230,190,0.12)', border: '1px solid rgba(99,230,190,0.25)', color: 'rgb(99,230,190)', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>✓ Aprovar</a>
                      <a href="mailto:geral@yourgift.pt?subject=Revisão Orçamento" style={{ flex: 1, textAlign: 'center', padding: '0.45rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(140,155,175)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}>Pedir revisão</a>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
