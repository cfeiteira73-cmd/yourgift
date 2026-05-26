'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface ClientProfile {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  budget_limit: number | null;
  auth_user_id: string;
  created_at?: string;
}

interface Stats { orders: number; quotes: number; totalSpend: number; }

const TIER_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  premium:    { label: 'PRO',        color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)',  border: 'rgba(99,230,190,0.25)'  },
  enterprise: { label: 'Enterprise', color: 'rgb(116,231,255)', bg: 'rgba(116,231,255,0.1)', border: 'rgba(116,231,255,0.25)' },
  standard:   { label: 'Standard',   color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.1)', border: 'rgba(120,130,150,0.2)'  },
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '0.75rem', color: 'rgb(100,112,130)' }}>{label}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: accent ? 'rgb(77,163,255)' : 'rgb(210,220,235)' }}>{value}</span>
    </div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ orders: 0, quotes: 0, totalSpend: 0 });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/clients'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
      if (!c) { setLoading(false); return; }
      const [ordersRes, quotesRes, spendRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
        supabase.from('orders').select('total_amount').eq('client_id', c.id).not('status', 'eq', 'cancelled'),
      ]);
      const totalSpend = (spendRes.data ?? []).reduce((s, o: any) => s + (o.total_amount ?? 0), 0);
      setStats({ orders: ordersRes.count ?? 0, quotes: quotesRes.count ?? 0, totalSpend });
      setLoading(false);
    }
    load();
  }, [router]);

  const tc = TIER_CFG[(client?.tier ?? 'standard') as keyof typeof TIER_CFG] ?? TIER_CFG.standard;
  const initials = (client?.name ?? 'YG').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '860px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Clientes</h1>
          <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>Perfil da conta e informações de cliente</p>
        </motion.div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height:'120px', borderRadius:'16px', background:'rgba(255,255,255,0.04)', animation:'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>

            {/* Profile card */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, delay:0.05 }}
              className="yg-card" style={{ padding:'1.5rem', gridColumn:'1 / -1', display:'flex', gap:'1.25rem', alignItems:'center' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'18px', flexShrink:0, background:'linear-gradient(135deg,rgb(77,163,255),rgb(116,231,255))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', fontWeight:800, color:'rgb(7,17,31)', boxShadow:'0 0 20px rgba(77,163,255,0.3)' }}>
                {initials}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', marginBottom:'0.375rem', flexWrap:'wrap' }}>
                  <h2 style={{ fontSize:'1.25rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.02em' }}>{client?.name ?? 'Utilizador'}</h2>
                  <span style={{ fontSize:'0.65rem', fontWeight:700, color:tc.color, background:tc.bg, border:`1px solid ${tc.border}`, borderRadius:'9999px', padding:'0.2rem 0.6rem' }}>{tc.label}</span>
                </div>
                <p style={{ fontSize:'0.82rem', color:'rgb(120,130,150)', marginBottom:'0.25rem' }}>{client?.company ?? '—'}</p>
                <p style={{ fontSize:'0.75rem', color:'rgb(80,92,110)' }}>{userEmail}</p>
              </div>
              <div style={{ display:'flex', gap:'1.25rem', textAlign:'center' }}>
                {[
                  { label:'Encomendas', value: stats.orders },
                  { label:'Orçamentos', value: stats.quotes },
                  { label:'Total Gasto', value: fmtEur(stats.totalSpend) },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:'1.25rem', fontWeight:800, color:'rgb(99,230,190)', letterSpacing:'-0.03em' }}>{s.value}</div>
                    <div style={{ fontSize:'0.62rem', color:'rgb(80,92,110)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Account details */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, delay:0.1 }}
              className="yg-card" style={{ padding:'1.25rem 1.375rem' }}>
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'rgb(245,247,251)', marginBottom:'0.625rem' }}>Detalhes da Conta</h3>
              <InfoRow label="Nome" value={client?.name ?? '—'} />
              <InfoRow label="Empresa" value={client?.company ?? '—'} />
              <InfoRow label="Email" value={userEmail} accent />
              <InfoRow label="Plano" value={tc.label} accent />
              <InfoRow label="Budget limite" value={client?.budget_limit ? fmtEur(client.budget_limit) : 'Ilimitado'} />
              <InfoRow label="ID cliente" value={client?.id?.slice(0,8).toUpperCase() ?? '—'} />
            </motion.div>

            {/* Quick stats */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, delay:0.15 }}
              className="yg-card" style={{ padding:'1.25rem 1.375rem' }}>
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'rgb(245,247,251)', marginBottom:'0.625rem' }}>Atividade</h3>
              {[
                { icon:'📦', label:'Total de encomendas',  value: String(stats.orders),       color:'rgb(77,163,255)'   },
                { icon:'📋', label:'Total de orçamentos',  value: String(stats.quotes),       color:'rgb(245,158,11)'   },
                { icon:'💶', label:'Volume total',          value: fmtEur(stats.totalSpend),   color:'rgb(99,230,190)'   },
                { icon:'⭐', label:'Nível de cliente',      value: tc.label,                   color: tc.color           },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.5rem 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize:'1rem' }}>{item.icon}</span>
                  <span style={{ fontSize:'0.75rem', color:'rgb(140,155,175)', flex:1 }}>{item.label}</span>
                  <span style={{ fontSize:'0.78rem', fontWeight:700, color:item.color }}>{item.value}</span>
                </div>
              ))}
            </motion.div>

            {/* Contact / Support */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, delay:0.2 }}
              className="yg-card" style={{ padding:'1.25rem 1.375rem', gridColumn:'1/-1' }}>
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'rgb(245,247,251)', marginBottom:'0.875rem' }}>Suporte Dedicado</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
                {[
                  { icon:'📞', label:'Telefone', value:'+351 210 000 000', desc:'Seg–Sex, 9h–18h' },
                  { icon:'✉️', label:'Email', value:'suporte@yourgift.pt', desc:'Resposta em 2h' },
                  { icon:'💬', label:'Live Chat', value:'Disponível agora', desc:'Tempo real' },
                ].map(c => (
                  <div key={c.label} style={{ padding:'0.875rem', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px' }}>
                    <span style={{ fontSize:'1.25rem', display:'block', marginBottom:'0.375rem' }}>{c.icon}</span>
                    <div style={{ fontSize:'0.68rem', color:'rgb(100,112,130)', marginBottom:'0.2rem' }}>{c.label}</div>
                    <div style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(77,163,255)', marginBottom:'0.1rem' }}>{c.value}</div>
                    <div style={{ fontSize:'0.65rem', color:'rgb(80,92,110)' }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
