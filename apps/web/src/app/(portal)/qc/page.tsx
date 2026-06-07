'use client';

// ── OMEGA X — S5: Computer Vision Quality Control ────────────────────────────
//
// AI-powered QC inspection dashboard with image analysis, defect logging,
// supplier quality scoring, and pass/fail management.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inspection {
  id: string; reference_type: string; reference_id: string;
  supplier_name?: string; product_name: string; batch_number?: string;
  quantity_inspected: number; quantity_passed: number; quantity_failed: number;
  pass_rate: number; overall_score?: number;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'partial';
  ai_summary?: string; inspector_notes?: string;
  inspection_date?: string; created_at: string;
}

interface QCImage {
  id: string; inspection_id: string; image_url: string;
  image_type: string; ai_score?: number; ai_labels?: string[];
  ai_defects?: string[]; ai_confidence?: number; analyzed: boolean;
  uploaded_at: string;
}

interface Defect {
  id: string; defect_type: string; severity: string;
  description?: string; quantity: number; ai_detected: boolean;
  resolution?: string; resolved: boolean; created_at: string;
}

type PanelMode = 'list' | 'detail' | 'create' | 'analytics';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendente',    color: 'rgba(240,236,228,0.24)',   bg: 'rgba(80,92,110,0.12)' },
  in_progress: { label: 'Em Curso',   color: '#d4b47a',  bg: 'rgba(154,124,74,0.12)' },
  passed:      { label: 'Aprovado',   color: '#b8975e',  bg: 'rgba(184,151,94,0.12)' },
  failed:      { label: 'Reprovado',  color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)' },
  partial:     { label: 'Parcial',    color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.12)' },
};

const SEVERITY_CFG: Record<string, { color: string; bg: string }> = {
  minor:    { color: 'rgb(245,158,11)',  bg: 'rgba(245,158,11,0.1)' },
  major:    { color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.1)' },
  critical: { color: 'rgb(220,38,38)',   bg: 'rgba(220,38,38,0.18)' },
};

