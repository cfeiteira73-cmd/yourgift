'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

const SUPPLIERS = [
  {
    id: 'midocean', name: 'Midocean', logo: '🌊', status: 'active',
    description: 'Líder europeu em merchandising corporativo. +50.000 produtos de marca.',
    products: 52341, categories: 18, minOrder: 25, deliveryDays: '5–10',
    color: 'rgb(77,163,255)', strengths: ['Têxteis', 'Tecnologia', 'Escritório', 'Desporto'],
  },
  {
    id: 'pfconcept', name: 'PF Concept', logo: '🎯', status: 'active',
    description: 'Especialistas em produtos sustentáveis e merchandising premium eco-friendly.',
    products: 28700, categories: 12, minOrder: 50, deliveryDays: '7–14',
    color: 'rgb(99,230,190)', strengths: ['Ecológico', 'Bebidas', 'Bags', 'Outdoor'],
  },
  {
    id: 'maxema', name: 'Maxema', logo: '✨', status: 'active',
    description: 'Especialistas em canetas e artigos de escrita premium personalizados.',
    products: 8200, categories: 6, minOrder: 100, deliveryDays: '10–15',
    color: 'rgb(167,139,250)', strengths: ['Canetas', 'Escrita', 'Premium', 'Gift sets'],
  },
  {
    id: 'xindao', name: 'Xindao', logo: '🏮', status: 'active',
    description: 'Vasta gama de produtos únicos e inovadores para merchandising criativo.',
    products: 15600, categories: 10, minOrder: 30, deliveryDays: '8–12',
    color: 'rgb(245,158,11)', strengths: ['Inovação', 'Design', 'Lifestyle', 'Tecnologia'],
  },
  {
    id: 'custom', name: 'Produção Própria', logo: '🏭', status: 'active',
    description: 'Produção nacional de alta qualidade com controlo total do processo.',
    products: null, categories: 5, minOrder: 200, deliveryDays: '15–21',
    color: 'rgb(239,68,68)', strengths: ['Qualidade', 'Made in PT', 'Custom', 'Exclusivo'],
  },
  {
    id: 'stanley', name: 'Stanley/Stella', logo: '👕', status: 'coming',
    description: 'Vestuário orgânico premium. Fair Wear Foundation certificado.',
    products: 4200, categories: 4, minOrder: 50, deliveryDays: '12–18',
    color: 'rgb(116,231,255)', strengths: ['Orgânico', 'Ético', 'Vestuário', 'GOTS'],
  },
];

const STATS_GLOBAL = [
  { label: 'Fornecedores Ativos', value: '5',       color: 'rgb(77,163,255)',   icon: '🏭' },
  { label: 'Produtos Disponíveis', value: '100K+',  color: 'rgb(99,230,190)',   icon: '📦' },
  { label: 'Categorias',           value: '55',      color: 'rgb(245,158,11)',   icon: '🗂️' },
  { label: 'Entrega Média',        value: '8 dias',  color: 'rgb(167,139,250)', icon: '🚚' },
];

export default function SuppliersPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/suppliers'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
    }
    load();
  }, [router]);

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding:'1.5rem 2rem 3rem', maxWidth:'1000px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Fornecedores</h1>
          <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>Rede global de fornecedores parceiros certificados</p>
        </motion.div>

        {/* Global stats */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem', marginBottom:'1.5rem' }}>
          {STATS_GLOBAL.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.08 + i*0.05 }}
              className="yg-card" style={{ padding:'1rem 1.125rem' }}>
              <div style={{ fontSize:'0.9rem', marginBottom:'0.375rem' }}>{s.icon}</div>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:s.color, letterSpacing:'-0.04em', lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'0.65rem', color:'rgb(80,92,110)', marginTop:'0.2rem' }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Supplier grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem' }}>
          {SUPPLIERS.map((sup, i) => (
            <motion.div key={sup.id} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.45, delay: 0.1 + i*0.07, ease:[0.16,1,0.3,1] }}
              whileHover={{ y:-2 }}
              className="yg-card" style={{ padding:'1.25rem', position:'relative', overflow:'hidden' }}>
              {/* Status badge */}
              <div style={{ position:'absolute', top:'0.875rem', right:'0.875rem' }}>
                <span style={{ fontSize:'0.58rem', fontWeight:700, padding:'0.15rem 0.45rem', borderRadius:'9999px',
                  color: sup.status === 'active' ? 'rgb(99,230,190)' : 'rgb(245,158,11)',
                  background: sup.status === 'active' ? 'rgba(99,230,190,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${sup.status === 'active' ? 'rgba(99,230,190,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                  {sup.status === 'active' ? '● Ativo' : '◌ Em breve'}
                </span>
              </div>

              {/* Logo + name */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', marginBottom:'0.875rem' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${sup.color}15`, border:`1px solid ${sup.color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>
                  {sup.logo}
                </div>
                <div>
                  <h3 style={{ fontSize:'0.9rem', fontWeight:800, color:'rgb(245,247,251)' }}>{sup.name}</h3>
                  <p style={{ fontSize:'0.62rem', color:'rgb(80,92,110)' }}>{sup.products ? `${sup.products.toLocaleString('pt-PT')} produtos` : 'Sob medida'}</p>
                </div>
              </div>

              <p style={{ fontSize:'0.72rem', color:'rgb(130,142,160)', lineHeight:1.5, marginBottom:'0.875rem' }}>{sup.description}</p>

              {/* Strengths */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.875rem' }}>
                {sup.strengths.map(s => (
                  <span key={s} style={{ fontSize:'0.6rem', fontWeight:600, color:sup.color, background:`${sup.color}12`, border:`1px solid ${sup.color}25`, borderRadius:'9999px', padding:'0.15rem 0.45rem' }}>{s}</span>
                ))}
              </div>

              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', paddingTop:'0.75rem', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize:'0.6rem', color:'rgb(70,82,100)' }}>Mín. encomenda</div>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color:sup.color }}>{sup.minOrder} un.</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.6rem', color:'rgb(70,82,100)' }}>Prazo entrega</div>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color:sup.color }}>{sup.deliveryDays} dias</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
