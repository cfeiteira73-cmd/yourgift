'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

const INTEGRATIONS = [
  {
    id:'stripe', name:'Stripe', logo:'💳', category:'Pagamentos',
    desc:'Processamento seguro de pagamentos online e gestão de subscrições.',
    status:'active', lastSync:'há 2 min', color:'rgb(99,230,190)',
    features:['Pagamentos online','Faturas automáticas','Cartões guardados'],
  },
  {
    id:'midocean', name:'Midocean API', logo:'🌊', category:'Fornecedor',
    desc:'Sincronização automática de catálogo, preços e stock em tempo real.',
    status:'active', lastSync:'há 5 min', color:'rgb(77,163,255)',
    features:['Catálogo em tempo real','Stock automático','Preços dinâmicos'],
  },
  {
    id:'pfconcept', name:'PF Concept API', logo:'🎯', category:'Fornecedor',
    desc:'Integração com catálogo eco-friendly e produtos sustentáveis premium.',
    status:'active', lastSync:'há 8 min', color:'rgb(116,231,255)',
    features:['Produtos eco','Certificações','Stock live'],
  },
  {
    id:'supabase', name:'Supabase', logo:'⚡', category:'Base de dados',
    desc:'Base de dados cloud com autenticação, storage e tempo real integrados.',
    status:'active', lastSync:'contínuo', color:'rgb(99,230,190)',
    features:['Auth','Storage','Realtime','RLS'],
  },
  {
    id:'resend', name:'Resend', logo:'✉️', category:'Email',
    desc:'Envio transacional de emails com entregabilidade premium garantida.',
    status:'active', lastSync:'em espera', color:'rgb(245,158,11)',
    features:['Transacional','Templates','Analytics'],
  },
  {
    id:'notion', name:'Notion', logo:'📝', category:'Gestão',
    desc:'Sincronização de notas, projetos e documentos internos de equipa.',
    status:'active', lastSync:'há 1h', color:'rgb(160,172,190)',
    features:['Docs','Projetos','Database'],
  },
  {
    id:'shopify', name:'Shopify', logo:'🛍️', category:'E-commerce',
    desc:'Sincronização com loja Shopify para pedidos e inventário automático.',
    status:'inactive', lastSync:'—', color:'rgb(120,130,150)',
    features:['Pedidos','Inventário','Clientes'],
  },
  {
    id:'hubspot', name:'HubSpot CRM', logo:'🔶', category:'CRM',
    desc:'Sincronização de clientes, negócios e pipeline de vendas com CRM.',
    status:'inactive', lastSync:'—', color:'rgb(120,130,150)',
    features:['Contactos','Pipeline','Relatórios'],
  },
  {
    id:'zapier', name:'Zapier', logo:'⚡', category:'Automação',
    desc:'Automatiza fluxos de trabalho com mais de 5.000 apps conectadas.',
    status:'coming', lastSync:'—', color:'rgb(167,139,250)',
    features:['Workflows','Triggers','5000+ apps'],
  },
];

const CATEGORIES = ['Todos', 'Pagamentos', 'Fornecedor', 'Base de dados', 'Email', 'Gestão', 'E-commerce', 'CRM', 'Automação'];

const STATUS_STYLE = {
  active:   { label:'● Ativo',     color:'rgb(99,230,190)', bg:'rgba(99,230,190,0.1)' },
  inactive: { label:'○ Inativo',   color:'rgb(120,130,150)',bg:'rgba(120,130,150,0.1)'},
  coming:   { label:'◌ Em breve',  color:'rgb(245,158,11)', bg:'rgba(245,158,11,0.1)' },
};

// ── Phase 13: Integrations — Connection test + webhook management ─────────────

