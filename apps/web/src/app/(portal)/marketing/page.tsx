'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Phase 11: Marketing Intelligence ─────────────────────────────────────────
// Real order data + AI Campaign Brief Generator + personalized recommendations

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }
interface Order { id: string; status: string; total_amount: number | null; created_at: string; }

const CAMPAIGN_TEMPLATES = [
  { id: 1, name: 'Kit Boas-Vindas Corporativo', status: 'active', type: 'Onboarding', reach: '250 colaboradores', icon: '🎁', color: 'rgb(99,230,190)', budget: '€3.200', start: 'Jan 2025' },
  { id: 2, name: 'Evento Anual TechSummit 2025', status: 'planned', type: 'Evento', reach: '500 convidados', icon: '🏆', color: 'rgb(77,163,255)', budget: '€8.500', start: 'Jun 2025' },
  { id: 3, name: 'Merchandising Verão', status: 'draft', type: 'Sazonal', reach: 'Todos os clientes', icon: '☀️', color: 'rgb(245,158,11)', budget: '€2.100', start: 'Jul 2025' },
  { id: 4, name: 'Programa Fidelização VIP', status: 'active', type: 'Fidelização', reach: '45 clientes VIP', icon: '⭐', color: 'rgb(167,139,250)', budget: '€5.600', start: 'Mar 2025' },
];

const STATUS_CFG = {
  active:  { label: 'Ativa',    color: 'rgb(99,230,190)',  bg: 'rgba(99,230,190,0.1)'  },
  planned: { label: 'Planeada', color: 'rgb(77,163,255)',  bg: 'rgba(77,163,255,0.1)'  },
  draft:   { label: 'Rascunho', color: 'rgb(120,130,150)', bg: 'rgba(120,130,150,0.1)' },
  ended:   { label: 'Terminada',color: 'rgb(60,72,90)',    bg: 'rgba(60,72,90,0.1)'    },
};

const PROMO_TOOLS = [
  { icon: '📊', label: 'Relatório de Campanha', desc: 'Analisa o ROI e impacto', action: 'Ver relatório', href: '/reports', color: 'rgb(77,163,255)' },
  { icon: '🎨', label: 'Kit de Design', desc: 'Templates prontos a usar', action: 'Explorar kits', href: '/assets', color: 'rgb(99,230,190)' },
  { icon: '📦', label: 'Catálogo de Promoções', desc: 'Produtos com melhores margens', action: 'Ver catálogo', href: '/products', color: 'rgb(245,158,11)' },
  { icon: '💌', label: 'Orçamento de Campanha', desc: 'Pede um orçamento personalizado', action: 'Pedir agora', href: '/quotes/new', color: 'rgb(167,139,250)' },
];

const IDEAS = [
  { icon: '🎄', title: 'Kit de Natal 2025', desc: 'Ofereças únicas com branding premium para a época festiva', tag: 'Sazonal', prompt: 'Kit de Natal 2025 com branding premium para 150 colaboradores' },
  { icon: '🏃', title: 'Merch Desportivo', desc: 'Equipamentos personalizados para equipas e eventos corporativos', tag: 'Tendência', prompt: 'Merchandising desportivo para equipa corporativa de 80 pessoas' },
  { icon: '🌿', title: 'Linha Eco Premium', desc: 'Produtos sustentáveis certificados com storytelling de marca', tag: 'Sustentável', prompt: 'Linha eco-friendly premium com certificações ambientais para rebranding' },
  { icon: '💻', title: 'Kit Home Office', desc: 'Artigos ergonômicos e tech para equipas em trabalho remoto', tag: 'Popular', prompt: 'Kit home office ergonómico para equipas remotas de alta performance' },
];

// ── AI Campaign Brief Generator ───────────────────────────────────────────────