const DEFECT_TYPES = ['color_mismatch','print_quality','damage','size_error','missing_component','contamination','other'];

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#b8975e' : score >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)';
  const circ = (size * 0.78) * Math.PI;
  const r = size * 0.39;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth={size * 0.07} />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size * 0.07}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${(score / 100) * circ} ${circ}` }}
          transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.22, fontWeight: 800, color }}>
        {score}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontSize: '0.62rem', fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QCPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [images, setImages] = useState<QCImage[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('list');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create form
  const [createForm, setCreateForm] = useState({
    reference_id: '', product_name: '', supplier_name: '',
    batch_number: '', quantity_inspected: '', reference_type: 'order',
  });

  // Defect form
  const [defectForm, setDefectForm] = useState({
    defect_type: 'other', severity: 'minor', description: '', quantity: '1', resolution: '',
  });

  // Image form
  const [imageUrl, setImageUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Close form
  const [closeForm, setCloseForm] = useState({ quantity_passed: '', quantity_failed: '', inspector_notes: '' });

  function setCreate(k: string, v: string) { setCreateForm(f => ({ ...f, [k]: v })); }
  function setDefect(k: string, v: string) { setDefectForm(f => ({ ...f, [k]: v })); }

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/qc?mode=list');
      if (res.ok) { const d = await res.json(); setInspections(d.inspections ?? []); }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login?next=/qc');
    });
    loadList();
  }, [router, loadList]);

  async function loadDetail(insp: Inspection) {
    setSelected(insp);
    const res = await fetch(`/api/qc?mode=detail&id=${insp.id}`);
    if (res.ok) {
      const d = await res.json();
      setImages(d.images ?? []);
      setDefects(d.defects ?? []);
    }
    setPanelMode('detail');
  }

  async function loadAnalytics() {
    setAnalytics(null);
    setPanelMode('analytics');
    const res = await fetch('/api/qc?mode=analytics');
    if (res.ok) { const d = await res.json(); setAnalytics(d); }
  }

  async function submitCreate() {
    if (!createForm.reference_id || !createForm.product_name) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...createForm, quantity_inspected: Number(createForm.quantity_inspected || 0) }),
      });
      if (res.ok) {
        const d = await res.json();
        setActionSuccess('Inspeção criada!');
        await loadList();
        await loadDetail(d.inspection as Inspection);
        setCreateForm({ reference_id:'', product_name:'', supplier_name:'', batch_number:'', quantity_inspected:'', reference_type:'order' });
      }
    } catch { /* non-fatal */ }
    setActionLoading(false);
  }

  async function submitAnalyzeImage() {
    if (!selected || !imageUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          inspection_id: selected.id,
          image_url: imageUrl,
          product_name: selected.product_name,
          context: `Inspeção ${selected.reference_id}`,
        }),
      });
      if (res.ok) {
        setActionSuccess('Imagem analisada com AI!');
        await loadDetail(selected);
        setImageUrl('');
      }
    } catch { /* non-fatal */ }
    setAnalyzing(false);
  }

  async function submitAddDefect() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_defect',
          inspection_id: selected.id,
          ...defectForm,
          quantity: Number(defectForm.quantity || 1),
        }),
      });
      if (res.ok) {
        setActionSuccess('Defeito registado!');
        await loadDetail(selected);
        setDefectForm({ defect_type:'other', severity:'minor', description:'', quantity:'1', resolution:'' });
      }
    } catch { /* non-fatal */ }
    setActionLoading(false);
  }

  async function submitClose() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          inspection_id: selected.id,
          quantity_passed: Number(closeForm.quantity_passed || 0),
          quantity_failed: Number(closeForm.quantity_failed || 0),
          inspector_notes: closeForm.inspector_notes,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setActionSuccess(`Inspeção concluída — Score: ${d.overall_score}/100 (${d.status})`);
        await loadList();
        await loadDetail({ ...selected, ...d.inspection } as Inspection);
      }
    } catch { /* non-fatal */ }
    setActionLoading(false);
  }

  const filtered = inspections.filter(i => statusFilter === 'all' || i.status === statusFilter);

  return (
    <PortalLayout>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#090907' }}>

        {/* ─── Left: Inspection List ─── */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(240,236,228,0.06)', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '1.125rem 1rem 0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <h1 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>🔬 QC Inspeções</h1>
                <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>{inspections.length} inspeções</div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <motion.button whileTap={tapScale} onClick={loadAnalytics}
                  style={{ padding: '0.35rem 0.5rem', background: 'rgba(154,124,74,0.10)', border: '1px solid rgba(154,124,74,0.22)', borderRadius: '7px', color: '#d4b47a', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                  Analytics
                </motion.button>
                <motion.button whileTap={tapScale} onClick={() => { setPanelMode('create'); setSelected(null); }}
                  style={{ padding: '0.35rem 0.5rem', background: 'rgba(184,151,94,0.10)', border: '1px solid rgba(99,230,190,0.25)', borderRadius: '7px', color: '#b8975e', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Nova
                </motion.button>
              </div>
            </div>

            {/* Status filters */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {['all','pending','in_progress','passed','failed','partial'].map(s => (
                <button type="button" key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '0.18rem 0.45rem', borderRadius: '5px', fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: statusFilter === s ? 'rgba(154,124,74,0.14)' : 'rgba(240,236,228,0.04)', color: statusFilter === s ? '#d4b47a' : 'rgba(240,236,228,0.24)', borderColor: statusFilter === s ? 'rgba(154,124,74,0.28)' : 'transparent' }}>
                  {s === 'all' ? 'Todos' : STATUS_CFG[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(240,236,228,0.04)', marginBottom: '0.375rem' }}>
                  <div style={{ height: '3px', width: '60%', background: 'rgba(240,236,228,0.06)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                  <div style={{ height: '3px', width: '40%', background: 'rgba(240,236,228,0.04)', borderRadius: '4px' }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>
                Nenhuma inspeção encontrada.
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((insp, idx) => (
                  <motion.div
                    key={insp.id} layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ ...springSnappy, delay: idx * 0.03 }}
                    onClick={() => loadDetail(insp)}
                    style={{
                      padding: '0.75rem', borderRadius: '10px', marginBottom: '0.375rem',
                      background: selected?.id === insp.id ? 'rgba(154,124,74,0.08)' : 'rgba(240,236,228,0.04)',
                      border: `1px solid ${selected?.id === insp.id ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.06)'}`,
                      cursor: 'pointer', transition: 'all 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(190,205,225)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{insp.product_name}</div>
                        {insp.supplier_name && <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{insp.supplier_name}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        <StatusBadge status={insp.status} />
                        {insp.overall_score != null && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: insp.overall_score >= 80 ? '#b8975e' : insp.overall_score >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' }}>
                            {insp.overall_score}/100
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>
                      <span>{insp.quantity_inspected} un inspecionadas</span>
                      <span>✓ {insp.quantity_passed} ✗ {insp.quantity_failed}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ─── Right: Panel ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', minWidth: 0 }}>
          {actionSuccess && (
            <motion.div {...fadeUp}
              style={{ marginBottom: '1rem', padding: '0.625rem 1rem', background: 'rgba(184,151,94,0.08)', border: '1px solid rgba(184,151,94,0.18)', borderRadius: '10px', color: '#b8975e', fontSize: '0.75rem', fontWeight: 600 }}>
              ✓ {actionSuccess}
            </motion.div>
          )}

          <AnimatePresence mode="wait">

            {/* Empty list */}
            {panelMode === 'list' && (
              <motion.div key="list" {...fadeUp} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '0.75rem', color: 'rgba(240,236,228,0.24)' }}>
                <div style={{ fontSize: '2rem' }}>🔬</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)' }}>Selecciona uma inspeção</div>
                <div style={{ fontSize: '0.72rem' }}>ou cria uma nova inspecção de qualidade</div>
              </motion.div>
            )}

            {/* Create */}
            {panelMode === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem', maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>+ Nova Inspeção QC</h2>
                    <button type="button" onClick={() => setPanelMode('list')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer' }}>✕</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { label: 'Referência (nº encomenda) *', key: 'reference_id', placeholder: 'Ex: ORD-2024-001' },
                      { label: 'Nome do Produto *', key: 'product_name', placeholder: 'Ex: Caneca cerâmica' },
                      { label: 'Fornecedor', key: 'supplier_name', placeholder: 'Ex: Midocean' },
                      { label: 'Nº de Lote', key: 'batch_number', placeholder: 'Ex: LOT-2024-01' },
                      { label: 'Qtd. a inspecionar', key: 'quantity_inspected', type: 'number', placeholder: '100' },
                    ].map(f => (
                      <div key={f.key} style={{ gridColumn: f.key === 'quantity_inspected' ? '1' : 'auto' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>{f.label}</div>
                        <input type={f.type ?? 'text'} value={createForm[f.key as keyof typeof createForm]} onChange={e => setCreate(f.key, e.target.value)} placeholder={f.placeholder}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.55rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }} />
                      </div>
                    ))}

                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Tipo de Referência</div>
                      <select value={createForm.reference_type} onChange={e => setCreate('reference_type', e.target.value)}
                        style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.55rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }}>
                        {['order','rfq','supplier','inventory'].map(t => <option key={t} value={t} style={{ background: 'rgb(14,22,36)' }}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <motion.button whileTap={tapScale} onClick={submitCreate} disabled={actionLoading || !createForm.reference_id || !createForm.product_name}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.7rem', background: 'rgba(154,124,74,0.14)', border: '1px solid rgba(77,163,255,0.35)', borderRadius: '10px', color: '#d4b47a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    {actionLoading ? '⏳ A criar…' : '+ Iniciar Inspeção'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Detail */}
            {panelMode === 'detail' && selected && (
              <motion.div key={`detail-${selected.id}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: '0 0 0.2rem' }}>{selected.product_name}</h2>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)' }}>
                      Ref: {selected.reference_id} {selected.supplier_name ? `· ${selected.supplier_name}` : ''} {selected.batch_number ? `· Lote: ${selected.batch_number}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {selected.overall_score != null && <ScoreRing score={selected.overall_score} />}
                    <StatusBadge status={selected.status} />
                  </div>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Inspecionadas', value: selected.quantity_inspected, color: '#d4b47a' },
                    { label: 'Aprovadas', value: selected.quantity_passed, color: '#b8975e' },
                    { label: 'Reprovadas', value: selected.quantity_failed, color: 'rgb(239,68,68)' },
                    { label: 'Pass Rate', value: `${Number(selected.pass_rate ?? 0).toFixed(1)}%`, color: Number(selected.pass_rate ?? 0) >= 95 ? '#b8975e' : Number(selected.pass_rate ?? 0) >= 70 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
                      <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* AI Summary */}
                {selected.ai_summary && (
                  <motion.div {...fadeUp} style={{ marginBottom: '1rem', padding: '0.875rem', background: 'rgba(167,139,250,0.06)', borderRadius: '12px', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgb(167,139,250)', marginBottom: '0.35rem' }}>🧠 Resumo AI</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgb(160,175,200)', lineHeight: 1.6 }}>{selected.ai_summary}</div>
                  </motion.div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                  {/* CV Image Analysis */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>📸 Análise de Imagens (CV)</h3>

                    {/* Add image */}
                    {['in_progress', 'pending'].includes(selected.status) && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="URL da imagem do produto…"
                            style={{ flex: 1, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.45rem 0.625rem', color: 'rgb(200,215,235)', fontSize: '0.72rem' }} />
                          <motion.button whileTap={tapScale} onClick={submitAnalyzeImage} disabled={analyzing || !imageUrl}
                            style={{ padding: '0.45rem 0.625rem', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: 'rgb(167,139,250)', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {analyzing ? '⏳' : '🔍 Analisar'}
                          </motion.button>
                        </div>
                      </div>
                    )}

                    {images.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.68rem' }}>Nenhuma imagem adicionada.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                        {images.map(img => (
                          <div key={img.id} style={{ padding: '0.625rem', background: 'rgba(240,236,228,0.04)', borderRadius: '8px', border: '1px solid rgba(240,236,228,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>{img.image_type}</span>
                              {img.ai_score != null && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: img.ai_score >= 80 ? '#b8975e' : img.ai_score >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' }}>
                                  Score: {img.ai_score}/100
                                </span>
                              )}
                            </div>
                            {img.ai_defects && img.ai_defects.length > 0 && (
                              <div style={{ fontSize: '0.6rem', color: 'rgb(239,68,68)' }}>
                                Defeitos detectados: {img.ai_defects.join(', ')}
                              </div>
                            )}
                            {img.ai_labels && img.ai_labels.length > 0 && (
                              <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>
                                Labels: {img.ai_labels.slice(0, 4).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Defects */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>⚠️ Defeitos Registados</h3>

                    {/* Add defect */}
                    {['in_progress', 'pending'].includes(selected.status) && (
                      <div style={{ marginBottom: '0.75rem', padding: '0.625rem', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginBottom: '0.35rem' }}>
                          <select value={defectForm.defect_type} onChange={e => setDefect('defect_type', e.target.value)}
                            style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', padding: '0.4rem', color: 'rgb(200,215,235)', fontSize: '0.65rem' }}>
                            {DEFECT_TYPES.map(t => <option key={t} value={t} style={{ background: 'rgb(14,22,36)' }}>{t.replace('_',' ')}</option>)}
                          </select>
                          <select value={defectForm.severity} onChange={e => setDefect('severity', e.target.value)}
                            style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', padding: '0.4rem', color: 'rgb(200,215,235)', fontSize: '0.65rem' }}>
                            {['minor','major','critical'].map(s => <option key={s} value={s} style={{ background: 'rgb(14,22,36)' }}>{s}</option>)}
                          </select>
                        </div>
                        <input value={defectForm.description} onChange={e => setDefect('description', e.target.value)} placeholder="Descrição do defeito"
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', padding: '0.4rem 0.5rem', color: 'rgb(200,215,235)', fontSize: '0.65rem', marginBottom: '0.35rem' }} />
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <input type="number" value={defectForm.quantity} onChange={e => setDefect('quantity', e.target.value)} placeholder="Qtd"
                            style={{ width: '60px', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', padding: '0.4rem', color: 'rgb(200,215,235)', fontSize: '0.65rem' }} />
                          <motion.button whileTap={tapScale} onClick={submitAddDefect} disabled={actionLoading}
                            style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', color: 'rgb(239,68,68)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                            + Adicionar Defeito
                          </motion.button>
                        </div>
                      </div>
                    )}

                    {defects.length === 0 ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.68rem' }}>Nenhum defeito registado.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {defects.map(d => {
                          const sev = SEVERITY_CFG[d.severity] ?? SEVERITY_CFG.minor;
                          return (
                            <div key={d.id} style={{ padding: '0.5rem 0.625rem', background: sev.bg, borderRadius: '7px', border: `1px solid ${sev.color}22` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: sev.color }}>{d.defect_type.replace('_',' ')}</span>
                                <span style={{ fontSize: '0.58rem', color: sev.color }}>{d.severity} · ×{d.quantity}</span>
                              </div>
                              {d.description && <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.42)', marginTop: '0.15rem' }}>{d.description}</div>}
                              {d.ai_detected && <div style={{ fontSize: '0.58rem', color: 'rgb(167,139,250)', marginTop: '0.1rem' }}>🤖 Detectado por AI</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Close inspection */}
                {['in_progress', 'pending'].includes(selected.status) && (
                  <div className="yg-card" style={{ padding: '1rem', marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>✓ Concluir Inspeção</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.25rem' }}>Qtd. Aprovadas</div>
                        <input type="number" value={closeForm.quantity_passed} onChange={e => setCloseForm(f => ({ ...f, quantity_passed: e.target.value }))} placeholder="0"
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.75rem' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.25rem' }}>Qtd. Reprovadas</div>
                        <input type="number" value={closeForm.quantity_failed} onChange={e => setCloseForm(f => ({ ...f, quantity_failed: e.target.value }))} placeholder="0"
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.75rem' }} />
                      </div>
                    </div>
                    <textarea value={closeForm.inspector_notes} onChange={e => setCloseForm(f => ({ ...f, inspector_notes: e.target.value }))} rows={2}
                      placeholder="Notas do inspetor (opcional)"
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '0.5rem 0.625rem', color: 'rgb(200,215,235)', fontSize: '0.72rem', resize: 'vertical', lineHeight: 1.5, marginBottom: '0.625rem' }} />
                    <motion.button whileTap={tapScale} onClick={submitClose} disabled={actionLoading}
                      style={{ width: '100%', padding: '0.65rem', background: 'rgba(184,151,94,0.14)', border: '1px solid rgba(99,230,190,0.3)', borderRadius: '9px', color: '#b8975e', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      {actionLoading ? '⏳ A concluir…' : '✓ Fechar & Calcular Score AI'}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Analytics */}
            {panelMode === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>📊 Analytics QC</h2>
                  <button type="button" onClick={() => setPanelMode('list')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Fechar</button>
                </div>

                {!analytics ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>A carregar…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                      {[
                        { label: 'Total Inspeções', value: String(analytics.total_inspections ?? 0), color: '#d4b47a' },
                        { label: 'Aprovadas', value: String(analytics.passed ?? 0), color: '#b8975e' },
                        { label: 'Reprovadas', value: String(analytics.failed ?? 0), color: 'rgb(239,68,68)' },
                        { label: 'Score Médio', value: `${Number(analytics.avg_score ?? 0).toFixed(1)}/100`, color: 'rgb(167,139,250)' },
                        { label: 'Pass Rate Médio', value: `${Number(analytics.avg_pass_rate ?? 0).toFixed(1)}%`, color: 'rgb(245,158,11)' },
                        { label: 'Pendentes', value: String(analytics.pending ?? 0), color: 'rgba(240,236,228,0.24)' },
                      ].map(k => (
                        <div key={k.label} style={{ padding: '0.875rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>{k.value}</div>
                          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{k.label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Defect breakdown */}
                      {!!(analytics.defect_breakdown) && Object.keys(analytics.defect_breakdown as object).length > 0 && (
                        <div className="yg-card" style={{ padding: '1rem' }}>
                          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Tipos de Defeito</h3>
                          {Object.entries(analytics.defect_breakdown as Record<string, number>).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
                            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                              <span style={{ fontSize: '0.68rem', color: 'rgb(150,165,185)' }}>{type.replace('_',' ')}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(239,68,68)' }}>{count}×</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Supplier scores */}
                      {Array.isArray(analytics.supplier_scores) && (analytics.supplier_scores as unknown[]).length > 0 && (
                        <div className="yg-card" style={{ padding: '1rem' }}>
                          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Score por Fornecedor</h3>
                          {(analytics.supplier_scores as Array<{ name: string; avg_score: number; inspection_count: number }>).map(s => (
                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                              <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(170,185,205)' }}>{s.name}</div>
                                <div style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)' }}>{s.inspection_count} inspeções</div>
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: s.avg_score >= 80 ? '#b8975e' : s.avg_score >= 60 ? 'rgb(245,158,11)' : 'rgb(239,68,68)' }}>
                                {s.avg_score.toFixed(0)}/100
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PortalLayout>
  );
}
