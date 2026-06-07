'use client';

// ── OMEGA X — S1+S2: Autonomous Procurement Command Center ───────────────────
//
// Full autonomous RFQ lifecycle with AI supplier scoring, bid comparison,
// negotiation rounds, procurement memory graph, and forecasting.
//
// Admin: create RFQs, add supplier bids, AI compare, negotiate, award
// Client: view own RFQs, track status
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RFQ {
  id: string; title: string; product_name: string; category?: string;
  quantity: number; target_unit_price?: number; target_total?: number;
  deadline?: string; delivery_country?: string; status: RFQStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ai_recommendations?: Record<string, unknown>;
  ai_risk_score?: number; winner_supplier?: string;
  final_unit_price?: number; final_total?: number;
  savings_amount?: number; savings_pct?: number;
  responded_count: number; created_by_email?: string;
  created_at: string; updated_at: string;
}

interface RFQResponse {
  id: string; rfq_id: string; supplier_name: string; unit_price: number;
  total_price?: number; lead_time_days?: number; moq?: number;
  payment_terms?: string; notes?: string; ai_score?: number;
  ai_analysis?: { ai_insight?: string; price_ratio?: number };
  rank?: number; status: string; submitted_at: string;
}

interface NegSession {
  id: string; supplier_name: string; round: number;
  our_target_price?: number; supplier_offer?: number;
  ai_strategy?: string; ai_message?: string;
  outcome: string; savings_achieved?: number; created_at: string;
}

interface ClientProfile { name: string | null; company: string | null; tier: string | null; }

type RFQStatus = 'draft' | 'sent' | 'responses_received' | 'negotiating' | 'awarded' | 'cancelled' | 'completed';
type PanelMode = 'list' | 'detail' | 'create' | 'negotiate' | 'memory' | 'analytics';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RFQStatus, { label: string; color: string; bg: string; emoji: string }> = {
  draft:               { label: 'Rascunho',          color: 'rgba(240,236,228,0.24)',    bg: 'rgba(80,92,110,0.12)',    emoji: '📝' },
  sent:                { label: 'Enviado',            color: '#d4b47a',   bg: 'rgba(154,124,74,0.12)',   emoji: '📤' },
  responses_received:  { label: 'Respostas',         color: '#b8975e',  bg: 'rgba(116,231,255,0.12)',  emoji: '📬' },
  negotiating:         { label: 'Em Negociação',     color: 'rgb(245,158,11)',   bg: 'rgba(245,158,11,0.12)',   emoji: '🤝' },
  awarded:             { label: 'Adjudicado',        color: '#b8975e',   bg: 'rgba(184,151,94,0.12)',   emoji: '✅' },
  cancelled:           { label: 'Cancelado',         color: 'rgb(239,68,68)',    bg: 'rgba(239,68,68,0.12)',    emoji: '❌' },
  completed:           { label: 'Concluído',         color: 'rgb(167,139,250)',  bg: 'rgba(167,139,250,0.12)', emoji: '🏆' },
};

const PRIORITY_CFG = {
  low:    { label: 'Baixa',  color: 'rgba(240,236,228,0.24)' },
  normal: { label: 'Normal', color: '#d4b47a' },
  high:   { label: 'Alta',   color: 'rgb(245,158,11)' },
  urgent: { label: 'Urgente',color: 'rgb(239,68,68)' },
};

const KNOWN_SUPPLIERS = ['Midocean', 'PF Concept', 'Xindao', 'Maxema', 'Stanley/Stella', 'Outro'];

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }
function fmtAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return `${Math.floor(diff / 86400000)}d atrás`;
}

