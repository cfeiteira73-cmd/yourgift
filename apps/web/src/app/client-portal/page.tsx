'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
}

interface Order {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

interface Quote {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:        { label: 'Rascunho',      color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' },
  pending:      { label: 'Pendente',      color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  confirmed:    { label: 'Confirmado',    color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  producing:    { label: 'Em Produção',   color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)' },
  shipped:      { label: 'Enviado',       color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  delivered:    { label: 'Entregue',      color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
  cancelled:    { label: 'Cancelado',     color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)'   },
  submitted:    { label: 'Submetido',     color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)'  },
  pricing:      { label: 'Em análise',    color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.12)' },
  proposed:     { label: 'Proposto',      color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.12)'  },
  approved:     { label: 'Aprovado',      color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.12)'  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.12)' };
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700,
      color: s.color, background: s.bg,
      borderRadius: '9999px', padding: '0.2rem 0.625rem',
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

export default function ClientPortalPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal'); return; }
      setUserEmail(user.email ?? '');

      const { data: c } = await supabase
        .from('clients').select('id,name,company,tier')
        .eq('auth_user_id', user.id).single();

      if (c) {
        setClient(c as ClientProfile);

        const [{ data: ord }, { data: quot }] = await Promise.all([
          supabase.from('orders')
            .select('id,ref,status,total_amount,created_at')
            .eq('client_id', c.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('quotes')
            .select('id,ref,status,total_amount,created_at')
            .eq('client_id', c.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setOrders((ord ?? []) as Order[]);
        setQuotes((quot ?? []) as Quote[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const displayName = client?.name ?? userEmail.split('@')[0] ?? 'Cliente';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || 'CL';

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(7,17,31)', color: 'rgb(220,230,245)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header style={{
        background: 'rgb(8,15,28)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 2rem', height: '58px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'linear-gradient(135deg, rgb(77,163,255), rgb(99,230,190))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(77,163,255,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(7,17,31)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
              <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 900, color: 'rgb(245,247,251)', letterSpacing: '-0.02em' }}>
            your<span style={{ color: 'rgb(77,163,255)' }}>gift</span>
          </span>
          <span style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', marginLeft: '0.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.1rem 0.5rem' }}>Portal Cliente</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgb(210,220,235)' }}>{displayName}</div>
            <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{userEmail}</div>
          </div>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, color: 'rgb(7,17,31)',
          }}>{initials}</div>
          <button type="button" onClick={handleLogout} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer',
            fontSize: '0.72rem', color: 'rgb(239,68,68)', fontWeight: 600,
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>

        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
            Olá, {client?.name?.split(' ')[0] ?? 'Cliente'} 👋
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'rgb(80,92,110)' }}>
            {client?.company ? `${client.company} · ` : ''}Bem-vindo ao teu portal YourGift
          </p>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2].map(i => (
              <div key={i} style={{ height: '140px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Quick stats */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Encomendas', value: orders.length, color: 'rgb(77,163,255)', icon: '📦' },
                { label: 'Orçamentos', value: quotes.length, color: 'rgb(245,158,11)', icon: '📋' },
                { label: 'Em Produção', value: orders.filter(o => ['producing', 'confirmed', 'pending'].includes(o.status)).length, color: 'rgb(116,231,255)', icon: '🏭' },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.125rem' }}>
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.375rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgb(80,92,110)', marginTop: '0.2rem' }}>{s.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Recent orders */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Encomendas Recentes</h2>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
                {orders.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.82rem' }}>
                    Ainda não tens encomendas. <a href="mailto:geral@yourgift.pt" style={{ color: 'rgb(77,163,255)', textDecoration: 'none' }}>Fala connosco →</a>
                  </div>
                ) : orders.map((order, i) => (
                  <div key={order.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.875rem 1.125rem',
                    borderBottom: i < orders.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(77,163,255,0.1)', border: '1px solid rgba(77,163,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>📦</div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgb(220,230,245)' }}>{order.ref}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>{new Date(order.created_at).toLocaleDateString('pt-PT')}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {order.total_amount && (
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>
                          €{order.total_amount.toLocaleString('pt-PT')}
                        </span>
                      )}
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent quotes */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <div style={{ marginBottom: '0.875rem' }}>
                <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orçamentos Recentes</h2>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
                {quotes.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(80,92,110)', fontSize: '0.82rem' }}>
                    Nenhum orçamento ainda. <a href="mailto:geral@yourgift.pt" style={{ color: 'rgb(77,163,255)', textDecoration: 'none' }}>Pede um orçamento →</a>
                  </div>
                ) : quotes.map((quote, i) => (
                  <div key={quote.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.875rem 1.125rem',
                    borderBottom: i < quotes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>📋</div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgb(220,230,245)' }}>{quote.ref}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)' }}>{new Date(quote.created_at).toLocaleDateString('pt-PT')}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {quote.total_amount && (
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>
                          €{quote.total_amount.toLocaleString('pt-PT')}
                        </span>
                      )}
                      <StatusBadge status={quote.status} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Contact CTA */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
              style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(77,163,255,0.06)', border: '1px solid rgba(77,163,255,0.15)', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgb(77,163,255)', marginBottom: '0.2rem' }}>Precisas de ajuda?</div>
                <div style={{ fontSize: '0.72rem', color: 'rgb(100,112,130)' }}>A nossa equipa responde em menos de 2 horas úteis.</div>
              </div>
              <a href="mailto:geral@yourgift.pt" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                background: 'rgba(77,163,255,0.15)', border: '1px solid rgba(77,163,255,0.3)',
                borderRadius: '9px', padding: '0.5rem 1rem',
                fontSize: '0.78rem', fontWeight: 700, color: 'rgb(77,163,255)', textDecoration: 'none',
              }}>
                ✉️ geral@yourgift.pt
              </a>
            </motion.div>
          </>
        )}
      </main>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
