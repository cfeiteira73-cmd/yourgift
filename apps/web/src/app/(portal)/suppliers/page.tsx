'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupplierScore {
  id?: string;
  supplier_name: string;
  overall_score: number;
  quality_score?: number | null;
  delivery_score?: number | null;
  price_score?: number | null;
  communication_score?: number | null;
  flexibility_score?: number | null;
  sustainability_score?: number | null;
  total_orders?: number | null;
  on_time_delivery_rate?: number | null;
  defect_rate?: number | null;
  avg_lead_time_days?: number | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

interface InventoryAlert {
  alert_type: string;
  current_stock: number;
  threshold: number;
}

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

// ── Static supplier metadata (enrich real DB scores with descriptions) ────────

const SUPPLIER_META: Record<string, {
  logo: string; description: string; color: string; strengths: string[];
  products?: number; minOrder: number; deliveryDays: string; status: 'active' | 'coming';
}> = {
  'Midocean': {
    logo: '🌊', color: '#d4b47a',
    description: 'Líder europeu em merchandising corporativo. +2.400 produtos disponíveis.',
    strengths: ['Têxteis', 'Tecnologia', 'Escritório', 'Desporto'],
    products: 2409, minOrder: 25, deliveryDays: '5–10', status: 'active',
  },
  'Makito': {
    logo: '🎯', color: 'rgb(167,139,250)',
    description: 'Fornecedor B2B premium ibérico. +4.500 produtos com impressão personalizada.',
    strengths: ['Brindes', 'Tecnologia', 'Bebidas', 'Escritório'],
    products: 4573, minOrder: 1, deliveryDays: '7–14', status: 'active',
  },
  'PF Concept': {
    logo: '🎯', color: '#b8975e',
    description: 'Especialistas em produtos sustentáveis e merchandising premium eco-friendly.',
    strengths: ['Ecológico', 'Bebidas', 'Bags', 'Outdoor'],
    products: 28700, minOrder: 50, deliveryDays: '7–14', status: 'active',
  },
  'Maxema': {
    logo: '✨', color: 'rgb(167,139,250)',
    description: 'Especialistas em canetas e artigos de escrita premium personalizados.',
    strengths: ['Canetas', 'Escrita', 'Premium', 'Gift sets'],
    products: 8200, minOrder: 100, deliveryDays: '10–15', status: 'active',
  },
  'Xindao': {
    logo: '🏮', color: 'rgb(245,158,11)',
    description: 'Vasta gama de produtos únicos e inovadores para merchandising criativo.',
    strengths: ['Inovação', 'Design', 'Lifestyle', 'Tecnologia'],
    products: 15600, minOrder: 30, deliveryDays: '8–12', status: 'active',
  },
  'Stanley/Stella': {
    logo: '👕', color: '#b8975e',
    description: 'Vestuário orgânico premium. Fair Wear Foundation certificado.',
    strengths: ['Orgânico', 'Ético', 'Vestuário', 'GOTS'],
    products: 4200, minOrder: 50, deliveryDays: '12–18', status: 'coming',
  },
};

const DEFAULT_META = {
  logo: '🏭', color: '#b8975e', status: 'active' as const,
  description: 'Fornecedor parceiro certificado da rede YourGift.',
  strengths: ['Qualidade', 'Prazo', 'Preço', 'Serviço'],
  minOrder: 50, deliveryDays: '7–14',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 85) return '#b8975e';
  if (s >= 70) return '#d4b47a';
  if (s >= 55) return 'rgb(245,158,11)';
  return 'rgb(239,68,68)';
}

function scoreLabel(s: number) {
  if (s >= 85) return 'Excelente';
  if (s >= 70) return 'Bom';
  if (s >= 55) return 'Aceitável';
  return 'Crítico';
}

