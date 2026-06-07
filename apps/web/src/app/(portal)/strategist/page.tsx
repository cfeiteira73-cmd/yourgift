'use client';

// ── OMEGA PROTOCOL — S18: AI Merchandising Strategist ────────────────────────
//
// Procurement memory graph · Autonomous supplier optimizer
// Predictive catalogue recommendations · Campaign intelligence
// Strategic briefing engine powered by Claude
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, fadeUp, delayedFadeUp, tapScale, staggerContainer, staggerItem } from '@/lib/motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }
interface Insight { id: string; type: string; title: string; body: string; severity: 'info' | 'warning' | 'critical' | 'success'; value?: string; }
interface MemoryData {
  totalOrders: number; avgOrderValue: number; avgDaysBetweenOrders: number;
  last30Revenue: number; prev30Revenue: number; spendTrend: number;
  nextOrderDue: string | null; quoteConversionRate: number;
}
interface Forecast { trend: string; slope: number; forecast: Array<{ week: number; label: string; predicted: number; adjustedPredicted: number; confidence: number }>; pipelineContribution: number; }
interface Product { id: string; name: string; unit_price: number | null; category?: string; min_qty?: number | null; images?: string[] | null; }

const QUICK_PROMPTS = [
  { label: '📊 Análise de performance', prompt: 'Analisa a minha performance de compras recente e sugere melhorias estratégicas baseadas nos dados.' },
  { label: '🎁 Sugestões de produtos', prompt: 'Com base no meu historial de encomendas e perfil de empresa, que produtos do catálogo recomendas para a próxima campanha?' },
  { label: '📅 Planear próxima campanha', prompt: 'Ajuda-me a planear a próxima campanha de merchandising com orçamento otimizado, timing ideal e mix de produtos.' },
  { label: '💡 Oportunidades de poupança', prompt: 'Identifica oportunidades de redução de custos e otimização de procurement no meu padrão de encomendas.' },
  { label: '🌱 Produtos sustentáveis', prompt: 'Quais os produtos eco-friendly e sustentáveis do catálogo mais adequados para o perfil da minha empresa?' },
  { label: '🚀 Estratégia Q4', prompt: 'Cria uma estratégia de merchandising para o Q4, considerando épocas festivas, lead times e orçamento típico.' },
];

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function SeverityDot({ s }: { s: string }) {
  const colors: Record<string, string> = { success: '#b8975e', info: '#d4b47a', warning: 'rgb(245,158,11)', critical: 'rgb(239,68,68)' };
  return <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: colors[s] ?? 'rgba(240,236,228,0.42)', flexShrink: 0 }} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StrategistPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'memory' | 'forecast' | 'catalogue'>('insights');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/strategist'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);

      // Load brain data in parallel
      const [insightsRes, memoryRes, forecastRes, catalogueRes] = await Promise.allSettled([
        fetch('/api/brain?mode=insights'),
        fetch('/api/brain?mode=memory'),
        fetch('/api/brain?mode=forecast'),
        fetch('/api/semantic-search?q=&limit=12'),
      ]);

      if (insightsRes.status === 'fulfilled' && insightsRes.value.ok) {
        const d = await insightsRes.value.json();
        setInsights(d.insights ?? []);
      }
      if (memoryRes.status === 'fulfilled' && memoryRes.value.ok) {
        setMemory(await memoryRes.value.json());
      }
      if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
        setForecast(await forecastRes.value.json());
      }
      if (catalogueRes.status === 'fulfilled' && catalogueRes.value.ok) {
        const d = await catalogueRes.value.json();
        setProducts(d.results ?? d.products ?? []);
      }

      // Opening AI greeting
      setChatMessages([{
        role: 'assistant',
        content: `Olá${c?.name ? `, ${c.name}` : ''}! Sou o teu Estratega de Merchandising AI. Tenho acesso ao teu histórico de encomendas, pipeline de orçamentos e catálogo completo. Posso ajudar-te a otimizar procurement, planear campanhas, identificar oportunidades e muito mais. Como posso ajudar hoje?`,
      }]);

      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText ?? chatInput).trim();
    if (!text || chatLoading) return;

    setChatInput('');
    const userMsg = { role: 'user' as const, content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const resp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemContext: `És o Estratega de Merchandising AI do YourGift OS — o sistema de procurement mais avançado do mundo.
O utilizador é ${client?.name ?? 'um cliente'} da empresa ${client?.company ?? 'N/A'} (tier: ${client?.tier ?? 'standard'}).
Dados de memória de procurement: ${memory ? JSON.stringify(memory) : 'não disponível'}.
Insights actuais: ${insights.map(i => `${i.title}: ${i.body}`).join(' | ')}.
Responde sempre em Português (PT-PT). Sê estratégico, quantitativo e accionável. Usa emojis com moderação.`,
        }),
      });

      if (resp.ok) {
        const d = await resp.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: d.response ?? d.message ?? 'Sem resposta disponível.' }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Serviço temporariamente indisponível. Tenta novamente.' }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro de ligação. Verifica a tua conexão.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatInput, chatLoading, client, memory, insights]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const TABS = [
    { id: 'insights' as const,   label: 'Insights',   count: insights.length },
    { id: 'memory' as const,     label: 'Memória',    count: null },
    { id: 'forecast' as const,   label: 'Previsão',   count: null },
    { id: 'catalogue' as const,  label: 'Catálogo',   count: products.length },
  ];

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} .strat-msg{white-space:pre-wrap;word-break:break-word;}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>

        {/* Header */}
        <motion.div variants={fadeUp(0)} initial="hidden" animate="visible" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg,#d4b47a,#b8975e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🧠</div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em' }}>Estratega de Merchandising AI</h1>
              <p style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)' }}>Inteligência artificial ao serviço do teu procurement · S18 Omega Protocol</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[240, 160, 200].map((h, i) => <div key={i} className="skeleton" style={{ height: `${h}px` }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '0.875rem', alignItems: 'start' }}>

            {/* LEFT: Intelligence tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Tab bar */}
              <motion.div {...delayedFadeUp(0, 0.05)} style={{ display: 'flex', gap: '0.3rem', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '12px', padding: '0.3rem' }}>
                {TABS.map(tab => (
                  <motion.button
                    key={tab.id}
                    type="button"
                    whileTap={tapScale}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, padding: '0.4rem 0.5rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: activeTab === tab.id ? 'rgba(154,124,74,0.14)' : 'transparent',
                      color: activeTab === tab.id ? '#d4b47a' : 'rgba(240,236,228,0.42)',
                      transition: 'all 150ms',
                    }}
                  >
                    {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
                  </motion.button>
                ))}
              </motion.div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ ...springSnappy }}
                  className="yg-card"
                  style={{ padding: '1.125rem' }}
                >

                  {/* Insights tab */}
                  {activeTab === 'insights' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>INSIGHTS ACTIVOS</span>
                        <span style={{ color: 'rgba(240,236,228,0.24)' }}>{insights.length} total</span>
                      </div>
                      {insights.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Sem dados suficientes para gerar insights.<br/>Cria encomendas para activar a inteligência.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                          {insights.map((ins, i) => (
                            <motion.div
                              key={ins.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ ...springSnappy, delay: i * 0.07 }}
                              style={{ padding: '0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                <SeverityDot s={ins.severity} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(240,236,228,0.75)', flex: 1 }}>{ins.title}</span>
                                {ins.value && <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b8975e', flexShrink: 0 }}>{ins.value}</span>}
                              </div>
                              <p style={{ fontSize: '0.68rem', color: 'rgb(120,132,150)', lineHeight: 1.5, marginLeft: '1rem' }}>{ins.body}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Memory tab */}
                  {activeTab === 'memory' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.75rem' }}>MEMÓRIA DE PROCUREMENT</div>
                      {memory ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {[
                            { label: 'Encomendas totais', value: String(memory.totalOrders) },
                            { label: 'Valor médio', value: fmtEur(memory.avgOrderValue) },
                            { label: 'Intervalo médio', value: memory.avgDaysBetweenOrders > 0 ? `${memory.avgDaysBetweenOrders} dias` : 'N/A' },
                            { label: 'Receita 30 dias', value: fmtEur(memory.last30Revenue) },
                            { label: 'Tendência spend', value: memory.spendTrend >= 0 ? `+${memory.spendTrend}%` : `${memory.spendTrend}%`, color: memory.spendTrend >= 0 ? '#b8975e' : 'rgb(239,68,68)' },
                            { label: 'Conversão orçamentos', value: `${memory.quoteConversionRate}%` },
                            { label: 'Próxima encomenda', value: memory.nextOrderDue ?? 'Sem padrão', span: true },
                          ].map((item, i) => (
                            <div key={item.label} style={{ padding: '0.625rem', background: 'rgba(240,236,228,0.04)', borderRadius: '8px', gridColumn: ('span' in item && item.span) ? 'span 2' : 'span 1' }}>
                              <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>{item.label}</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: ('color' in item && item.color) ? item.color : '#d4b47a', letterSpacing: '-0.02em' }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Dados de memória indisponíveis.</div>
                      )}
                    </div>
                  )}

                  {/* Forecast tab */}
                  {activeTab === 'forecast' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>PREVISÃO 4 SEMANAS</span>
                        {forecast && <span style={{ color: forecast.trend === 'crescimento' ? '#b8975e' : forecast.trend === 'queda' ? 'rgb(239,68,68)' : '#d4b47a', fontWeight: 700 }}>↗ {forecast.trend}</span>}
                      </div>
                      {forecast ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {forecast.forecast.map((w, i) => (
                            <motion.div key={w.week} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springSnappy, delay: i * 0.08 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.42)' }}>{w.label}</span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>conf. {w.confidence}%</span>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b8975e' }}>{fmtEur(w.adjustedPredicted)}</span>
                                </div>
                              </div>
                              <div className="prog-track">
                                <motion.div
                                  className="prog-fill"
                                  style={{ background: `rgba(184,151,94,${0.7 - i * 0.1})` }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min((w.adjustedPredicted / Math.max(...forecast.forecast.map(f => f.adjustedPredicted), 1)) * 100, 100)}%` }}
                                  transition={{ duration: 0.7, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                />
                              </div>
                            </motion.div>
                          ))}
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(240,236,228,0.06)', fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>
                            Pipeline contribui: {fmtEur(forecast.pipelineContribution)}/semana
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Dados insuficientes para previsão.</div>
                      )}
                    </div>
                  )}

                  {/* Catalogue tab */}
                  {activeTab === 'catalogue' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)', marginBottom: '0.75rem' }}>PRODUTOS RECOMENDADOS</div>
                      {products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Catálogo indisponível.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {products.slice(0, 8).map((p, i) => (
                            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSnappy, delay: i * 0.05 }}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.625rem', background: 'rgba(240,236,228,0.04)', borderRadius: '8px', cursor: 'pointer', transition: 'background 150ms' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(154,124,74,0.08)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(240,236,228,0.04)')}
                              onClick={() => sendMessage(`Fala-me sobre o produto "${p.name}" e quando seria adequado para a minha empresa.`)}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                {p.category && <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{p.category}</div>}
                              </div>
                              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                {p.unit_price && <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d4b47a' }}>{fmtEur(p.unit_price)}</div>}
                                {p.min_qty && <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>mín. {p.min_qty}</div>}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            {/* RIGHT: AI Chat */}
            <motion.div {...delayedFadeUp(1, 0.06)} className="yg-card" style={{ display: 'flex', flexDirection: 'column', height: '580px' }}>
              {/* Chat header */}
              <div style={{ padding: '1rem 1.125rem', borderBottom: '1px solid rgba(240,236,228,0.06)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg,#d4b47a,#b8975e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🧠</div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(240,236,228,0.75)' }}>Estratega AI</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="status-pulse status-pulse-green" style={{ width: '5px', height: '5px' }} />
                    <span style={{ fontSize: '0.6rem', color: '#b8975e' }}>Claude · Online</span>
                  </div>
                </div>
              </div>

              {/* Quick prompts */}
              <div style={{ padding: '0.625rem 1rem', borderBottom: '1px solid rgba(240,236,228,0.06)', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {QUICK_PROMPTS.map(qp => (
                  <motion.button
                    key={qp.label}
                    type="button"
                    whileTap={tapScale}
                    onClick={() => sendMessage(qp.prompt)}
                    disabled={chatLoading}
                    style={{ fontSize: '0.62rem', fontWeight: 600, padding: '0.2rem 0.45rem', borderRadius: '7px', cursor: 'pointer', background: 'rgba(240,236,228,0.06)', color: 'rgba(240,236,228,0.42)', border: '1px solid rgba(240,236,228,0.06)', transition: 'all 150ms', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(154,124,74,0.10)'); (e.currentTarget.style.color = '#d4b47a'); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(240,236,228,0.06)'); (e.currentTarget.style.color = 'rgba(240,236,228,0.42)'); }}
                  >
                    {qp.label}
                  </motion.button>
                ))}
              </div>

              {/* Messages */}
              <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '0.875rem 1.125rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springSnappy, delay: 0 }}
                    style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.role === 'user' ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.06)',
                      border: msg.role === 'user' ? '1px solid rgba(154,124,74,0.28)' : '1px solid rgba(240,236,228,0.06)',
                      fontSize: '0.75rem',
                      color: msg.role === 'user' ? 'rgb(220,235,255)' : 'rgb(200,215,235)',
                      lineHeight: 1.55,
                    }}>
                      <p className="strat-msg">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}

                {chatLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '0.5rem' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4b47a', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(240,236,228,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunta ao Estratega AI... (Enter para enviar)"
                  disabled={chatLoading}
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px',
                    padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'rgba(240,236,228,0.75)', outline: 'none', resize: 'none',
                    transition: 'border-color 150ms', lineHeight: 1.45,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(154,124,74,0.35)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
                <motion.button
                  type="button"
                  whileTap={tapScale}
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || chatLoading}
                  style={{
                    width: '40px', height: '40px', borderRadius: '10px', border: 'none', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                    background: chatInput.trim() && !chatLoading ? '#d4b47a' : 'rgba(154,124,74,0.22)',
                    color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 150ms',
                  }}
                >
                  ↑
                </motion.button>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </PortalLayout>
  );
}
