'use client';
import { useState, useEffect, useCallback } from 'react';

interface SupplierScore {
  supplier: string;
  totalOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  cancelledOrders: number;
  avgDeliveryDays?: number;
  reliabilityScore: number;
}

interface Signal {
  entityType: string;
  entityId: string;
  signalType: string;
  score: number;
  orderCount30d: number;
  orderCount7d: number;
  revenue30d: number;
}

interface SystemHealth {
  totalOrders: number;
  eventStreamSize: number;
  supplierCount: number;
  avgSupplierReliability: number;
  intelligenceSignals: number;
  supplierScores: SupplierScore[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 0.8 ? '#22c55e' : value >= 0.6 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#1a2f48', borderRadius: 3, maxWidth: 80 }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600 }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function SignalBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: string }> = {
    trending_up: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', icon: '↑' },
    trending_down: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', icon: '↓' },
    popular: { bg: 'rgba(77,163,255,0.15)', text: '#4da3ff', icon: '★' },
    seasonal: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', icon: '◎' },
  };
  const c = cfg[type] ?? cfg.popular;
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {c.icon} {type.replace('_', ' ')}
    </span>
  );
}

export default function IntelligencePage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tab, setTab] = useState<'health' | 'signals' | 'suppliers'>('health');
  const [recomputing, setRecomputing] = useState(false);
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const load = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const [hRes, sRes] = await Promise.all([
        fetch(`${base}/api/v1/intelligence/health`, { headers }),
        fetch(`${base}/api/v1/intelligence/signals`, { headers }),
      ]);
      if (hRes.ok) setHealth(await hRes.json() as SystemHealth);
      if (sRes.ok) setSignals(await sRes.json() as Signal[]);
    } catch { /* graceful */ }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${base}/api/v1/intelligence/recompute`, { method: 'POST', headers });
      await load();
    } catch { /* graceful */ }
    setRecomputing(false);
  }

  return (
    <div style={{ padding: '32px 40px', background: '#07111f', minHeight: '100vh', color: '#f0f6ff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Procurement Intelligence</h1>
          <p style={{ color: '#8ba8c7', margin: '4px 0 0', fontSize: 14 }}>
            Self-improving system — every order makes predictions sharper
          </p>
        </div>
        <button
          onClick={() => void recompute()}
          disabled={recomputing}
          style={{
            background: recomputing ? '#1a2f48' : '#4da3ff', color: recomputing ? '#8ba8c7' : '#07111f',
            border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
            cursor: recomputing ? 'not-allowed' : 'pointer',
          }}
        >
          {recomputing ? 'Computing...' : '⟳ Recompute Signals'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Orders Processed', value: String(health?.totalOrders ?? 0), color: '#f0f6ff' },
          { label: 'Event Stream Size', value: String(health?.eventStreamSize ?? 0), color: '#4da3ff' },
          { label: 'Suppliers Tracked', value: String(health?.supplierCount ?? 0), color: '#f0f6ff' },
          { label: 'Avg Supplier Reliability', value: `${((health?.avgSupplierReliability ?? 1) * 100).toFixed(0)}%`, color: (health?.avgSupplierReliability ?? 1) >= 0.8 ? '#22c55e' : '#f59e0b' },
          { label: 'Intelligence Signals', value: String(health?.intelligenceSignals ?? 0), color: '#4da3ff' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: '#8ba8c7', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0b1526', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #1a2f48' }}>
        {(['health', 'signals', 'suppliers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? '#4da3ff' : 'transparent',
              color: tab === t ? '#07111f' : '#8ba8c7',
            }}
          >
            {t === 'health' ? '🏥 System Health' : t === 'signals' ? '📡 Signals' : '🏭 Suppliers'}
          </button>
        ))}
      </div>

      {/* System Health */}
      {tab === 'health' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#f0f6ff' }}>Event Sourcing Backbone</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Event Stream', value: `${health?.eventStreamSize ?? 0} events`, status: 'active' },
                { label: 'Order Tracking', value: `${health?.totalOrders ?? 0} orders`, status: 'active' },
                { label: 'Supplier Intelligence', value: `${health?.supplierCount ?? 0} suppliers`, status: 'active' },
                { label: 'Procurement Signals', value: `${health?.intelligenceSignals ?? 0} signals`, status: 'active' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2f48' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#f0f6ff' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#4d6a87' }}>{item.value}</div>
                  </div>
                  <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                    {'●'} {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#f0f6ff' }}>Improvement Loop Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Supplier Score Update', desc: 'After every order delivered', active: true },
                { label: 'Demand Forecast', desc: 'After every paid order', active: true },
                { label: 'Churn Detection', desc: 'After every order cycle', active: true },
                { label: 'Financial Snapshots', desc: 'After delivery + monthly', active: true },
                { label: 'Cohort Analysis', desc: 'After delivery events', active: true },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a2f48' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#f0f6ff' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#4d6a87' }}>{item.desc}</div>
                  </div>
                  <span style={{ background: item.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: item.active ? '#22c55e' : '#ef4444', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                    {item.active ? '✓ active' : '✗ off'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Signals */}
      {tab === 'signals' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Entity', 'Type', 'Signal', 'Score', '30d Orders', '7d Orders', '30d Revenue'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#4d6a87' }}>No signals yet — recompute after orders are placed</td></tr>
              ) : signals.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#f0f6ff' }}>{s.entityId.slice(0, 20)}{s.entityId.length > 20 ? '…' : ''}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: 'rgba(77,163,255,0.1)', color: '#4da3ff', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{s.entityType}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}><SignalBadge type={s.signalType} /></td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#8ba8c7' }}>{s.score.toFixed(0)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{s.orderCount30d}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{s.orderCount7d}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#4da3ff' }}>{fmt(s.revenue30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers */}
      {tab === 'suppliers' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Supplier', 'Reliability', 'Total Orders', 'On Time', 'Late', 'Cancelled', 'Avg Days'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(health?.supplierScores ?? []).length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#4d6a87' }}>No supplier data yet — scores auto-update after deliveries</td></tr>
              ) : (health?.supplierScores ?? []).map(s => (
                <tr key={s.supplier} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#f0f6ff', textTransform: 'capitalize' }}>{s.supplier.replace('_', ' ')}</td>
                  <td style={{ padding: '12px 16px', width: 160 }}><ScoreBar value={s.reliabilityScore} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{s.totalOrders}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#22c55e' }}>{s.onTimeDeliveries}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: s.lateDeliveries > 0 ? '#f59e0b' : '#4d6a87' }}>{s.lateDeliveries}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: s.cancelledOrders > 0 ? '#ef4444' : '#4d6a87' }}>{s.cancelledOrders}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#8ba8c7' }}>{s.avgDeliveryDays != null ? `${s.avgDeliveryDays.toFixed(1)}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