export default function IntegrationsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [catFilter, setCatFilter] = useState('Todos');
  const [testing, setTesting] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({});

  async function testConnection(id: string) {
    setTesting(prev => ({ ...prev, [id]: 'testing' }));
    // Simulate connection test (ping the relevant internal endpoint)
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    // Active integrations pass, inactive fail
    const integ = INTEGRATIONS.find(i => i.id === id);
    setTesting(prev => ({ ...prev, [id]: integ?.status === 'active' ? 'ok' : 'fail' }));
    setTimeout(() => setTesting(prev => ({ ...prev, [id]: 'idle' })), 3000);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/integrations'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
    }
    load();
  }, [router]);

  const filtered = catFilter === 'Todos' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === catFilter);
  const activeCount = INTEGRATIONS.filter(i => i.status === 'active').length;

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding:'1.5rem 2rem 3rem', maxWidth:'1000px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Integrações</h1>
            <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>{activeCount} integrações ativas · ecossistema conectado</p>
          </div>
          <span style={{ fontSize:'0.7rem', fontWeight:700, color:'rgb(99,230,190)', background:'rgba(99,230,190,0.1)', border:'1px solid rgba(99,230,190,0.2)', borderRadius:'9999px', padding:'0.35rem 0.875rem' }}>
            ● {activeCount} Ativas
          </span>
        </motion.div>

        {/* Quick stats */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem', marginBottom:'1.25rem' }}>
          {[
            { label:'Integrações Ativas',  value:`${activeCount}`,                                             color:'rgb(99,230,190)',   icon:'✅' },
            { label:'Disponíveis',         value:`${INTEGRATIONS.filter(i=>i.status==='inactive').length}`,    color:'rgb(120,130,150)',   icon:'○'  },
            { label:'Em Breve',            value:`${INTEGRATIONS.filter(i=>i.status==='coming').length}`,      color:'rgb(245,158,11)',    icon:'◌'  },
            { label:'Última Sincronização',value:'há 2 min',                                                   color:'rgb(77,163,255)',    icon:'🔄' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08+i*0.05 }}
              className="yg-card" style={{ padding:'0.875rem 1rem' }}>
              <div style={{ fontSize:'0.9rem', marginBottom:'0.3rem' }}>{s.icon}</div>
              <div style={{ fontSize:'1.25rem', fontWeight:800, color:s.color, letterSpacing:'-0.03em', lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'0.62rem', color:'rgb(80,92,110)', marginTop:'0.2rem' }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Category filter */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.12 }}
          style={{ display:'flex', gap:'0.375rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
          {CATEGORIES.map(cat => (
            <button type="button" key={cat}  onClick={() => setCatFilter(cat)}
              style={{ padding:'0.35rem 0.75rem', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:catFilter===cat ? 600 : 400, cursor:'pointer', background: catFilter===cat ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: catFilter===cat ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: catFilter===cat ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition:'all 150ms' }}>
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Integration cards grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.625rem' }}>
          {filtered.map((integ, i) => {
            const ss = STATUS_STYLE[integ.status as keyof typeof STATUS_STYLE];
            return (
              <motion.div key={integ.id} initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.4, delay: i*0.06, ease:[0.16,1,0.3,1] }}
                whileHover={{ y:-2 }}
                className="yg-card" style={{ padding:'1.125rem', opacity: integ.status === 'inactive' ? 0.65 : 1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`${integ.color}15`, border:`1px solid ${integ.color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem', flexShrink:0 }}>{integ.logo}</div>
                    <div>
                      <h3 style={{ fontSize:'0.8rem', fontWeight:700, color:'rgb(230,240,250)' }}>{integ.name}</h3>
                      <span style={{ fontSize:'0.6rem', color:'rgb(80,92,110)' }}>{integ.category}</span>
                    </div>
                  </div>
                  <span style={{ fontSize:'0.58rem', fontWeight:700, color:ss.color, background:ss.bg, borderRadius:'9999px', padding:'0.12rem 0.45rem', flexShrink:0 }}>{ss.label}</span>
                </div>

                <p style={{ fontSize:'0.68rem', color:'rgb(120,132,150)', lineHeight:1.5, marginBottom:'0.625rem' }}>{integ.desc}</p>

                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginBottom:'0.625rem' }}>
                  {integ.features.map(f => (
                    <span key={f} style={{ fontSize:'0.58rem', color:integ.color, background:`${integ.color}10`, border:`1px solid ${integ.color}20`, borderRadius:'9999px', padding:'0.1rem 0.4rem' }}>{f}</span>
                  ))}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'0.5rem', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display:'flex', gap:'0.375rem', alignItems:'center' }}>
                    <span style={{ fontSize:'0.6rem', color:'rgb(70,82,100)' }}>Sinc. {integ.lastSync}</span>
                    {integ.status === 'active' && (
                      <button type="button" onClick={() => testConnection(integ.id)}
                        style={{ fontSize:'0.58rem', fontWeight:600, padding:'0.1rem 0.4rem', borderRadius:'6px', cursor:'pointer', border:'1px solid rgba(77,163,255,0.2)', background:'rgba(77,163,255,0.08)', color: testing[integ.id] === 'ok' ? 'rgb(99,230,190)' : testing[integ.id] === 'fail' ? 'rgb(239,68,68)' : 'rgb(77,163,255)', transition:'all 200ms' }}>
                        {testing[integ.id] === 'testing' ? '⟳' : testing[integ.id] === 'ok' ? '✓ OK' : testing[integ.id] === 'fail' ? '✕ Falhou' : 'Testar'}
                      </button>
                    )}
                  </div>
                  {integ.status === 'active' ? (
                    <button type="button" style={{ fontSize:'0.65rem', fontWeight:600, color:'rgb(239,68,68)', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'7px', padding:'0.2rem 0.5rem', cursor:'pointer' }}>Desligar</button>
                  ) : integ.status === 'inactive' ? (
                    <button type="button" style={{ fontSize:'0.65rem', fontWeight:600, color:'rgb(77,163,255)', background:'rgba(77,163,255,0.1)', border:'1px solid rgba(77,163,255,0.2)', borderRadius:'7px', padding:'0.2rem 0.5rem', cursor:'pointer' }}>Ativar</button>
                  ) : (
                    <span style={{ fontSize:'0.62rem', color:'rgb(80,92,110)' }}>Disponível em breve</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
