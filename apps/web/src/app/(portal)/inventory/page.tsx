'use client';

// ── OMEGA X — S3: Global Inventory + Warehouse Intelligence ──────────────────
//
// Real-time inventory dashboard with warehouse management, movement history,
// AI demand forecasting, reorder intelligence, and value analytics.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string; sku: string; product_name: string; category?: string;
  supplier_name?: string; quantity: number; reserved_qty: number;
  available_qty: number; unit_cost?: number; total_value?: number;
  reorder_point: number; reorder_qty: number; lead_time_days?: number;
  warehouse_id?: string; location_code?: string; batch_number?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'reserved' | 'quarantine';
  ai_forecast?: Record<string, unknown>;
  last_counted_at?: string; updated_at: string;
}

interface Warehouse {
  id: string; name: string; country: string; city?: string;
  type: string; capacity_m3?: number; utilisation_pct: number;
  stats?: { items: number; value: number };
}

interface Movement {
  id: string; movement_type: string; quantity: number;
  unit_cost?: number; reference_type?: string; notes?: string;
  performed_at: string;
}

interface AddForm {
  sku: string; product_name: string; category: string;
  supplier_name: string; quantity: string; unit_cost: string;
  reorder_point: string; reorder_qty: string; lead_time_days: string;
  warehouse_id: string; location_code: string;
}

type PanelMode = 'list' | 'detail' | 'add' | 'move' | 'analytics';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  in_stock:      { label: 'Em Stock',    color: '#b8975e',   bg: 'rgba(184,151,94,0.10)',   dot: '#63e6be' },
  low_stock:     { label: 'Stock Baixo', color: 'rgb(245,158,11)',   bg: 'rgba(245,158,11,0.1)',   dot: '#f59e0b' },
  out_of_stock:  { label: 'Esgotado',   color: 'rgb(239,68,68)',    bg: 'rgba(239,68,68,0.1)',    dot: '#ef4444' },
  reserved:      { label: 'Reservado',  color: '#d4b47a',   bg: 'rgba(154,124,74,0.10)',   dot: '#d4b47a' },
  quarantine:    { label: 'Quarentena', color: 'rgb(167,139,250)',  bg: 'rgba(167,139,250,0.1)',  dot: '#a78bfa' },
};

