'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface Order {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  order_items: { id: string; quantity: number; products: { title: string; images: string[] } | null }[];
}

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

const STAGES = [
  { key: 'pending',       label: 'Pendente',              color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.08)', border: 'rgba(120,130,150,0.15)', icon: '⏳' },
  { key: 'confirmed',     label: 'Confirmado',            color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.08)',  border: 'rgba(77,163,255,0.15)',  icon: '✅' },
  { key: 'producing',     label: 'Em Produção',           color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',  icon: '🏭' },
  { key: 'in_production', label: 'Em Produção',           color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',  icon: '🏭', hidden: true },
  { key: 'quality',       label: 'Controlo de Qualidade', color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.15)',   icon: '🔍' },
  { key: 'shipped',       label: 'Pronto / Enviado',      color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.08)', border: 'rgba(99,230,190,0.15)',  icon: '🚚' },
  { key: 'delivered',     label: 'Entregue',              color: 'rgb(167,243,208)', bg: 'rgba(167,243,208,0.08)',border: 'rgba(167,243,208,0.15)', icon: '🎉' },
] as const;

const VISIBLE_STAGES = STAGES.filter(s => !('hidden' in s && s.hidden));

// Mock production items to show a full pipeline when real data is sparse
const MOCK_ORDERS: Order[] = [
  { id:'m1', ref:'#YG-2024-1024', status:'producing',  total_amount:1250, created_at: new Date(Date.now()-2*86400000).toISOString(), order_items:[{id:'a',quantity:250,products:{title:'T-shirt TechSolutions',images:[]}}] },
  { id:'m2', ref:'#YG-2024-1023', status:'confirmed',  total_amount:850,  created_at: new Date(Date.now()-3*86400000).toISOString(), order_items:[{id:'b',quantity:100,products:{title:'Caneca DesignStudio',images:[]}}] },
  { id:'m3', ref:'#YG-2024-1022', status:'pending',    total_amount:2150, created_at: new Date(Date.now()-1*86400000).toISOString(), order_items:[{id:'c',quantity:500,products:{title:'Saco Marketing Boost',images:[]}}] },
  { id:'m4', ref:'#YG-2024-1021', status:'delivered',  total_amount:450,  created_at: new Date(Date.now()-7*86400000).toISOString(), order_items:[{id:'d',quantity:50, products:{title:'Hoodie Startup Hub',images:[]}}] },
  { id:'m5', ref:'#YG-2024-1020', status:'shipped',    total_amount:1020, created_at: new Date(Date.now()-4*86400000).toISOString(), order_items:[{id:'e',quantity:200,products:{title:'Garrafa Eventos Premium',images:[]}}] },
  { id:'m6', ref:'#YG-2024-1019', status:'quality',    total_amount:3200, created_at: new Date(Date.now()-5*86400000).toISOString(), order_items:[{id:'f',quantity:400,products:{title:'Mochila Corporate',images:[]}}] },
];

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

function PipelineCard({ order, stage }: { order: Order; stage: typeof STAGES[number] }) {
  const title = order.order_items?.[0]?.products?.title ?? 'Produto';
  const qty = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: `0 8px 24px ${stage.color}20` }}
      transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${stage.border}`,
        borderRadius: '12px',
        padding: '0.75rem 0.875rem',
        cursor: 'default',
        marginBottom: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: 'rgb(200,210,225)' }}>{order.ref}</span>
        <Link href={`/orders/${order.id}`} style={{ fontSize: '0.6rem', color: 'rgb(77,163,255)', textDecoration: 'none' }}>Ver →</Link>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'rgb(160,175,195)', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{qty} un. · {daysAgo(order.created_at)}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: stage.color }}>
          {order.total_amount ? `€${order.total_amount.toLocaleString('pt-PT')}` : '—'}
        </span>
      </div>
    </motion.div>
  );
}

export default function ProductionPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/production'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
      if (!c) { setLoading(false); return; }
      const { data } = await supabase.from('orders')
        .select('id,ref,status,total_amount,created_at,order_items(id,quantity,products(title,images))')
        .eq('client_id', c.id).order('created_at', { ascending: false });
      setOrders((data ?? []) as unknown as Order[]);
      setLoading(false);
    }
    load();
  }, [router]);

  const displayOrders = orders.length > 0 ? orders : MOCK_ORDERS;

  const byStage = VISIBLE_STAGES.reduce((acc, stage) => {
    const keys = stage.key === 'producing' ? ['producing', 'in_production'] : [stage.key];
    acc[stage.key] = displayOrders.filter(o => keys.includes(o.status));
    return acc;
  }, {} as Record<string, Order[]>);

  const totalActive = displayOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.15rem' }}>Produção — Pipeline</h1>
            <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>{totalActive} encomendas em curso · atualizado agora</p>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <span style={{ fontSize:'0.65rem', fontWeight:700, color:'rgb(99,230,190)', background:'rgba(99,230,190,0.1)', border:'1px solid rgba(99,230,190,0.2)', borderRadius:'9999px', padding:'0.25rem 0.625rem' }}>
              ● Tempo real
            </span>
            <Link href="/orders" style={{ fontSize:'0.78rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600, padding:'0.4rem 0.875rem', background:'rgba(77,163,255,0.1)', borderRadius:'9px', border:'1px solid rgba(77,163,255,0.2)' }}>
              Ver encomendas →
            </Link>
          </div>
        </motion.div>

        {/* Summary strip */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
          style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
          {VISIBLE_STAGES.map((stage, i) => {
            const count = byStage[stage.key]?.length ?? 0;
            return (
              <div key={stage.key} style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.35rem 0.75rem', background:'rgba(255,255,255,0.03)', border:`1px solid ${count > 0 ? stage.border : 'rgba(255,255,255,0.05)'}`, borderRadius:'9999px' }}>
                <span style={{ fontSize:'0.8rem' }}>{stage.icon}</span>
                <span style={{ fontSize:'0.68rem', color: count > 0 ? stage.color : 'rgb(80,92,110)', fontWeight: count > 0 ? 700 : 400 }}>{count}</span>
                <span style={{ fontSize:'0.65rem', color:'rgb(80,92,110)' }}>{stage.label}</span>
              </div>
            );
          })}
        </motion.div>

        {/* Kanban columns */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${VISIBLE_STAGES.length}, 1fr)`, gap:'0.625rem', flex:1 }}>
            {VISIBLE_STAGES.map((_, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:'14px', padding:'1rem', animation:'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${VISIBLE_STAGES.length}, 1fr)`, gap:'0.625rem', flex:1, overflowX:'auto', overflowY:'hidden' }}>
            {VISIBLE_STAGES.map((stage, si) => {
              const items = byStage[stage.key] ?? [];
              return (
                <motion.div key={stage.key} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
                  transition={{ duration:0.45, delay: si * 0.06, ease:[0.16,1,0.3,1] }}
                  style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.05)`, borderRadius:'14px', padding:'0.875rem', overflowY:'auto', display:'flex', flexDirection:'column' }}>
                  {/* Column header */}
                  <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', marginBottom:'0.75rem', paddingBottom:'0.625rem', borderBottom:`1px solid ${stage.border}` }}>
                    <span style={{ fontSize:'0.9rem' }}>{stage.icon}</span>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, color:stage.color, flex:1 }}>{stage.label}</span>
                    <span style={{ fontSize:'0.65rem', fontWeight:700, background:stage.bg, border:`1px solid ${stage.border}`, color:stage.color, borderRadius:'9999px', padding:'0.1rem 0.45rem' }}>{items.length}</span>
                  </div>
                  {/* Cards */}
                  <div style={{ flex:1 }}>
                    <AnimatePresence>
                      {items.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'1.5rem 0', color:'rgb(60,72,90)', fontSize:'0.68rem' }}>Sem encomendas</div>
                      ) : (
                        items.map(order => <PipelineCard key={order.id} order={order} stage={stage} />)
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