function StatusBadge({ status }: { status: RFQStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontSize: '0.62rem', fontWeight: 700 }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#b8975e' : score >= 60 ? '#d4b47a' : score >= 40 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  return (
    <div style={{ width: '40px', height: '40px', position: 'relative', flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth="3" />
        <motion.circle
          cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 94.2} 94.2`}
          initial={{ strokeDasharray: '0 94.2' }}
          animate={{ strokeDasharray: `${(score / 100) * 94.2} 94.2` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color }}>
        {score}
      </div>
    </div>
  );
}

// ─── Create RFQ Form ─────────────────────────────────────────────────────────

function CreateRFQPanel({ onCreated }: { onCreated: (rfq: RFQ) => void }) {
  const [form, setForm] = useState({
    title: '', product_name: '', category: '', quantity: 50,
    target_unit_price: '', deadline: '', delivery_country: 'PT',
    requirements: '', priority: 'normal',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiRecs, setAiRecs] = useState<Record<string, unknown> | null>(null);

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.title || !form.product_name || !form.quantity) { setError('Preenche título, produto e quantidade.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_rfq', ...form,
          quantity: Number(form.quantity),
          target_unit_price: form.target_unit_price ? Number(form.target_unit_price) : undefined,
          requirements: form.requirements ? { notes: form.requirements } : {},
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro'); return; }
      const d = await res.json();
      setAiRecs(d.rfq?.ai_recommendations ?? null);
      onCreated(d.rfq as RFQ);
    } catch { setError('Erro de rede.'); }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {[
          { label: 'Título do RFQ *', key: 'title', placeholder: 'Ex: Canecas cerâmica 250un Q3' },
          { label: 'Nome do Produto *', key: 'product_name', placeholder: 'Ex: Caneca cerâmica 300ml' },
          { label: 'Categoria', key: 'category', placeholder: 'Ex: drinkware' },
          { label: 'Quantidade *', key: 'quantity', type: 'number', placeholder: '50' },
          { label: 'Target €/un', key: 'target_unit_price', type: 'number', placeholder: '4.50' },
          { label: 'Prazo', key: 'deadline', type: 'date' },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{f.label}</div>
            <input
              type={f.type ?? 'text'}
              value={String(form[f.key as keyof typeof form])}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.6rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>Prioridade</div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['low','normal','high','urgent'] as const).map(p => (
              <button type="button" key={p} onClick={() => set('priority', p)} style={{
                flex: 1, background: form.priority === p ? `${PRIORITY_CFG[p].color}18` : 'rgba(240,236,228,0.04)',
                border: form.priority === p ? `1px solid ${PRIORITY_CFG[p].color}40` : '1px solid rgba(240,236,228,0.06)',
                borderRadius: '8px', padding: '0.4rem 0', color: form.priority === p ? PRIORITY_CFG[p].color : 'rgba(240,236,228,0.42)',
                fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
              }}>{PRIORITY_CFG[p].label}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>País Entrega</div>
          <select value={form.delivery_country} onChange={e => set('delivery_country', e.target.value)} style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.6rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }}>
            {['PT','ES','FR','DE','GB','NL','IT'].map(c => <option key={c} value={c} style={{ background: 'rgb(14,22,36)' }}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>Requisitos / Especificações</div>
        <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)} rows={3}
          placeholder="Descreve requisitos técnicos, certificações, embalagem, etc."
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.6rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.75rem', resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {error && <div style={{ padding: '0.625rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', color: 'rgb(239,68,68)', fontSize: '0.72rem' }}>{error}</div>}

      {aiRecs && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '0.875rem', background: 'rgba(167,139,250,0.06)', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.5rem' }}>🧠 AI Recommendations</div>
          {(aiRecs.recommended_suppliers as string[] | undefined)?.length && (
            <div style={{ marginBottom: '0.35rem', fontSize: '0.72rem', color: 'rgb(170,185,205)' }}>
              Fornecedores: {(aiRecs.recommended_suppliers as string[]).join(' · ')}
            </div>
          )}
          {aiRecs.risk_score != null && (
            <div style={{ fontSize: '0.68rem', color: Number(aiRecs.risk_score) < 40 ? '#b8975e' : 'rgb(245,158,11)' }}>
              Risco: {String(aiRecs.risk_score)}/100
            </div>
          )}
          {(aiRecs.negotiation_tips as string[] | undefined)?.map((t, i) => (
            <div key={i} style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.2rem' }}>💡 {t}</div>
          ))}
        </motion.div>
      )}

      <motion.button whileTap={tapScale} onClick={submit} disabled={loading} style={{
        background: loading ? 'rgba(240,236,228,0.06)' : 'linear-gradient(135deg,#d4b47a,#b8975e)',
        border: 'none', borderRadius: '12px', padding: '0.875rem',
        color: loading ? 'rgba(240,236,228,0.24)' : '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
      }}>
        {loading ? '🧠 A gerar RFQ com AI…' : '🚀 Criar RFQ Autónomo'}
      </motion.button>
    </div>
  );
}

// ─── Add Bid Form ─────────────────────────────────────────────────────────────

function AddBidPanel({ rfqId, rfqQty, onAdded }: { rfqId: string; rfqQty: number; onAdded: () => void }) {
  const [form, setForm] = useState({ supplier_name: '', unit_price: '', lead_time_days: '', moq: '', payment_terms: 'Net30', notes: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; insight?: string } | null>(null);
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.supplier_name || !form.unit_price) return;
    setLoading(true);
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_response', rfq_id: rfqId,
          ...form, unit_price: Number(form.unit_price),
          lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : undefined,
          moq: form.moq ? Number(form.moq) : undefined,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setResult({ score: d.score, insight: (d.response?.ai_analysis as { ai_insight?: string } | undefined)?.ai_insight });
        setForm({ supplier_name: '', unit_price: '', lead_time_days: '', moq: '', payment_terms: 'Net30', notes: '' });
        onAdded();
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }

  return (
    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(240,236,228,0.06)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>+ Registar Proposta de Fornecedor</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Fornecedor *</div>
          <select value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }}>
            <option value="" style={{ background: 'rgb(14,22,36)' }}>Selecciona…</option>
            {KNOWN_SUPPLIERS.map(s => <option key={s} value={s} style={{ background: 'rgb(14,22,36)' }}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>€/un *</div>
          <input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0.00"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Lead time (dias)</div>
          <input type="number" value={form.lead_time_days} onChange={e => set('lead_time_days', e.target.value)} placeholder="14"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>MOQ</div>
          <input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} placeholder={String(rfqQty)}
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Termos</div>
          <select value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }}>
            {['Net30','Net60','50/50','30% advance','Full advance'].map(t => <option key={t} value={t} style={{ background: 'rgb(14,22,36)' }}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Notas</div>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observações…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
        </div>
      </div>
      <motion.button whileTap={tapScale} onClick={submit} disabled={loading || !form.supplier_name || !form.unit_price} style={{
        background: form.supplier_name && form.unit_price ? 'rgba(77,163,255,0.18)' : 'rgba(240,236,228,0.04)',
        border: form.supplier_name && form.unit_price ? '1px solid rgba(154,124,74,0.35)' : '1px solid rgba(240,236,228,0.06)',
        borderRadius: '8px', padding: '0.5rem 1rem', color: form.supplier_name && form.unit_price ? '#d4b47a' : 'rgba(240,236,228,0.24)',
        fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
      }}>
        {loading ? '🧠 A avaliar com AI…' : '+ Registar & Avaliar'}
      </motion.button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'rgba(99,230,190,0.06)', borderRadius: '10px', border: '1px solid rgba(184,151,94,0.14)' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b8975e', marginBottom: '0.2rem' }}>✓ Proposta registada — Score AI: {result.score}/100</div>
          {result.insight && <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.5 }}>{result.insight}</div>}
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [client, setClient] = useState<ClientProfile | null>(null);

  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [rfqResponses, setRFQResponses] = useState<RFQResponse[]>([]);
  const [negotiations, setNegotiations] = useState<NegSession[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>('list');

  const [statusFilter, setStatusFilter] = useState('all');
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [memory, setMemory] = useState<Record<string, unknown>[]>([]);
  const [aiComparison, setAiComparison] = useState<string | null>(null);
  const [comparingAI, setComparingAI] = useState(false);
  const [awardLoading, setAwardLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Negotiation state
  const [negSupplier, setNegSupplier] = useState('');
  const [negTargetPrice, setNegTargetPrice] = useState('');
  const [negLoading, setNegLoading] = useState(false);
  const [negMessage, setNegMessage] = useState('');

  const loadList = useCallback(async (status: string) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'list' });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/procurement?${params}`);
      if (res.ok) {
        const d = await res.json();
        setRFQs(d.rfqs ?? []);
        setIsAdmin(d.isAdmin ?? false);
      }
    } catch { /* non-fatal */ }
    setListLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/procurement'); return; }
      const { data: c } = await supabase.from('clients').select('name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
      await loadList('all');
    }
    init();
  }, [router, loadList]);

  async function loadDetail(rfq: RFQ) {
    setSelectedRFQ(rfq);
    setDetailLoading(true); setAiComparison(null); setActionSuccess('');
    try {
      const res = await fetch(`/api/procurement?mode=detail&id=${rfq.id}`);
      if (res.ok) {
        const d = await res.json();
        setRFQResponses(d.responses ?? []);
        setNegotiations(d.negotiations ?? []);
      }
    } catch { /* non-fatal */ }
    setDetailLoading(false);
    setPanelMode('detail');
  }

  async function loadAnalytics() {
    setPanelMode('analytics');
    try {
      const res = await fetch('/api/procurement?mode=analytics');
      if (res.ok) setAnalytics(await res.json());
    } catch { /* non-fatal */ }
  }

  async function loadMemory() {
    setPanelMode('memory');
    try {
      const res = await fetch('/api/procurement?mode=memory');
      if (res.ok) { const d = await res.json(); setMemory(d.memory ?? []); }
    } catch { /* non-fatal */ }
  }

  async function runAIComparison() {
    if (!selectedRFQ) return;
    setComparingAI(true); setAiComparison(null);
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_compare', rfq_id: selectedRFQ.id }),
      });
      if (res.ok) { const d = await res.json(); setAiComparison(d.comparison ?? ''); }
    } catch { /* non-fatal */ }
    setComparingAI(false);
  }

  async function awardToSupplier(response: RFQResponse) {
    if (!selectedRFQ) return;
    setAwardLoading(true);
    try {
      const res = await fetch('/api/procurement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'award', rfq_id: selectedRFQ.id, response_id: response.id,
          supplier_name: response.supplier_name, final_unit_price: response.unit_price,
          final_total: response.total_price,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setActionSuccess(`Adjudicado a ${response.supplier_name} — Poupança: ${fmtEur(d.savings ?? 0)}`);
        await loadList(statusFilter);
        await loadDetail({ ...selectedRFQ, status: 'awarded' });
      }
    } catch { /* non-fatal */ }
    setAwardLoading(false);
  }

  async function startNegotiation() {
    if (!selectedRFQ || !negSupplier) return;
    setNegLoading(true);
    const topResponse = rfqResponses.find(r => r.supplier_name === negSupplier);
    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start', rfq_id: selectedRFQ.id,
          response_id: topResponse?.id,
          supplier_name: negSupplier,
          target_price: negTargetPrice ? Number(negTargetPrice) : selectedRFQ.target_unit_price,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setNegMessage(d.ai_message ?? '');
        await loadDetail(selectedRFQ);
      }
    } catch { /* non-fatal */ }
    setNegLoading(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const statusTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'draft', label: 'Rascunho' },
    { id: 'responses_received', label: 'Respostas' },
    { id: 'negotiating', label: 'Negociação' },
    { id: 'awarded', label: 'Adjudicados' },
  ];

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1300px' }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
              Procurement AI {isAdmin && <span style={{ fontSize: '0.68rem', color: 'rgb(245,158,11)', marginLeft: '0.5rem', fontWeight: 700 }}>ADMIN</span>}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.24)' }}>
              Motor autónomo de RFQ, negociação AI e optimização de sourcing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isAdmin && (
              <>
                <motion.button whileTap={tapScale} onClick={loadAnalytics} style={{ background: 'rgba(184,151,94,0.10)', border: '1px solid rgba(99,230,190,0.25)', borderRadius: '10px', padding: '0.5rem 0.875rem', color: '#b8975e', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                  📊 Analytics
                </motion.button>
                <motion.button whileTap={tapScale} onClick={loadMemory} style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '10px', padding: '0.5rem 0.875rem', color: 'rgb(167,139,250)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                  🧠 Memória
                </motion.button>
              </>
            )}
            <motion.button whileTap={tapScale} onClick={() => setPanelMode('create')} style={{ background: 'linear-gradient(135deg,rgba(154,124,74,0.18),rgba(184,151,94,0.10))', border: '1px solid rgba(77,163,255,0.35)', borderRadius: '10px', padding: '0.5rem 1rem', color: '#d4b47a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              + Novo RFQ
            </motion.button>
          </div>
        </motion.div>

        {/* Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem', alignItems: 'start' }}>

          {/* ── Left: RFQ List ──────────────────────────────────────────── */}
          <div>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
              {statusTabs.map(tab => (
                <button type="button" key={tab.id} onClick={() => { setStatusFilter(tab.id); loadList(tab.id); }}
                  style={{ background: statusFilter === tab.id ? 'rgba(77,163,255,0.18)' : 'rgba(240,236,228,0.04)', border: statusFilter === tab.id ? '1px solid rgba(154,124,74,0.35)' : '1px solid rgba(240,236,228,0.06)', borderRadius: '8px', padding: '0.3rem 0.6rem', color: statusFilter === tab.id ? '#d4b47a' : 'rgba(240,236,228,0.42)', fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {listLoading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card" style={{ borderRadius: '12px' }} />
              )) : rfqs.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem', border: '1px dashed rgba(240,236,228,0.06)', borderRadius: '12px' }}>
                  Nenhum RFQ encontrado.<br />Clica em "+ Novo RFQ" para começar.
                </div>
              ) : (
                <AnimatePresence>
                  {rfqs.map((rfq, i) => (
                    <motion.div
                      key={rfq.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...springSnappy, delay: i * 0.04 }}
                      whileTap={tapScale}
                      onClick={() => loadDetail(rfq)}
                      style={{ padding: '0.875rem 1rem', borderRadius: '12px', border: selectedRFQ?.id === rfq.id ? '1.5px solid rgba(154,124,74,0.45)' : '1px solid rgba(240,236,228,0.06)', background: selectedRFQ?.id === rfq.id ? 'rgba(154,124,74,0.08)' : 'rgba(240,236,228,0.04)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(200,215,235)', flex: 1, paddingRight: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rfq.title}</div>
                        <StatusBadge status={rfq.status} />
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', marginBottom: '0.25rem' }}>
                        {rfq.product_name} · {rfq.quantity.toLocaleString('pt-PT')} un
                        {rfq.target_unit_price ? ` · Target €${rfq.target_unit_price}/un` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: PRIORITY_CFG[rfq.priority].color }}>● {PRIORITY_CFG[rfq.priority].label}</span>
                          {rfq.responded_count > 0 && <span style={{ fontSize: '0.58rem', color: '#b8975e', fontWeight: 600 }}>{rfq.responded_count} propostas</span>}
                          {rfq.savings_amount && rfq.savings_amount > 0 && <span style={{ fontSize: '0.58rem', color: '#b8975e', fontWeight: 700 }}>-{fmtEur(rfq.savings_amount)}</span>}
                        </div>
                        <span style={{ fontSize: '0.55rem', color: 'rgba(240,236,228,0.24)' }}>{fmtAgo(rfq.updated_at)}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* ── Right: Detail / Create / Analytics / Memory ─────────────── */}
          <AnimatePresence mode="wait">

            {/* Create RFQ */}
            {panelMode === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)' }}>🚀 Novo RFQ Autónomo</h2>
                    <button type="button" onClick={() => setPanelMode('list')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer', fontSize: '0.75rem' }}>✕ Fechar</button>
                  </div>
                  <CreateRFQPanel onCreated={(rfq) => { loadList(statusFilter); loadDetail(rfq); }} />
                </div>
              </motion.div>
            )}

            {/* Analytics */}
            {panelMode === 'analytics' && analytics && (
              <motion.div key="analytics" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', marginBottom: '1.25rem' }}>📊 Procurement Analytics</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Total RFQs', value: String(analytics.total_rfqs ?? 0), color: '#d4b47a' },
                      { label: 'Poupança Total', value: fmtEur(Number(analytics.total_savings ?? 0)), color: '#b8975e' },
                      { label: 'Propostas Recebidas', value: String(analytics.response_count ?? 0), color: '#b8975e' },
                    ].map(m => (
                      <div key={m.label} style={{ padding: '0.875rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: m.color, letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>{m.value}</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {!!(analytics.supplier_wins) && Object.keys(analytics.supplier_wins as object).length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Top Fornecedores Adjudicados</div>
                      {Object.entries(analytics.supplier_wins as Record<string, number>).sort((a,b) => b[1]-a[1]).map(([name, wins]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'rgb(170,185,205)', fontWeight: 600 }}>{name}</span>
                          <span style={{ fontSize: '0.72rem', color: '#b8975e', fontWeight: 700 }}>{wins} contratos</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Procurement Memory */}
            {panelMode === 'memory' && (
              <motion.div key="memory" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', marginBottom: '1.25rem' }}>🧠 Procurement Memory Graph</h2>
                  {memory.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>
                      A memória será construída automaticamente à medida que adjudicas RFQs.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {memory.map((m) => (
                        <div key={String(m.supplier_name)} style={{ padding: '0.875rem 1rem', background: 'rgba(240,236,228,0.04)', borderRadius: '12px', border: '1px solid rgba(240,236,228,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'rgb(200,215,235)' }}>{String(m.supplier_name)}</span>
                            <span style={{ fontSize: '0.65rem', color: '#b8975e', fontWeight: 700 }}>{Number(m.total_awarded ?? 0)}/{Number(m.total_rfqs ?? 0)} adjudicações</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)' }}>
                            {m.best_price_achieved != null && <span>Melhor preço: {fmtEur(Number(m.best_price_achieved))}/un</span>}
                            {m.avg_lead_time != null && <span>Lead time médio: {String(m.avg_lead_time)}d</span>}
                            {m.negotiation_win_rate != null && <span>Win rate: {Number(m.negotiation_win_rate).toFixed(0)}%</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* RFQ Detail */}
            {panelMode === 'detail' && selectedRFQ && (
              <motion.div key={selectedRFQ.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* RFQ header card */}
                <div className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', marginBottom: '0.25rem' }}>{selectedRFQ.title}</h2>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <StatusBadge status={selectedRFQ.status} />
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: PRIORITY_CFG[selectedRFQ.priority].color }}>● {PRIORITY_CFG[selectedRFQ.priority].label}</span>
                      </div>
                    </div>
                    {selectedRFQ.ai_risk_score != null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.15rem' }}>Risco AI</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: selectedRFQ.ai_risk_score < 40 ? '#b8975e' : selectedRFQ.ai_risk_score < 70 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' }}>
                          {selectedRFQ.ai_risk_score}/100
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    {[
                      { label: 'Produto', value: selectedRFQ.product_name },
                      { label: 'Quantidade', value: `${selectedRFQ.quantity.toLocaleString('pt-PT')} un` },
                      { label: 'Target €/un', value: selectedRFQ.target_unit_price ? fmtEur(selectedRFQ.target_unit_price) : '—' },
                      { label: 'Prazo', value: fmtDate(selectedRFQ.deadline) },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>{m.label}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgb(170,185,205)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Winner / savings */}
                  {selectedRFQ.winner_supplier && (
                    <div style={{ padding: '0.75rem', background: 'rgba(99,230,190,0.07)', borderRadius: '10px', border: '1px solid rgba(184,151,94,0.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.1rem' }}>Adjudicado a</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#b8975e' }}>🏆 {selectedRFQ.winner_supplier}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {selectedRFQ.savings_amount && selectedRFQ.savings_amount > 0 && (
                          <>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Poupança</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#b8975e' }}>
                              {fmtEur(selectedRFQ.savings_amount)} ({selectedRFQ.savings_pct?.toFixed(1)}%)
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI recommendations */}
                  {selectedRFQ.ai_recommendations && (selectedRFQ.ai_recommendations as { recommended_suppliers?: string[] }).recommended_suppliers?.length && (
                    <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'rgba(167,139,250,0.06)', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.3rem' }}>🧠 Fornecedores Recomendados AI</div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {((selectedRFQ.ai_recommendations as { recommended_suppliers?: string[] }).recommended_suppliers ?? []).map((s: string) => (
                          <span key={s} style={{ fontSize: '0.65rem', color: 'rgb(167,139,250)', background: 'rgba(167,139,250,0.12)', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {actionSuccess && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'rgba(184,151,94,0.08)', borderRadius: '8px', color: '#b8975e', fontSize: '0.72rem', fontWeight: 600, textAlign: 'center' }}>
                      ✅ {actionSuccess}
                    </motion.div>
                  )}
                </div>

                {/* Supplier bids */}
                {detailLoading ? (
                  <div className="skeleton skeleton-card" style={{ borderRadius: '14px', height: '180px' }} />
                ) : (
                  <div className="yg-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Propostas ({rfqResponses.length})
                      </div>
                      {isAdmin && rfqResponses.length >= 2 && (
                        <motion.button whileTap={tapScale} onClick={runAIComparison} disabled={comparingAI}
                          style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', padding: '0.35rem 0.75rem', color: 'rgb(167,139,250)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                          {comparingAI ? '🧠 Comparando…' : '🧠 Comparar AI'}
                        </motion.button>
                      )}
                    </div>

                    {rfqResponses.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.72rem' }}>Sem propostas ainda.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {rfqResponses.map((r, i) => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem', background: r.status === 'accepted' ? 'rgba(99,230,190,0.06)' : 'rgba(240,236,228,0.04)', borderRadius: '10px', border: r.status === 'accepted' ? '1px solid rgba(184,151,94,0.18)' : '1px solid rgba(240,236,228,0.06)' }}>
                            {r.ai_score != null && <ScoreRing score={r.ai_score} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                {r.rank && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: r.rank === 1 ? 'rgb(245,158,11)' : 'rgba(240,236,228,0.24)' }}>#{r.rank}</span>}
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{r.supplier_name}</span>
                                {r.status === 'accepted' && <span style={{ fontSize: '0.58rem', color: '#b8975e', fontWeight: 700 }}>● ACEITE</span>}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)' }}>
                                {fmtEur(r.unit_price)}/un · {r.lead_time_days ?? '?'}d · MOQ {r.moq ?? '?'} · {r.payment_terms ?? 'Net30'}
                              </div>
                              {r.ai_analysis?.ai_insight && (
                                <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.15rem', fontStyle: 'italic', lineHeight: 1.4 }}>{r.ai_analysis.ai_insight}</div>
                              )}
                            </div>
                            {isAdmin && selectedRFQ.status !== 'awarded' && (
                              <motion.button whileTap={tapScale} onClick={() => awardToSupplier(r)} disabled={awardLoading}
                                style={{ background: 'rgba(184,151,94,0.12)', border: '1px solid rgba(99,230,190,0.3)', borderRadius: '8px', padding: '0.4rem 0.75rem', color: '#b8975e', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                {awardLoading ? '…' : '🏆 Adjudicar'}
                              </motion.button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {aiComparison && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'rgba(167,139,250,0.06)', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.18)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.4rem' }}>🧠 Análise Comparativa AI</div>
                        <div style={{ fontSize: '0.73rem', color: 'rgb(170,185,205)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{aiComparison}</div>
                      </motion.div>
                    )}

                    {/* Add bid form (admin) */}
                    {isAdmin && !['awarded', 'cancelled', 'completed'].includes(selectedRFQ.status) && (
                      <div style={{ marginTop: '0.875rem' }}>
                        <AddBidPanel rfqId={selectedRFQ.id} rfqQty={selectedRFQ.quantity} onAdded={() => loadDetail(selectedRFQ)} />
                      </div>
                    )}
                  </div>
                )}

                {/* Negotiation panel */}
                {isAdmin && !['awarded', 'cancelled', 'completed'].includes(selectedRFQ.status) && (
                  <div className="yg-card" style={{ padding: '1.25rem', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(245,158,11)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>
                      🤝 Motor de Negociação AI
                    </div>

                    {negotiations.length > 0 && (
                      <div style={{ marginBottom: '0.875rem' }}>
                        {negotiations.slice(-3).map(n => (
                          <div key={n.id} style={{ padding: '0.625rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(240,236,228,0.06)', marginBottom: '0.35rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgb(245,158,11)', fontWeight: 700 }}>Ronda {n.round} — {n.supplier_name}</div>
                            {n.supplier_offer && <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.42)' }}>Oferta: {fmtEur(n.supplier_offer)}/un</div>}
                            {n.ai_strategy && <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.15rem', lineHeight: 1.4 }}>{n.ai_strategy.slice(0, 120)}…</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Fornecedor</div>
                        <select value={negSupplier} onChange={e => setNegSupplier(e.target.value)} style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }}>
                          <option value="" style={{ background: 'rgb(14,22,36)' }}>Selecciona…</option>
                          {rfqResponses.map(r => <option key={r.id} value={r.supplier_name} style={{ background: 'rgb(14,22,36)' }}>{r.supplier_name} ({fmtEur(r.unit_price)}/un)</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>Target €/un</div>
                        <input type="number" step="0.01" value={negTargetPrice} onChange={e => setNegTargetPrice(e.target.value)}
                          placeholder={selectedRFQ.target_unit_price ? String(selectedRFQ.target_unit_price) : '0.00'}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
                      </div>
                    </div>

                    <motion.button whileTap={tapScale} onClick={startNegotiation} disabled={negLoading || !negSupplier}
                      style={{ width: '100%', background: negSupplier ? 'rgba(245,158,11,0.14)' : 'rgba(240,236,228,0.04)', border: negSupplier ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(240,236,228,0.06)', borderRadius: '10px', padding: '0.75rem', color: negSupplier ? 'rgb(245,158,11)' : 'rgba(240,236,228,0.24)', fontSize: '0.75rem', fontWeight: 700, cursor: negSupplier ? 'pointer' : 'not-allowed' }}>
                      {negLoading ? '🧠 A gerar estratégia de negociação…' : '🤝 Iniciar Negociação AI'}
                    </motion.button>

                    {negMessage && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'rgba(245,158,11,0.05)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgb(245,158,11)', marginBottom: '0.4rem' }}>✉️ Rascunho de Email AI</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgb(170,185,205)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{negMessage}</div>
                      </motion.div>
                    )}
                  </div>
                )}

              </motion.div>
            )}

            {/* Empty state */}
            {panelMode === 'list' && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'rgba(240,236,228,0.24)', textAlign: 'center', border: '1px dashed rgba(240,236,228,0.06)', borderRadius: '16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.4 }}>🤝</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.25rem' }}>Procurement AI Engine</div>
                <div style={{ fontSize: '0.72rem', maxWidth: '280px', lineHeight: 1.6 }}>
                  Selecciona um RFQ para ver detalhes, propostas e negociação autónoma.
                </div>
                <motion.button whileTap={tapScale} onClick={() => setPanelMode('create')}
                  style={{ marginTop: '1.25rem', background: 'rgba(154,124,74,0.12)', border: '1px solid rgba(154,124,74,0.28)', borderRadius: '10px', padding: '0.625rem 1.25rem', color: '#d4b47a', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Criar primeiro RFQ
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </PortalLayout>
  );
}
