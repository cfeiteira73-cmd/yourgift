'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; budget_limit: number | null; }
interface Order { id: string; ref: string; status: string; total_amount: number | null; created_at: string; }
interface Quote { id: string; ref: string; status: string; total_amount: number | null; created_at: string; }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Rascunho',    color: 'rgba(240,236,228,0.42)', bg: 'rgba(120,130,150,0.12)' },
  pending:   { label: 'Pendente',    color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  confirmed: { label: 'Confirmado',  color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  producing: { label: 'Em Produção', color: '#b8975e', bg: 'rgba(154,124,74,0.12)' },
  shipped:   { label: 'Enviado',     color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  delivered: { label: 'Entregue',    color: '#b8975e',  bg: 'rgba(184,151,94,0.12)'  },
  cancelled: { label: 'Cancelado',   color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
  submitted: { label: 'Submetido',   color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  pricing:   { label: 'Em análise',  color: '#b8975e', bg: 'rgba(154,124,74,0.12)' },
  proposed:  { label: 'Proposto',    color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)'  },
  approved:  { label: 'Aprovado',    color: '#b8975e',  bg: 'rgba(184,151,94,0.12)'  },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, color: 'rgba(240,236,228,0.42)', bg: 'rgba(120,130,150,0.12)' };
  return <span style={{ fontSize: '0.62rem', fontWeight: 700, color: s.color, background: s.bg, borderRadius: '9999px', padding: '0.15rem 0.55rem', whiteSpace: 'nowrap' }}>{s.label}</span>;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c as ClientProfile);
        const [{ data: ord }, { data: quot }] = await Promise.all([
          supabase.from('orders').select('id,ref,status,total_amount,created_at').eq('client_id', c.id).order('created_at', { ascending: false }).limit(4),
          supabase.from('quotes').select('id,ref,status,total_amount,created_at').eq('client_id', c.id).order('created_at', { ascending: false }).limit(4),
        ]);
        setOrders((ord ?? []) as Order[]);
        setQuotes((quot ?? []) as Quote[]);
        const spent = (ord ?? []).filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0);
        setTotalSpent(spent);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const firstName = client?.name?.split(' ')[0] ?? userEmail.split('@')[0] ?? 'Cliente';
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const pendingQuotes = quotes.filter(q => ['submitted', 'pricing', 'proposed'].includes(q.status)).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';

  return (
    <ClientPortalLayout userName={client?.name ?? undefined} userEmail={userEmail} companyName={client?.company ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '900px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
                {greeting}, {firstName} 👋
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.28)' }}>
                {client?.company ? `${client.company} · ` : ''}Bem-vindo ao teu portal YourGift
              </p>
            </div>
            <Link href="/client-portal/quotes" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'linear-gradient(135deg,#d4b47a,rgb(116,100,255))', color: '#fff', padding: '0.5rem 1.125rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(77,163,255,0.25)' }}>
              + Pedir Orçamento
            </Link>
          </div>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '100px', borderRadius: '14px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (<>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Encomendas Ativas', value: activeOrders, color: '#d4b47a', icon: '📦', href: '/client-portal/orders' },
              { label: 'Orçamentos Pendentes', value: pendingQuotes, color: 'rgb(245,158,11)', icon: '📋', href: '/client-portal/quotes' },
              { label: 'Entregas Concluídas', value: orders.filter(o => o.status === 'delivered').length, color: '#b8975e', icon: '✅', href: '/client-portal/orders' },
              { label: 'Total Gasto', value: `€${totalSpent.toLocaleString('pt-PT')}`, color: '#b8975e', icon: '💶', href: '/client-portal/billing' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                <Link href={kpi.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '14px', padding: '1rem 1.125rem', transition: 'border-color 150ms', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.25)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,236,228,0.06)'}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{kpi.icon}</div>
                    <div style={{ fontSize: typeof kpi.value === 'string' ? '1.1rem' : '1.75rem', fontWeight: 800, color: kpi.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{kpi.value}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.28)', marginTop: '0.3rem' }}>{kpi.label}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>

            {/* Recent orders */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Encomendas Recentes</h2>
                <Link href="/client-portal/orders" style={{ fontSize: '0.68rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
              </div>
              <div style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
                {orders.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(240,236,228,0.28)', fontSize: '0.78rem' }}>Nenhuma encomenda ainda</div>
                ) : orders.map((o, i) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: i < orders.length - 1 ? '1px solid rgba(240,236,228,0.06)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)' }}>{o.ref}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.28)' }}>{new Date(o.created_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {o.total_amount ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b8975e' }}>€{o.total_amount.toLocaleString('pt-PT')}</span> : null}
                      <StatusPill status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent quotes */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orçamentos Recentes</h2>
                <Link href="/client-portal/quotes" style={{ fontSize: '0.68rem', color: '#d4b47a', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</Link>
              </div>
              <div style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
                {quotes.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(240,236,228,0.28)', fontSize: '0.78rem' }}>Nenhum orçamento ainda</div>
                ) : quotes.map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: i < quotes.length - 1 ? '1px solid rgba(240,236,228,0.06)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)' }}>{q.ref}</div>
                      <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.28)' }}>{new Date(q.created_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {q.total_amount ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b8975e' }}>€{q.total_amount.toLocaleString('pt-PT')}</span> : null}
                      <StatusPill status={q.status} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>Acesso Rápido</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' }}>
              {[
                { icon: '📋', label: 'Novo Orçamento', desc: 'Pede um orçamento personalizado', href: '/client-portal/quotes', color: '#d4b47a' },
                { icon: '🎨', label: 'Upload de Logo', desc: 'Envia os teus ficheiros de arte', href: '/client-portal/assets', color: '#b8975e' },
                { icon: '🛍️', label: 'Ver Catálogo', desc: 'Explora os nossos produtos', href: '/client-portal/products', color: '#b8975e' },
                { icon: '🧾', label: 'Faturas', desc: 'Consulta os teus pagamentos', href: '/client-portal/billing', color: 'rgb(167,139,250)' },
              ].map((a, i) => (
                <motion.div key={a.label} whileHover={{ y: -2 }}>
                  <Link href={a.href} style={{ textDecoration: 'none', display: 'block', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '12px', padding: '1rem', transition: 'border-color 150ms', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${a.color}40`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,236,228,0.06)'}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{a.icon}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)', marginBottom: '0.25rem' }}>{a.label}</div>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.28)', lineHeight: 1.4 }}>{a.desc}</div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Support banner */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ marginTop: '1rem', padding: '1rem 1.25rem', background: 'rgba(77,163,255,0.05)', border: '1px solid rgba(154,124,74,0.12)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#d4b47a' }}>Precisas de ajuda?</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.42)' }}>Resposta garantida em menos de 2 horas úteis — Seg. a Sex. 9h-18h</div>
            </div>
            <a href="mailto:geral@yourgift.pt" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(154,124,74,0.12)', border: '1px solid rgba(77,163,255,0.25)', borderRadius: '8px', padding: '0.45rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, color: '#d4b47a', textDecoration: 'none' }}>
              ✉️ Contactar equipa
            </a>
          </motion.div>

        </>)}
      </div>
    </ClientPortalLayout>
  );
}