function AIBriefGenerator({ companyName }: { companyName: string | null }) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate(customPrompt?: string) {
    const p = (customPrompt ?? prompt).trim();
    if (!p || loading) return;
    if (customPrompt) setPrompt(customPrompt);
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skipContext: true,
          messages: [{
            role: 'user',
            content: `MARKETING BRIEF REQUEST${companyName ? ` para ${companyName}` : ''}:
${p}

Cria um brief completo de campanha de merchandising com:
1. **Conceito central** (2-3 frases com o posicionamento)
2. **Produtos recomendados** (3-5 produtos específicos)
3. **Paleta e estilo visual** (cores, tipografia, mood)
4. **Canais de distribuição** sugeridos
5. **Budget estimado** e ROI esperado
6. **Timeline** de produção (em semanas)

Tom: profissional e criativo. Responde em Português de Portugal.`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content?: string };
        setResult(data.content ?? 'Sem resposta do assistente.');
      }
    } catch {
      setResult('Erro ao gerar brief. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(77,163,255,0.06) 0%, rgba(99,230,190,0.04) 100%)', border: '1px solid rgba(77,163,255,0.18)', borderRadius: '16px', padding: '1.375rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.125rem' }}>✦</span>
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 800, color: 'rgb(210,220,235)' }}>AI Campaign Brief Generator</p>
          <p style={{ fontSize: '0.68rem', color: 'rgb(80,92,110)' }}>Descreve a tua campanha e recebe um brief completo com produtos, timeline e budget estimado</p>
        </div>
      </div>

      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
        placeholder="Ex: Queremos presentear 300 colaboradores com kits de boas-vindas premium para o início do ano fiscal..."
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.75rem', color: 'rgb(210,220,235)', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.625rem' }}
      />

      {/* Quick idea chips */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        {IDEAS.map(idea => (
          <button type="button" key={idea.title}  onClick={() => generate(idea.prompt)}
            style={{ padding: '0.22rem 0.6rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 500, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(120,130,150)', transition: 'all 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.4)'; (e.currentTarget as HTMLElement).style.color = 'rgb(77,163,255)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgb(120,130,150)'; }}>
            {idea.icon} {idea.title}
          </button>
        ))}
      </div>

      <motion.button type="button" onClick={() => generate()} disabled={!prompt.trim() || loading} whileTap={{ scale: 0.97 }}
        style={{ padding: '0.55rem 1.25rem', borderRadius: '9px', fontSize: '0.78rem', fontWeight: 700, cursor: prompt.trim() && !loading ? 'pointer' : 'not-allowed', background: prompt.trim() && !loading ? 'linear-gradient(135deg, rgb(77,163,255), rgb(99,230,190))' : 'rgba(255,255,255,0.06)', color: prompt.trim() && !loading ? '#fff' : 'rgb(80,92,110)', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 200ms', marginBottom: result ? '0.875rem' : 0 }}>
        {loading ? (
          <><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> A gerar brief...</>
        ) : '✦ Gerar Brief de Campanha'}
      </motion.button>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(77,163,255)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Brief Gerado</p>
              <button type="button" onClick={() => setResult('')} style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', background: 'none', border: 'none', cursor: 'pointer' }}>× limpar</button>
            </div>
            <pre style={{ fontSize: '0.76rem', color: 'rgb(195,210,230)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', margin: 0, marginBottom: '0.875rem' }}>{result}</pre>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link href="/quotes/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.875rem', borderRadius: '8px', background: 'rgba(77,163,255,0.15)', border: '1px solid rgba(77,163,255,0.25)', color: 'rgb(77,163,255)', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none' }}>
                → Pedir Orçamento
              </Link>
              <Link href="/products" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.875rem', borderRadius: '8px', background: 'rgba(99,230,190,0.12)', border: '1px solid rgba(99,230,190,0.2)', color: 'rgb(99,230,190)', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none' }}>
                → Ver Catálogo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/marketing'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c as ClientProfile);
        const { data: ordersData } = await supabase.from('orders').select('id,status,total_amount,created_at').eq('client_id', (c as ClientProfile).id).order('created_at', { ascending: false });
        setOrders((ordersData ?? []) as Order[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const stats = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'cancelled' && o.total_amount);
    const totalSpend = valid.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = valid.filter(o => o.created_at >= thisMonthStart).reduce((s, o) => s + (o.total_amount ?? 0), 0);
    return { totalSpend, activeOrders, deliveredOrders, thisMonth };
  }, [orders]);

  function fmtEur(n: number) {
    if (n >= 1000) return `€${(n / 1000).toFixed(1).replace('.0', '')}k`;
    return `€${n.toFixed(0)}`;
  }

  const tierColor = client?.tier === 'premium' ? 'rgb(245,158,11)' : client?.tier === 'enterprise' ? 'rgb(167,139,250)' : client?.tier === 'vip' ? 'rgb(99,230,190)' : 'rgb(77,163,255)';
  const tierLabel = client?.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : 'Standard';

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1000px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Marketing & Promoções</h1>
            <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Campanhas de merchandising e estratégia de marca{client?.company ? ` · ${client.company}` : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {client?.tier && (
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}30` }}>{tierLabel}</span>
            )}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link href="/quotes/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', color: '#fff', padding: '0.5rem 1.125rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(77,163,255,0.25)' }}>
                + Nova Campanha
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Real spend KPIs (only if has order history) */}
        {!loading && orders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total investido', value: fmtEur(stats.totalSpend), color: 'rgb(99,230,190)', icon: '💰' },
              { label: 'Este mês', value: fmtEur(stats.thisMonth), color: 'rgb(77,163,255)', icon: '📅' },
              { label: 'Encomendas ativas', value: String(stats.activeOrders), color: 'rgb(245,158,11)', icon: '📦' },
              { label: 'Entregues', value: String(stats.deliveredOrders), color: 'rgb(167,139,250)', icon: '✓' },
            ].map((k, i) => (
              <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '0.875rem 1rem' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>{k.icon}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: k.color, letterSpacing: '-0.03em' }}>{k.value}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)', marginTop: '0.15rem' }}>{k.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* AI Brief Generator */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <AIBriefGenerator companyName={client?.company ?? null} />
        </motion.div>

        {/* Campaigns */}
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Campanhas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.5rem' }}>
          {CAMPAIGN_TEMPLATES.map((c, i) => {
            const sc = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                className="yg-card" style={{ padding: '1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${c.color}15`, border: `1px solid ${c.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>{c.icon}</div>
                    <div>
                      <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(230,240,250)' }}>{c.name}</h3>
                      <span style={{ fontSize: '0.62rem', color: 'rgb(80,92,110)' }}>{c.type} · desde {c.start}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: '9999px', padding: '0.15rem 0.45rem', flexShrink: 0 }}>{sc.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'rgb(70,82,100)' }}>Alcance</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: c.color }}>{c.reach}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6rem', color: 'rgb(70,82,100)' }}>Budget</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(99,230,190)' }}>{c.budget}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Tools */}
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Ferramentas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem', marginBottom: '1.5rem' }}>
          {PROMO_TOOLS.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
              className="yg-card" style={{ padding: '1.125rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.625rem' }}>{t.icon}</div>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(220,230,245)', marginBottom: '0.375rem' }}>{t.label}</h3>
              <p style={{ fontSize: '0.68rem', color: 'rgb(90,102,120)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{t.desc}</p>
              <Link href={t.href} style={{ fontSize: '0.7rem', fontWeight: 700, color: t.color, textDecoration: 'none' }}>{t.action} →</Link>
            </motion.div>
          ))}
        </div>

        {/* Ideas */}
        <h2 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(160,175,195)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Ideias para a tua próxima campanha
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem' }}>
          {IDEAS.map((idea, i) => (
            <motion.div key={idea.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              whileHover={{ y: -2 }}
              className="yg-card" style={{ padding: '1rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{idea.icon}</div>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.1)', borderRadius: '9999px', padding: '0.1rem 0.4rem', marginBottom: '0.5rem', display: 'inline-block' }}>{idea.tag}</span>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(220,230,245)', marginBottom: '0.375rem', lineHeight: 1.3 }}>{idea.title}</h3>
              <p style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{idea.desc}</p>
              <Link href="/quotes/new" style={{ display: 'block', fontSize: '0.68rem', color: 'rgb(77,163,255)', textDecoration: 'none', fontWeight: 600 }}>Pedir orçamento →</Link>
            </motion.div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
