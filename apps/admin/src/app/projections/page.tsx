'use client';
import { useState, useEffect, useCallback } from 'react';

interface ProjectionHealth {
  orderProjections: number;
  snapshots: number;
  eventStreamSize: number;
  lastRebuild: {
    status: string;
    eventsProcessed: number;
    startedAt: string;
    completedAt?: string;
  } | null;
}

interface RebuildLog {
  id: string;
  projectionName: string;
  status: string;
  eventsProcessed: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface OrderProjection {
  id: string;
  ref: string;
  status: string;
  totalAmount?: number;
  itemCount: number;
  lastEventType?: string;
  lastEventAt?: string;
  eventSequence: number;
  createdAt: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    running: { bg: 'rgba(77,163,255,0.15)', color: '#4da3ff' },
    failed: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    created: { bg: 'rgba(77,163,255,0.15)', color: '#4da3ff' },
    paid: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    shipped: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    delivered: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e' },
    cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  };
  const c = cfg[status] ?? { bg: 'rgba(139,168,199,0.15)', color: '#8ba8c7' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

export default function ProjectionsPage() {
  const [health, setHealth] = useState<ProjectionHealth | null>(null);
  const [logs, setLogs] = useState<RebuildLog[]>([]);
  const [orders, setOrders] = useState<OrderProjection[]>([]);
  const [tab, setTab] = useState<'health' | 'orders' | 'logs'>('health');
  const [rebuilding, setRebuilding] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const load = useCallback(async () => {
    try {
      const [hRes, lRes, oRes] = await Promise.all([
        fetch(`${base}/api/v1/projections/health`, { headers: getHeaders() }),
        fetch(`${base}/api/v1/projections/rebuild-logs`, { headers: getHeaders() }),
        fetch(`${base}/api/v1/projections/orders?limit=50${statusFilter ? `&status=${statusFilter}` : ''}`, { headers: getHeaders() }),
      ]);
      if (hRes.ok) setHealth(await hRes.json() as ProjectionHealth);
      if (lRes.ok) setLogs(await lRes.json() as RebuildLog[]);
      if (oRes.ok) {
        const data = await oRes.json() as { projections: OrderProjection[] };
        setOrders(data.projections ?? []);
      }
    } catch { /* graceful */ }
  }, [base, statusFilter]);

  useEffect(() => { void load(); }, [load]);
  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function rebuild() {
    setRebuilding(true);
    try {
      await fetch(`${base}/api/v1/projections/rebuild/orders`, { method: 'POST', headers: getHeaders() });
      // Poll until done
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await load();
        if (attempts > 20) clearInterval(poll);
      }, 2000);
    } catch { /* graceful */ }
    setRebuilding(false);
  }