const MOVEMENT_ICONS: Record<string, string> = {
  receipt: '📦', dispatch: '🚚', transfer: '🔄', adjustment: '✏️', return: '↩️', write_off: '🗑️',
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
}
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.in_stock;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontSize: '0.62rem', fontWeight: 700 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function StockBar({ qty, reorder, capacity = 500 }: { qty: number; reorder: number; capacity?: number }) {
  const pct = Math.min(100, (qty / Math.max(capacity, qty + 1)) * 100);
  const color = qty <= 0 ? 'rgb(239,68,68)' : qty <= reorder ? 'rgb(245,158,11)' : '#b8975e';
  return (
    <div style={{ height: '4px', background: 'rgba(240,236,228,0.06)', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
        style={{ height: '100%', background: color, borderRadius: '9999px' }}
      />
      {/* Reorder point marker */}
      <div style={{ position: 'absolute', top: -1, height: '6px', width: '2px', background: 'rgba(245,158,11,0.7)', borderRadius: '1px', left: `${Math.min(100, (reorder / Math.max(capacity, qty + 1)) * 100)}%` }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('list');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reorderRecs, setReorderRecs] = useState<Record<string, unknown>[] | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [addForm, setAddForm] = useState<AddForm>({
    sku: '', product_name: '', category: '', supplier_name: '',
    quantity: '', unit_cost: '', reorder_point: '10', reorder_qty: '50',
    lead_time_days: '14', warehouse_id: '', location_code: '',
  });
  const [moveForm, setMoveForm] = useState({
    movement_type: 'receipt', quantity: '', notes: '', reference_type: 'manual',
  });
  const [addError, setAddError] = useState('');

  function setAdd(k: string, v: string) { setAddForm(f => ({ ...f, [k]: v })); }

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory?mode=list');
      if (res.ok) {
        const d = await res.json();
        setItems(d.items ?? []);
        setWarehouses(d.warehouses ?? []);
        setSummary(d.summary ?? null);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login?next=/inventory');
    });
    loadList();
  }, [router, loadList]);

  async function loadDetail(item: InventoryItem) {
    setSelectedItem(item);
    setForecast(null);
    const res = await fetch(`/api/inventory?mode=item&id=${item.id}`);
    if (res.ok) {
      const d = await res.json();
      setMovements(d.movements ?? []);
    }
    setPanelMode('detail');
  }

  async function loadAnalytics() {
    setAnalytics(null);
    setPanelMode('analytics');
    const res = await fetch('/api/inventory?mode=analytics');
    if (res.ok) {
      const d = await res.json();
      setAnalytics(d);
    }
  }

  async function loadForecast(sku: string) {
    setForecastLoading(true);
    const res = await fetch(`/api/inventory?mode=forecast&sku=${encodeURIComponent(sku)}`);
    if (res.ok) {
      const d = await res.json();
      setForecast(d.forecast ?? null);
    }
    setForecastLoading(false);
  }

  async function submitAdd() {
    if (!addForm.sku || !addForm.product_name) { setAddError('SKU e nome são obrigatórios.'); return; }
    setActionLoading(true); setAddError('');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_item',
          ...addForm,
          quantity: Number(addForm.quantity || 0),
          unit_cost: addForm.unit_cost ? Number(addForm.unit_cost) : undefined,
          reorder_point: Number(addForm.reorder_point || 0),
          reorder_qty: Number(addForm.reorder_qty || 0),
          lead_time_days: addForm.lead_time_days ? Number(addForm.lead_time_days) : undefined,
          warehouse_id: addForm.warehouse_id || undefined,
        }),
      });
      if (res.ok) {
        setActionSuccess('Item adicionado com sucesso!');
        await loadList();
        setPanelMode('list');
        setAddForm({ sku:'',product_name:'',category:'',supplier_name:'',quantity:'',unit_cost:'',reorder_point:'10',reorder_qty:'50',lead_time_days:'14',warehouse_id:'',location_code:'' });
      } else {
        const d = await res.json();
        setAddError(d.error ?? 'Erro');
      }
    } catch { setAddError('Erro de rede.'); }
    setActionLoading(false);
  }

  async function submitMove() {
    if (!selectedItem || !moveForm.quantity) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          inventory_id: selectedItem.id,
          movement_type: moveForm.movement_type,
          quantity: Number(moveForm.quantity),
          notes: moveForm.notes,
          reference_type: moveForm.reference_type,
        }),
      });
      if (res.ok) {
        setActionSuccess('Movimento registado!');
        await loadDetail(selectedItem);
        await loadList();
        setMoveForm({ movement_type:'receipt', quantity:'', notes:'', reference_type:'manual' });
        setPanelMode('detail');
      }
    } catch { /* non-fatal */ }
    setActionLoading(false);
  }

  async function getReorderRecs() {
    setActionLoading(true);
    const res = await fetch('/api/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ai_reorder' }),
    });
    if (res.ok) {
      const d = await res.json();
      setReorderRecs(d.recommendations ?? []);
    }
    setActionLoading(false);
  }

  const filtered = items.filter(i => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || i.sku.toLowerCase().includes(q) || i.product_name.toLowerCase().includes(q) || (i.supplier_name ?? '').toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || i.status === statusFilter;
    return matchQ && matchS;
  });

  const alertItems = items.filter(i => ['low_stock','out_of_stock'].includes(i.status));

  return (
    <PortalLayout>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#090907' }}>

        {/* ─── Left: Inventory List ─── */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(240,236,228,0.06)', height: '100%', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '1.125rem 1rem 0.875rem', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <h1 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>📦 Inventário</h1>
                <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>
                  {items.length} SKUs · {fmtEur(Number(summary?.total_value ?? 0))} valor total
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <motion.button whileTap={tapScale} onClick={loadAnalytics}
                  style={{ padding: '0.35rem 0.625rem', background: 'rgba(154,124,74,0.10)', border: '1px solid rgba(154,124,74,0.22)', borderRadius: '8px', color: '#d4b47a', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                  Analytics
                </motion.button>
                <motion.button whileTap={tapScale} onClick={() => { setPanelMode('add'); setSelectedItem(null); setAddError(''); }}
                  style={{ padding: '0.35rem 0.625rem', background: 'rgba(184,151,94,0.10)', border: '1px solid rgba(184,151,94,0.22)', borderRadius: '8px', color: '#b8975e', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Novo
                </motion.button>
              </div>
            </div>

            {/* Alert banner */}
            {alertItems.length > 0 && (
              <motion.div {...fadeUp} style={{ padding: '0.5rem 0.625rem', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.62rem', color: 'rgb(245,158,11)', fontWeight: 700 }}>
                  ⚠️ {alertItems.length} item{alertItems.length > 1 ? 's' : ''} a precisar de reabastecimento
                </div>
                <motion.button whileTap={tapScale} onClick={getReorderRecs} disabled={actionLoading}
                  style={{ marginTop: '0.3rem', fontSize: '0.58rem', color: 'rgb(245,158,11)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  🧠 Obter recomendações AI →
                </motion.button>
              </motion.div>
            )}

            {/* Search */}
            <input
              placeholder="Pesquisar SKU, produto, fornecedor…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.5rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.75rem', marginBottom: '0.5rem' }}
            />

            {/* Status filter */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {['all','in_stock','low_stock','out_of_stock'].map(s => (
                <button type="button" key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: statusFilter === s ? 'rgba(154,124,74,0.14)' : 'rgba(240,236,228,0.04)', color: statusFilter === s ? '#d4b47a' : 'rgba(240,236,228,0.24)', borderColor: statusFilter === s ? 'rgba(154,124,74,0.28)' : 'transparent' }}>
                  {s === 'all' ? 'Todos' : STATUS_CFG[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          {/* Item list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(240,236,228,0.04)', marginBottom: '0.375rem' }}>
                  <div style={{ height: '3px', width: '70%', background: 'rgba(240,236,228,0.06)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                  <div style={{ height: '3px', width: '40%', background: 'rgba(240,236,228,0.04)', borderRadius: '4px' }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>
                Nenhum item encontrado.<br />
                <button type="button" onClick={() => setPanelMode('add')} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#d4b47a', cursor: 'pointer', fontSize: '0.72rem' }}>
                  + Adicionar primeiro item
                </button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ ...springSnappy, delay: idx * 0.03 }}
                    onClick={() => loadDetail(item)}
                    style={{
                      padding: '0.75rem 0.875rem', borderRadius: '10px', marginBottom: '0.375rem',
                      background: selectedItem?.id === item.id ? 'rgba(154,124,74,0.08)' : 'rgba(240,236,228,0.04)',
                      border: `1px solid ${selectedItem?.id === item.id ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.06)'}`,
                      cursor: 'pointer', transition: 'all 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(200,215,235)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>
                          SKU: {item.sku}
                        </div>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <StockBar qty={item.quantity} reorder={item.reorder_point} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.62rem', color: 'rgba(240,236,228,0.42)' }}>
                      <span><b style={{ color: item.quantity <= item.reorder_point ? 'rgb(245,158,11)' : 'rgb(150,165,185)' }}>{item.quantity}</b> un</span>
                      {item.total_value ? <span>{fmtEur(Number(item.total_value))}</span> : null}
                      {item.supplier_name && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{item.supplier_name}</span>}
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
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginBottom: '1rem', padding: '0.625rem 1rem', background: 'rgba(184,151,94,0.08)', border: '1px solid rgba(184,151,94,0.18)', borderRadius: '10px', color: '#b8975e', fontSize: '0.75rem', fontWeight: 600 }}>
              ✓ {actionSuccess}
            </motion.div>
          )}

          <AnimatePresence mode="wait">

            {/* List mode — reorder recs */}
            {panelMode === 'list' && (
              <motion.div key="list" {...fadeUp}>
                {reorderRecs ? (
                  <div className="yg-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>🧠 Recomendações AI de Reorder</h2>
                      <button type="button" onClick={() => setReorderRecs(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Fechar</button>
                    </div>
                    {reorderRecs.length === 0 ? (
                      <div style={{ color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>Nenhuma recomendação disponível de momento.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {reorderRecs.map((rec, i) => (
                          <div key={i} style={{ padding: '0.875rem', background: 'rgba(245,158,11,0.05)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.3rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgb(200,215,235)' }}>{String(rec.product_name ?? rec.sku)}</span>
                              <span style={{ fontSize: '0.58rem', padding: '0.15rem 0.4rem', borderRadius: '5px', background: rec.urgency === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: rec.urgency === 'high' ? 'rgb(239,68,68)' : 'rgb(245,158,11)', fontWeight: 700 }}>{String(rec.urgency ?? '').toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.42)' }}>{String(rec.action ?? '')} — Qty: <b style={{ color: 'rgb(200,215,235)' }}>{Number(rec.qty ?? 0)}</b></div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.2rem' }}>{String(rec.reason ?? '')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(240,236,228,0.24)', gap: '0.75rem' }}>
                    <div style={{ fontSize: '2rem' }}>📦</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(240,236,228,0.42)' }}>Selecciona um item para ver detalhes</div>
                    <div style={{ fontSize: '0.72rem' }}>ou adiciona um novo item ao inventário</div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Add Item */}
            {panelMode === 'add' && (
              <motion.div key="add" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem', maxWidth: '720px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>+ Novo Item de Inventário</h2>
                    <button type="button" onClick={() => setPanelMode('list')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Cancelar</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { label: 'SKU *', key: 'sku', placeholder: 'Ex: MUG-CER-300ML' },
                      { label: 'Nome do Produto *', key: 'product_name', placeholder: 'Ex: Caneca cerâmica 300ml' },
                      { label: 'Categoria', key: 'category', placeholder: 'Ex: drinkware' },
                      { label: 'Fornecedor', key: 'supplier_name', placeholder: 'Ex: Midocean' },
                      { label: 'Quantidade inicial', key: 'quantity', type: 'number', placeholder: '0' },
                      { label: 'Custo unitário (€)', key: 'unit_cost', type: 'number', placeholder: '2.50' },
                      { label: 'Reorder point', key: 'reorder_point', type: 'number', placeholder: '10' },
                      { label: 'Qtd. reorder', key: 'reorder_qty', type: 'number', placeholder: '50' },
                      { label: 'Lead time (dias)', key: 'lead_time_days', type: 'number', placeholder: '14' },
                      { label: 'Código de localização', key: 'location_code', placeholder: 'Ex: A1-B3' },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>{f.label}</div>
                        <input type={f.type ?? 'text'} value={addForm[f.key as keyof AddForm]} onChange={e => setAdd(f.key, e.target.value)} placeholder={f.placeholder}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.55rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }} />
                      </div>
                    ))}

                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Armazém</div>
                      <select value={addForm.warehouse_id} onChange={e => setAdd('warehouse_id', e.target.value)}
                        style={{ width: '100%', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.55rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }}>
                        <option value="" style={{ background: 'rgb(14,22,36)' }}>Sem armazém</option>
                        {warehouses.map(w => <option key={w.id} value={w.id} style={{ background: 'rgb(14,22,36)' }}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {addError && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', color: 'rgb(239,68,68)', fontSize: '0.72rem' }}>{addError}</div>
                  )}

                  <motion.button whileTap={tapScale} onClick={submitAdd} disabled={actionLoading}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.7rem', background: 'rgba(184,151,94,0.14)', border: '1px solid rgba(184,151,94,0.28)', borderRadius: '10px', color: '#b8975e', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    {actionLoading ? '⏳ A criar…' : '✓ Criar Item'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Item Detail */}
            {panelMode === 'detail' && selectedItem && (
              <motion.div key={`detail-${selectedItem.id}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>{selectedItem.product_name}</h2>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.2rem' }}>SKU: {selectedItem.sku} {selectedItem.supplier_name ? `· ${selectedItem.supplier_name}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <motion.button whileTap={tapScale} onClick={() => setPanelMode('move')}
                      style={{ padding: '0.4rem 0.75rem', background: 'rgba(154,124,74,0.12)', border: '1px solid rgba(154,124,74,0.28)', borderRadius: '8px', color: '#d4b47a', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Movimento
                    </motion.button>
                    <motion.button whileTap={tapScale} onClick={() => loadForecast(selectedItem.sku)} disabled={forecastLoading}
                      style={{ padding: '0.4rem 0.75rem', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: 'rgb(167,139,250)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                      {forecastLoading ? '⏳' : '🔮 Forecast AI'}
                    </motion.button>
                  </div>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Stock Total', value: `${selectedItem.quantity} un`, color: 'rgb(200,215,235)' },
                    { label: 'Disponível', value: `${selectedItem.available_qty} un`, color: '#b8975e' },
                    { label: 'Reservado', value: `${selectedItem.reserved_qty} un`, color: '#d4b47a' },
                    { label: 'Valor Total', value: fmtEur(Number(selectedItem.total_value ?? 0)), color: 'rgb(245,158,11)' },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '0.875rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.15rem' }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Details */}
                  <div className="yg-card" style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Detalhes</h3>
                    {[
                      ['Status', <StatusPill key="s" status={selectedItem.status} />],
                      ['Reorder Point', `${selectedItem.reorder_point} un`],
                      ['Qtd. Reorder', `${selectedItem.reorder_qty} un`],
                      ['Lead Time', selectedItem.lead_time_days ? `${selectedItem.lead_time_days} dias` : '—'],
                      ['Custo/un', selectedItem.unit_cost ? fmtEur(Number(selectedItem.unit_cost)) : '—'],
                      ['Localização', selectedItem.location_code ?? '—'],
                      ['Última contagem', fmtDate(selectedItem.last_counted_at)],
                    ].map(([k, v]) => (
                      <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.24)' }}>{k}</span>
                        <span style={{ fontSize: '0.72rem', color: 'rgb(170,185,205)', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Forecast */}
                  {forecast ? (
                    <div className="yg-card" style={{ padding: '1rem' }}>
                      <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>🔮 Forecast AI</h3>
                      {[
                        ['Demand 30d', `${Number(forecast.demand_next_30d ?? 0)} un`],
                        ['Demand 90d', `${Number(forecast.demand_next_90d ?? 0)} un`],
                        ['Reorder sugerido', `${Number(forecast.suggested_reorder_qty ?? 0)} un`],
                        ['Data reorder', String(forecast.reorder_date ?? '—')],
                        ['Risco stockout', `${Number(forecast.stockout_risk_pct ?? 0).toFixed(0)}%`],
                        ['Confiança', `${(Number(forecast.confidence ?? 0) * 100).toFixed(0)}%`],
                      ].map(([k, v]) => (
                        <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.24)' }}>{k}</span>
                          <span style={{ fontSize: '0.72rem', color: 'rgb(170,185,205)', fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                      {forecast.reasoning != null && (
                        <div style={{ marginTop: '0.625rem', padding: '0.5rem', background: 'rgba(167,139,250,0.06)', borderRadius: '8px', fontSize: '0.65rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.5 }}>
                          {String(forecast.reasoning)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="yg-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>🔮</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.24)', textAlign: 'center' }}>Clica em &quot;Forecast AI&quot; para prever a procura</div>
                    </div>
                  )}
                </div>

                {/* Movement history */}
                <div className="yg-card" style={{ padding: '1rem', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Histórico de Movimentos</h3>
                  {movements.length === 0 ? (
                    <div style={{ color: 'rgba(240,236,228,0.24)', fontSize: '0.72rem', textAlign: 'center', padding: '1rem' }}>Sem movimentos registados.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {movements.slice(0, 20).map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                          <span style={{ fontSize: '1rem' }}>{MOVEMENT_ICONS[m.movement_type] ?? '•'}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(170,185,205)', textTransform: 'capitalize' }}>{m.movement_type}</span>
                            {m.notes && <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', marginLeft: '0.35rem' }}>— {m.notes}</span>}
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ['dispatch','transfer','write_off'].includes(m.movement_type) ? 'rgb(239,68,68)' : '#b8975e' }}>
                            {['dispatch','transfer','write_off'].includes(m.movement_type) ? '-' : '+'}{m.quantity} un
                          </span>
                          <span style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)', minWidth: '60px', textAlign: 'right' }}>{fmtDate(m.performed_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Movement Form */}
            {panelMode === 'move' && selectedItem && (
              <motion.div key="move" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div className="yg-card" style={{ padding: '1.5rem', maxWidth: '500px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>Registar Movimento — {selectedItem.product_name}</h2>
                    <button type="button" onClick={() => setPanelMode('detail')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer' }}>✕</button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                    {['receipt','dispatch','adjustment','return','write_off'].map(t => (
                      <button type="button" key={t} onClick={() => setMoveForm(f => ({ ...f, movement_type: t }))}
                        style={{ padding: '0.35rem 0.625rem', borderRadius: '7px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', border: '1px solid transparent', background: moveForm.movement_type === t ? 'rgba(154,124,74,0.14)' : 'rgba(240,236,228,0.04)', color: moveForm.movement_type === t ? '#d4b47a' : 'rgba(240,236,228,0.24)', borderColor: moveForm.movement_type === t ? 'rgba(154,124,74,0.28)' : 'transparent' }}>
                        {MOVEMENT_ICONS[t]} {t.replace('_',' ')}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Quantidade *</div>
                      <input type="number" value={moveForm.quantity} onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.6rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Notas</div>
                      <input value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} placeholder="Referência de encomenda, motivo…"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', padding: '0.6rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.78rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <motion.button whileTap={tapScale} onClick={submitMove} disabled={actionLoading || !moveForm.quantity}
                      style={{ flex: 1, padding: '0.65rem', background: 'rgba(154,124,74,0.14)', border: '1px solid rgba(154,124,74,0.35)', borderRadius: '9px', color: '#d4b47a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      {actionLoading ? '⏳ A registar…' : '✓ Registar Movimento'}
                    </motion.button>
                    <button type="button" onClick={() => setPanelMode('detail')} style={{ padding: '0.65rem 1rem', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)', borderRadius: '9px', color: 'rgba(240,236,228,0.24)', fontSize: '0.78rem', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analytics */}
            {panelMode === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={springGentle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(220,232,248)', margin: 0 }}>📊 Analytics de Inventário</h2>
                  <button type="button" onClick={() => setPanelMode('list')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.24)', cursor: 'pointer', fontSize: '0.72rem' }}>✕ Fechar</button>
                </div>

                {!analytics ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                    <div style={{ color: 'rgba(240,236,228,0.24)', fontSize: '0.75rem' }}>A carregar analytics…</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                      {[
                        { label: 'Valor Total Inventário', value: fmtEur(Number(analytics.total_value ?? 0)), color: 'rgb(245,158,11)' },
                        { label: 'Total SKUs', value: String(analytics.total_skus ?? 0), color: '#d4b47a' },
                        { label: 'Entradas 30d', value: `${analytics.total_receipts_30d ?? 0} un`, color: '#b8975e' },
                        { label: 'Saídas 30d', value: `${analytics.total_dispatches_30d ?? 0} un`, color: '#b8975e' },
                        { label: 'Stock Baixo', value: String(analytics.low_stock_items ?? 0), color: 'rgb(245,158,11)' },
                        { label: 'Esgotado', value: String(analytics.out_of_stock_items ?? 0), color: 'rgb(239,68,68)' },
                      ].map(k => (
                        <div key={k.label} style={{ padding: '0.875rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: k.color, letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>{k.value}</div>
                          <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>{k.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Category breakdown */}
                    {!!(analytics.category_breakdown) && Object.keys(analytics.category_breakdown as object).length > 0 && (
                      <div className="yg-card" style={{ padding: '1rem' }}>
                        <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Valor por Categoria</h3>
                        {Object.entries(analytics.category_breakdown as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(240,236,228,0.04)' }}>
                            <span style={{ fontSize: '0.72rem', color: 'rgb(150,165,185)' }}>{cat}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgb(245,158,11)' }}>{fmtEur(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
