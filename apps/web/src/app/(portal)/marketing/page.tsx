'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

const CAMPAIGNS = [
  { id:1, name:'Kit Boas-Vindas Corporativo', status:'active', type:'Onboarding', reach:'250 colaboradores', icon:'🎁', color:'rgb(99,230,190)', budget:'€3.200', start:'Jan 2025' },
  { id:2, name:'Evento Anual TechSummit 2025', status:'planned', type:'Evento', reach:'500 convidados', icon:'🏆', color:'rgb(77,163,255)', budget:'€8.500', start:'Jun 2025' },
  { id:3, name:'Merchandising Verão', status:'draft', type:'Sazonal', reach:'Todos os clientes', icon:'☀️', color:'rgb(245,158,11)', budget:'€2.100', start:'Jul 2025' },
  { id:4, name:'Programa Fidelização VIP', status:'active', type:'Fidelização', reach:'45 clientes VIP', icon:'⭐', color:'rgb(167,139,250)', budget:'€5.600', start:'Mar 2025' },
];

const PROMO_TOOLS = [
  { icon:'📊', label:'Relatório de Campanha', desc:'Analisa o ROI e impacto', action:'Ver relatório', href:'/reports', color:'rgb(77,163,255)' },
  { icon:'🎨', label:'Kit de Design', desc:'Templates prontos a usar', action:'Explorar kits', href:'/assets', color:'rgb(99,230,190)' },
  { icon:'📦', label:'Catálogo de Promoções', desc:'Produtos com melhores margens', action:'Ver catálogo', href:'/products', color:'rgb(245,158,11)' },
  { icon:'💌', label:'Orçamento de Campanha', desc:'Pede um orçamento personalizado', action:'Pedir agora', href:'/quotes/new', color:'rgb(167,139,250)' },
];

const STATUS_CFG = {
  active:  { label:'Ativa',   color:'rgb(99,230,190)',  bg:'rgba(99,230,190,0.1)'  },
  planned: { label:'Planeada',color:'rgb(77,163,255)',  bg:'rgba(77,163,255,0.1)'  },
  draft:   { label:'Rascunho',color:'rgb(120,130,150)', bg:'rgba(120,130,150,0.1)' },
  ended:   { label:'Terminada',color:'rgb(60,72,90)',   bg:'rgba(60,72,90,0.1)'    },
};

const IDEAS = [
  { icon:'🎄', title:'Kit de Natal 2025', desc:'Ofereças únicas com branding premium para a época festiva', tag:'Sazonal' },
  { icon:'🏃', title:'Merch Desportivo', desc:'Equipamentos personalizados para equipas e eventos corporativos', tag:'Tendência' },
  { icon:'🌿', title:'Linha Eco Premium', desc:'Produtos sustentáveis certificados com storytelling de marca', tag:'Sustentável' },
  { icon:'💻', title:'Kit Home Office', desc:'Artigos ergonômicos e tech para equipas em trabalho remoto', tag:'Popular' },
];

export default function MarketingPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/marketing'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
    }
    load();
  }, [router]);

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <div style={{ padding:'1.5rem 2rem 3rem', maxWidth:'1000px' }}>

        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'rgb(245,247,251)', letterSpacing:'-0.03em', marginBottom:'0.2rem' }}>Marketing & Promoções</h1>
            <p style={{ fontSize:'0.78rem', color:'rgb(80,92,110)' }}>Campanhas de merchandising e estratégia de marca</p>
          </div>
          <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
            <Link href="/quotes/new" style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', background:'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', color:'#fff', padding:'0.5rem 1.125rem', borderRadius:'10px', fontSize:'0.82rem', fontWeight:700, textDecoration:'none', boxShadow:'0 4px 14px rgba(77,163,255,0.25)' }}>
              + Nova Campanha
            </Link>
          </motion.div>
        </motion.div>

        {/* Campaigns */}
        <h2 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(160,175,195)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>Campanhas</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.625rem', marginBottom:'1.5rem' }}>
          {CAMPAIGNS.map((c, i) => {
            const sc = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
            return (
              <motion.div key={c.id} initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.4, delay: i*0.07, ease:[0.16,1,0.3,1] }}
                whileHover={{ y:-2 }}
                className="yg-card" style={{ padding:'1.125rem' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.625rem' }}>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:`${c.color}15`, border:`1px solid ${c.color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.125rem', flexShrink:0 }}>{c.icon}</div>
                    <div>
                      <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(230,240,250)' }}>{c.name}</h3>
                      <span style={{ fontSize:'0.62rem', color:'rgb(80,92,110)' }}>{c.type} · desde {c.start}</span>
                    </div>
                  </div>
                  <span style={{ fontSize:'0.6rem', fontWeight:700, color:sc.color, background:sc.bg, borderRadius:'9999px', padding:'0.15rem 0.45rem', flexShrink:0 }}>{sc.label}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.625rem', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize:'0.6rem', color:'rgb(70,82,100)' }}>Alcance</div>
                    <div style={{ fontSize:'0.72rem', fontWeight:600, color:c.color }}>{c.reach}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.6rem', color:'rgb(70,82,100)' }}>Budget</div>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:'rgb(99,230,190)' }}>{c.budget}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Promo tools */}
        <h2 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(160,175,195)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>Ferramentas</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem', marginBottom:'1.5rem' }}>
          {PROMO_TOOLS.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: 0.2+i*0.06 }}
              className="yg-card" style={{ padding:'1.125rem' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.625rem' }}>{t.icon}</div>
              <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(220,230,245)', marginBottom:'0.375rem' }}>{t.label}</h3>
              <p style={{ fontSize:'0.68rem', color:'rgb(90,102,120)', marginBottom:'0.75rem', lineHeight:1.5 }}>{t.desc}</p>
              <Link href={t.href} style={{ fontSize:'0.7rem', fontWeight:700, color:t.color, textDecoration:'none' }}>{t.action} →</Link>
            </motion.div>
          ))}
        </div>

        {/* Ideas */}
        <h2 style={{ fontSize:'0.82rem', fontWeight:700, color:'rgb(160,175,195)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>Ideias para a tua próxima campanha</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem' }}>
          {IDEAS.map((idea, i) => (
            <motion.div key={idea.title} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: 0.3+i*0.07 }}
              whileHover={{ y:-2 }}
              className="yg-card" style={{ padding:'1rem', cursor:'pointer' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem' }}>{idea.icon}</div>
              <span style={{ fontSize:'0.58rem', fontWeight:700, color:'rgb(77,163,255)', background:'rgba(77,163,255,0.1)', borderRadius:'9999px', padding:'0.1rem 0.4rem', marginBottom:'0.5rem', display:'inline-block' }}>{idea.tag}</span>
              <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'rgb(220,230,245)', marginBottom:'0.375rem', lineHeight:1.3 }}>{idea.title}</h3>
              <p style={{ fontSize:'0.65rem', color:'rgb(80,92,110)', lineHeight:1.5 }}>{idea.desc}</p>
              <Link href="/quotes/new" style={{ display:'block', marginTop:'0.75rem', fontSize:'0.68rem', color:'rgb(77,163,255)', textDecoration:'none', fontWeight:600 }}>Pedir orçamento →</Link>
            </motion.div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