  return (
    <div style={{ padding: '32px 40px', background: '#07111f', minHeight: '100vh', color: '#f0f6ff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Projection Layer</h1>
          <p style={{ color: '#8ba8c7', margin: '4px 0 0', fontSize: 14 }}>
            Read models rebuilt from event stream — all APIs read from projections
          </p>
        </div>
        <button
          onClick={() => void rebuild()}
          disabled={rebuilding}
          style={{
            background: rebuilding ? '#1a2f48' : '#4da3ff', color: rebuilding ? '#8ba8c7' : '#07111f',
            border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
            cursor: rebuilding ? 'not-allowed' : 'pointer',
          }}
        >
          {rebuilding ? 'Rebuilding…' : '⟳ Rebuild Projections'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Order Projections', value: String(health?.orderProjections ?? 0), color: '#4da3ff' },
          { label: 'Aggregate Snapshots', value: String(health?.snapshots ?? 0), color: '#f0f6ff' },
          { label: 'Event Stream Size', value: String(health?.eventStreamSize ?? 0), color: '#4da3ff' },
          {
            label: 'Last Rebuild',
            value: health?.lastRebuild ? health.lastRebuild.status : '—',
            color: health?.lastRebuild?.status === 'completed' ? '#22c55e' : health?.lastRebuild?.status === 'failed' ? '#ef4444' : '#8ba8c7',
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: '#8ba8c7', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Architecture diagram */}
      <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24, marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Event → Projection Flow</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['Order Event', '→', 'EventBus', '→', 'ProjectionService', '→', 'order_projections', '→', 'APIs/Admin'].map((step, i) => (
            <div key={i} style={{
              padding: step === '→' ? '0 4px' : '6px 14px',
              background: step === '→' ? 'transparent' : 'rgba(77,163,255,0.1)',
              border: step === '→' ? 'none' : '1px solid rgba(77,163,255,0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: step === '→' ? '#4d6a87' : '#4da3ff',
              fontWeight: step === '→' ? 400 : 600,
            }}>
              {step}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#4d6a87' }}>
          Snapshot taken every 10 events per aggregate · Projections rebuilt on demand · Eventually consistent read models
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0b1526', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #1a2f48' }}>
        {(['health', 'orders', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t ? '#4da3ff' : 'transparent', color: tab === t ? '#07111f' : '#8ba8c7',
          }}>
            {t === 'health' ? '🏥 Health' : t === 'orders' ? '📦 Order Projections' : '📋 Rebuild Logs'}
          </button>
        ))}
      </div>

      {/* Health */}
      {tab === 'health' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Projection Status</div>
            {[
              { label: 'order_projections', size: health?.orderProjections ?? 0, status: 'live' },
              { label: 'aggregate_snapshots', size: health?.snapshots ?? 0, status: 'live' },
              { label: 'procurement_events (source)', size: health?.eventStreamSize ?? 0, status: 'append-only' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2f48' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f0f6ff', fontFamily: 'monospace' }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: '#4d6a87', marginTop: 2 }}>{row.size.toLocaleString()} records</div>
                </div>
                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                  ● {row.status}
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Last Rebuild Details</div>
            {health?.lastRebuild ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8ba8c7', fontSize: 13 }}>Status</span>
                  <StatusBadge status={health.lastRebuild.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8ba8c7', fontSize: 13 }}>Events Processed</span>
                  <span style={{ fontSize: 13 }}>{health.lastRebuild.eventsProcessed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8ba8c7', fontSize: 13 }}>Started</span>
                  <span style={{ fontSize: 12, color: '#4d6a87' }}>{new Date(health.lastRebuild.startedAt).toLocaleString('pt-PT')}</span>
                </div>
                {health.lastRebuild.completedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8ba8c7', fontSize: 13 }}>Duration</span>
                    <span style={{ fontSize: 12, color: '#4da3ff' }}>
                      {Math.round((new Date(health.lastRebuild.completedAt).getTime() - new Date(health.lastRebuild.startedAt).getTime()) / 1000)}s
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#4d6a87', padding: '24px 0', fontSize: 13 }}>No rebuild has been run yet</div>
            )}
          </div>
        </div>
      )}

      {/* Order Projections */}
      {tab === 'orders' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2f48', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#8ba8c7' }}>Filter:</span>
            {['', 'created', 'paid', 'approved', 'shipped', 'delivered', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                background: statusFilter === s ? '#4da3ff' : '#1a2f48',
                color: statusFilter === s ? '#07111f' : '#8ba8c7',
              }}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Ref', 'Status', 'Amount', 'Items', 'Last Event', 'Seq', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#4d6a87' }}>No projections — rebuild to populate</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4da3ff', fontFamily: 'monospace' }}>{o.ref}</td>
                  <td style={{ padding: '10px 16px' }}><StatusBadge status={o.status} /></td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{o.totalAmount != null ? fmt(o.totalAmount) : '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{o.itemCount}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#8ba8c7', fontFamily: 'monospace' }}>{o.lastEventType ?? '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4d6a87' }}>#{o.eventSequence}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4d6a87' }}>{new Date(o.createdAt).toLocaleDateString('pt-PT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rebuild Logs */}
      {tab === 'logs' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Projection', 'Status', 'Events Processed', 'Started', 'Duration', 'Error'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#4d6a87' }}>No rebuild logs yet</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#f0f6ff', fontFamily: 'monospace' }}>{l.projectionName}</td>
                  <td style={{ padding: '10px 16px' }}><StatusBadge status={l.status} /></td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{l.eventsProcessed}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4d6a87' }}>{new Date(l.startedAt).toLocaleString('pt-PT')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4da3ff' }}>
                    {l.completedAt ? `${Math.round((new Date(l.completedAt).getTime() - new Date(l.startedAt).getTime()) / 1000)}s` : l.status === 'running' ? '…' : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: '#ef4444' }}>{l.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