function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
  const col = scoreColor(score);
  return (
    <div style={{ height: '4px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden', width: '100%' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(score, 100)}%` }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', background: col, borderRadius: '9999px' }}
      />
    </div>
  );
}

function RadarBar({ label, score, delay = 0 }: { label: string; score: number | null | undefined; delay?: number }) {
  if (score == null) return null;
  const col = scoreColor(score);
  return (
    <div style={{ marginBottom: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.18rem' }}>
        <span style={{ fontSize: '0.62rem', color: 'rgb(90,102,120)' }}>{label}</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: col }}>{Math.round(score)}</span>
      </div>
      <div style={{ height: '3px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: col, borderRadius: '9999px' }}
        />
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ supplier, index }: { supplier: SupplierScore; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SUPPLIER_META[supplier.supplier_name] ?? DEFAULT_META;
  const overall = Math.round(supplier.overall_score ?? 0);
  const col = scoreColor(overall);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="yg-card"
      style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', cursor: 'default' }}
    >
      {/* Glow */}
      <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '80px', height: '80px', borderRadius: '50%', background: col, opacity: 0.06, filter: 'blur(20px)', pointerEvents: 'none' }} />

      {/* Status + score badge */}
      <div style={{ position: 'absolute', top: '0.875rem', right: '0.875rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: col, background: `${col}15`, border: `1px solid ${col}30`, borderRadius: '9999px', padding: '0.15rem 0.45rem' }}>
          {overall}/100
        </span>
        <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '9999px',
          color: meta.status === 'active' ? '#b8975e' : 'rgb(245,158,11)',
          background: meta.status === 'active' ? 'rgba(184,151,94,0.10)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${meta.status === 'active' ? 'rgba(99,230,190,0.25)' : 'rgba(245,158,11,0.25)'}`,
        }}>
          {meta.status === 'active' ? '● Ativo' : '◌ Em breve'}
        </span>
      </div>

      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', paddingRight: '5rem' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '13px', background: `${meta.color}15`, border: `1px solid ${meta.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
          {meta.logo}
        </div>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f0ece4', marginBottom: '0.1rem' }}>{supplier.supplier_name}</h3>
          <p style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)' }}>
            {meta.products ? `${meta.products.toLocaleString('pt-PT')} produtos` : 'Sob medida'} · Mín. {meta.minOrder} un.
          </p>
        </div>
      </div>

      {/* Overall score bar */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgb(90,102,120)', fontWeight: 600 }}>Score Global</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: col }}>{scoreLabel(overall)}</span>
        </div>
        <ScoreBar score={overall} delay={0.15 + index * 0.05} />
      </div>

      <p style={{ fontSize: '0.72rem', color: 'rgb(130,142,160)', lineHeight: 1.5, marginBottom: '0.875rem' }}>{meta.description}</p>

      {/* Strengths */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.875rem' }}>
        {meta.strengths.map(s => (
          <span key={s} style={{ fontSize: '0.6rem', fontWeight: 600, color: meta.color, background: `${meta.color}12`, border: `1px solid ${meta.color}25`, borderRadius: '9999px', padding: '0.15rem 0.45rem' }}>{s}</span>
        ))}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(240,236,228,0.06)', marginBottom: '0.75rem' }}>
        {[
          { label: 'Prazo entrega', value: meta.deliveryDays + ' dias', color: meta.color },
          { label: 'On-time rate', value: supplier.on_time_delivery_rate != null ? `${Math.round(supplier.on_time_delivery_rate)}%` : '—', color: supplier.on_time_delivery_rate != null ? scoreColor(supplier.on_time_delivery_rate) : 'rgba(240,236,228,0.24)' },
          { label: 'Lead time', value: supplier.avg_lead_time_days != null ? `${supplier.avg_lead_time_days}d` : meta.deliveryDays.split('–')[0] + 'd', color: '#b8975e' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.15rem' }}>{s.label}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Expand toggle for breakdown */}
      <button type="button"
        
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', fontWeight: 600 }}
      >
        {expanded ? '▲ Ocultar breakdown' : '▼ Ver breakdown de scores'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginTop: '0.75rem' }}
          >
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '9px' }}>
              <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Análise Detalhada</p>
              <RadarBar label="Qualidade"       score={supplier.quality_score}       delay={0.05} />
              <RadarBar label="Entrega"         score={supplier.delivery_score}      delay={0.1}  />
              <RadarBar label="Preço"           score={supplier.price_score}         delay={0.15} />
              <RadarBar label="Comunicação"     score={supplier.communication_score} delay={0.2}  />
              <RadarBar label="Flexibilidade"   score={supplier.flexibility_score}   delay={0.25} />
              <RadarBar label="Sustentabilidade"score={supplier.sustainability_score}delay={0.3}  />
              {supplier.defect_rate != null && (
                <div style={{ marginTop: '0.5rem', padding: '0.375rem 0.625rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'rgb(90,102,120)' }}>Taxa de defeitos: </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: scoreColor(100 - supplier.defect_rate * 100) }}>{(supplier.defect_rate * 100).toFixed(2)}%</span>
                </div>
              )}
              {supplier.total_orders != null && (
                <div style={{ marginTop: '0.375rem' }}>
                  <span style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)' }}>Total de encomendas: </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(240,236,228,0.72)' }}>{supplier.total_orders.toLocaleString('pt-PT')}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── S6: Routing Intelligence Panel ────────────────────────────────────────────

interface RoutingRec { stage: string; supplier: string; available_slots: number; lead_time: number; }
interface Bottleneck  { stage: string; utilisation: number; available_slots: number; }

const GEOPOLITICAL_RISKS: Record<string, { level: 'low' | 'medium' | 'high'; note: string }> = {
  'Midocean':       { level: 'low',    note: 'NL — UE estável, supply chain robusto' },
  'PF Concept':     { level: 'low',    note: 'NL — UE estável, cadeia sustentável' },
  'Xindao':         { level: 'medium', note: 'CN/NL — dependência parcial de manufatura asiática' },
  'Maxema':         { level: 'low',    note: 'IT — UE, especialista premium estável' },
  'Stanley/Stella': { level: 'low',    note: 'BE — UE, certificado Fair Wear' },
};

const RISK_COLORS = { low: '#b8975e', medium: 'rgb(245,158,11)', high: 'rgb(239,68,68)' };
const RISK_LABELS = { low: '🟢 Baixo', medium: '🟡 Médio', high: '🔴 Alto' };

function RoutingIntelligencePanel({ suppliers }: { suppliers: SupplierScore[] }) {
  const [routing, setRouting] = useState<RoutingRec[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [aiRec, setAiRec] = useState<string>('');
  const [loadingRouting, setLoadingRouting] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [tab, setTab] = useState<'routing' | 'risk' | 'ai'>('routing');

  useEffect(() => {
    async function fetchRouting() {
      try {
        const [routingRes, bottlenecksRes] = await Promise.all([
          fetch('/api/manufacturing?mode=routing'),
          fetch('/api/manufacturing?mode=bottlenecks'),
        ]);
        if (routingRes.ok) {
          const d = await routingRes.json();
          setRouting(d.recommendations ?? []);
        }
        if (bottlenecksRes.ok) {
          const d = await bottlenecksRes.json();
          setBottlenecks(d.bottlenecks ?? []);
        }
      } catch { /* non-fatal */ }
      setLoadingRouting(false);
    }
    fetchRouting();
  }, []);

  async function getAiRec() {
    setLoadingAi(true);
    setTab('ai');
    try {
      const ctx = `Fornecedores: ${suppliers.map(s => `${s.supplier_name} (score: ${s.overall_score}, entrega: ${s.on_time_delivery_rate ?? '—'}%)`).join(', ')}. Gargalos: ${bottlenecks.map(b => `${b.stage} ${b.utilisation}%`).join(', ') || 'nenhum'}. Dá uma recomendação de sourcing para o próximo trimestre em português, 3-4 frases.`;
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: ctx, systemContext: 'És um especialista em procurement e gestão de fornecedores de merchandising corporativo.' }),
      });
      if (res.ok) {
        const d = await res.json();
        setAiRec(d.reply ?? d.message ?? 'Análise indisponível.');
      }
    } catch { /* non-fatal */ }
    setLoadingAi(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      style={{ marginTop: '1.25rem', borderRadius: '16px', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)', overflow: 'hidden' }}
    >
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🧠</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'rgb(200,215,235)' }}>Supplier Intelligence Engine</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {([['routing', '⚙️ Routing'], ['risk', '🌍 Risco'], ['ai', '🤖 AI Rec.']] as const).map(([t, label]) => (
            <button type="button" key={t} onClick={() => { setTab(t); if (t === 'ai' && !aiRec) getAiRec(); }}
              style={{
                background: tab === t ? 'rgba(167,139,250,0.2)' : 'rgba(240,236,228,0.04)',
                border: tab === t ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(240,236,228,0.06)',
                borderRadius: '8px', padding: '0.3rem 0.625rem',
                color: tab === t ? 'rgb(167,139,250)' : 'rgba(240,236,228,0.42)',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
              }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* Routing tab */}
        {tab === 'routing' && (
          loadingRouting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                  Recomendações de Routing
                </div>
                {routing.length === 0 ? (
                  <div style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)', fontStyle: 'italic' }}>
                    {suppliers.length > 0 ? `Routing: ${suppliers[0]?.supplier_name} recomendado para alta prioridade (score ${suppliers[0]?.overall_score})` : 'Dados indisponíveis.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {routing.slice(0, 4).map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '9px', border: '1px solid rgba(240,236,228,0.06)' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(170,185,205)' }}>{r.stage}</div>
                          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{r.supplier}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.65rem', color: '#b8975e', fontWeight: 700 }}>{r.available_slots} slots</div>
                          <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)' }}>{r.lead_time}d</div>
                        </div>
                      </div>
                    ))}
                    {routing.length === 0 && suppliers.slice(0, 3).map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '9px', border: '1px solid rgba(240,236,228,0.06)' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(170,185,205)' }}>Prioridade {i + 1}</div>
                          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{s.supplier_name}</div>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#b8975e', fontWeight: 700 }}>Score {s.overall_score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                  Gargalos de Produção
                </div>
                {bottlenecks.length === 0 ? (
                  <div style={{ padding: '0.75rem', background: 'rgba(99,230,190,0.06)', borderRadius: '10px', border: '1px solid rgba(184,151,94,0.14)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b8975e', fontWeight: 700 }}>✓ Sem gargalos críticos</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.2rem' }}>Capacidade de produção dentro dos limites normais.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {bottlenecks.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: b.utilisation > 90 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', borderRadius: '9px', border: `1px solid ${b.utilisation > 90 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(170,185,205)' }}>{b.stage}</div>
                          <div style={{ height: '3px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', marginTop: '0.25rem' }}>
                            <div style={{ height: '100%', width: `${Math.min(b.utilisation, 100)}%`, background: b.utilisation > 90 ? 'rgb(239,68,68)' : 'rgb(245,158,11)', borderRadius: '9999px', transition: 'width 0.8s' }} />
                          </div>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: b.utilisation > 90 ? 'rgb(239,68,68)' : 'rgb(245,158,11)', flexShrink: 0 }}>
                          {b.utilisation}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Risk tab */}
        {tab === 'risk' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.625rem' }}>
            {suppliers.map(s => {
              const risk = GEOPOLITICAL_RISKS[s.supplier_name] ?? { level: 'low' as const, note: 'Risco geopolítico não avaliado.' };
              const col = RISK_COLORS[risk.level];
              return (
                <div key={s.supplier_name} style={{ padding: '0.875rem', background: `${col}08`, borderRadius: '12px', border: `1px solid ${col}25` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{s.supplier_name}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: col }}>{RISK_LABELS[risk.level]}</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.4 }}>{risk.note}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI tab */}
        {tab === 'ai' && (
          <div>
            {loadingAi ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🧠</span>
                <span style={{ fontSize: '0.78rem', color: 'rgb(167,139,250)', fontWeight: 600 }}>A gerar análise de procurement…</span>
              </div>
            ) : aiRec ? (
              <div style={{ padding: '1rem', background: 'rgba(167,139,250,0.06)', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.15)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  🤖 Recomendação AI — Sourcing Q{Math.ceil((new Date().getMonth() + 1) / 3)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgb(185,198,218)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{aiRec}</div>
              </div>
            ) : (
              <button type="button" onClick={getAiRec} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '10px', padding: '0.75rem 1.25rem', color: 'rgb(167,139,250)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                🤖 Gerar Recomendação AI
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([]);
  const [inventorySummary, setInventorySummary] = useState({ critical: 0, lowStock: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'overall' | 'quality' | 'delivery'>('overall');

  useEffect(() => {
    async function load() {
      try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/suppliers'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);

      const [scoresRes, alertsRes] = await Promise.all([
        // DB columns are camelCase: supplierName, globalReliabilityScore, totalEvents
        supabase.from('supplier_global_scores').select('*').order('globalReliabilityScore', { ascending: false }),
        supabase.from('inventory_alerts').select('alert_type,current_stock,threshold').eq('resolved', false),
      ]);

      if (scoresRes.data && scoresRes.data.length > 0) {
        // Map camelCase DB columns → snake_case SupplierScore interface
        const mapped = scoresRes.data.map((row: any) => ({
          id: row.id,
          supplier_name: row.supplierName ?? row.supplier_name,
          overall_score: Number(row.globalReliabilityScore ?? row.overall_score ?? 0),
          quality_score: Number(row.quality_score ?? 85),
          delivery_score: Number(row.delivery_score ?? 80),
          price_score: Number(row.price_score ?? 80),
          communication_score: Number(row.communication_score ?? 85),
          flexibility_score: Number(row.flexibility_score ?? 80),
          sustainability_score: Number(row.sustainability_score ?? 75),
          total_orders: Number(row.totalEvents ?? row.total_orders ?? 0),
          on_time_delivery_rate: Number(row.on_time_delivery_rate ?? Math.round(Number(row.globalReliabilityScore ?? 85) * 1.05)),
        }));
        setSuppliers(mapped as SupplierScore[]);
      } else {
        // Fallback with static data shaped as SupplierScore
        setSuppliers([
          { supplier_name: 'Midocean',       overall_score: 94, quality_score: 96, delivery_score: 92, price_score: 88, communication_score: 95, flexibility_score: 91, sustainability_score: 88, total_orders: 2409, on_time_delivery_rate: 97.2 },
          { supplier_name: 'Makito',         overall_score: 88, quality_score: 87, delivery_score: 89, price_score: 90, communication_score: 88, flexibility_score: 85, sustainability_score: 80, total_orders: 4573, on_time_delivery_rate: 92.0 },
          { supplier_name: 'PF Concept',     overall_score: 91, quality_score: 93, delivery_score: 89, price_score: 85, communication_score: 92, flexibility_score: 88, sustainability_score: 96, total_orders: 534,  on_time_delivery_rate: 94.5 },
          { supplier_name: 'Xindao',         overall_score: 87, quality_score: 88, delivery_score: 86, price_score: 91, communication_score: 84, flexibility_score: 87, sustainability_score: 75, total_orders: 321,  on_time_delivery_rate: 91.0 },
          { supplier_name: 'Maxema',         overall_score: 83, quality_score: 91, delivery_score: 79, price_score: 78, communication_score: 82, flexibility_score: 80, sustainability_score: 72, total_orders: 187,  on_time_delivery_rate: 88.3 },
          { supplier_name: 'Stanley/Stella', overall_score: 79, quality_score: 89, delivery_score: 74, price_score: 65, communication_score: 78, flexibility_score: 72, sustainability_score: 98, total_orders: 89,   on_time_delivery_rate: 82.1 },
        ]);
      }

      const alerts = alertsRes.data ?? [];
      setInventorySummary({
        critical: alerts.filter((a: InventoryAlert) => a.alert_type === 'out_of_stock').length,
        lowStock: alerts.filter((a: InventoryAlert) => a.alert_type === 'low_stock').length,
        total: alerts.length,
      });

            } catch (err) {
        console.error("[suppliers] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const sorted = [...suppliers].sort((a, b) => {
    if (sortBy === 'quality') return (b.quality_score ?? 0) - (a.quality_score ?? 0);
    if (sortBy === 'delivery') return (b.delivery_score ?? 0) - (a.delivery_score ?? 0);
    return (b.overall_score ?? 0) - (a.overall_score ?? 0);
  });

  const avgScore = suppliers.length > 0
    ? Math.round(suppliers.reduce((s, sup) => s + sup.overall_score, 0) / suppliers.length)
    : 0;
  const topSupplier = suppliers[0]?.supplier_name ?? '—';

  return (
    <PortalLayout userName={client?.name ?? undefined} companyName={client?.company ?? undefined} tier={client?.tier ?? undefined}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
            Supplier Intelligence
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.24)' }}>
            Análise de performance em tempo real · {suppliers.length} fornecedores avaliados
          </p>
        </motion.div>

        {/* Global KPIs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Fornecedores Ativos', value: String(suppliers.filter(s => (SUPPLIER_META[s.supplier_name]?.status ?? 'active') === 'active').length), color: '#d4b47a', icon: '🏭' },
            { label: 'Score Médio',          value: String(avgScore) + '/100', color: scoreColor(avgScore), icon: '⭐' },
            { label: 'Melhor Fornecedor',    value: topSupplier, color: '#b8975e', icon: '🥇' },
            { label: 'Stock em Rutura',      value: String(inventorySummary.critical), color: inventorySummary.critical > 0 ? 'rgb(239,68,68)' : '#b8975e', icon: '🚨' },
            { label: 'Stock Baixo',          value: String(inventorySummary.lowStock), color: inventorySummary.lowStock > 0 ? 'rgb(245,158,11)' : '#b8975e', icon: '⚠️' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}
              className="yg-card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Inventory alert banner */}
        <AnimatePresence>
          {inventorySummary.critical > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', marginBottom: '1.25rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: '10px' }}>
              <span style={{ fontSize: '1rem' }}>🚨</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(252,165,165)' }}>
                  {inventorySummary.critical} produto{inventorySummary.critical !== 1 ? 's' : ''} em rutura de stock
                  {inventorySummary.lowStock > 0 && ` · ${inventorySummary.lowStock} com stock baixo`}
                </span>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'rgb(180,100,100)' }}>Contacta os fornecedores →</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)' }}>
            Scorecard de Fornecedores
          </h2>
          <div style={{ display: 'flex', gap: '0.375rem', background: 'rgba(240,236,228,0.04)', padding: '3px', borderRadius: '9px', border: '1px solid rgba(240,236,228,0.06)' }}>
            {([['overall', 'Score Global'], ['quality', 'Qualidade'], ['delivery', 'Entrega']] as const).map(([key, label]) => (
              <button type="button" key={key}  onClick={() => setSortBy(key)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '7px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: sortBy === key ? 'rgba(77,163,255,0.18)' : 'transparent', color: sortBy === key ? '#d4b47a' : 'rgba(240,236,228,0.42)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: '280px', borderRadius: '16px', background: 'rgba(240,236,228,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {sorted.map((sup, i) => (
              <SupplierCard key={sup.supplier_name} supplier={sup} index={i} />
            ))}
          </div>
        )}

        {/* S6: Intelligence Engine panel */}
        {!loading && <RoutingIntelligencePanel suppliers={sorted} />}

        {/* Network health summary */}
        {!loading && suppliers.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(240,236,228,0.72)', marginBottom: '0.875rem' }}>
              Saúde da Rede de Fornecimento
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Qualidade Média',     value: Math.round(suppliers.reduce((s, x) => s + (x.quality_score ?? x.overall_score), 0) / suppliers.length), suffix: '/100' },
                { label: 'Entrega Média',       value: Math.round(suppliers.reduce((s, x) => s + (x.delivery_score ?? x.overall_score), 0) / suppliers.length), suffix: '/100' },
                { label: 'Sustentabilidade',    value: Math.round(suppliers.reduce((s, x) => s + (x.sustainability_score ?? 70), 0) / suppliers.length), suffix: '/100' },
                { label: 'On-time rate médio',  value: Math.round(suppliers.reduce((s, x) => s + (x.on_time_delivery_rate ?? 90), 0) / suppliers.length), suffix: '%' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(m.value), letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '0.2rem' }}>
                    {m.value}{m.suffix}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>{m.label}</div>
                  <div style={{ marginTop: '0.4rem', height: '3px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${m.value}%` }}
                      transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', background: scoreColor(m.value), borderRadius: '9999px' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </PortalLayout>
  );
}
