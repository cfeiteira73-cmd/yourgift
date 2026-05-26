'use client';
import { useState, useEffect, useCallback } from 'react';

interface ChurnClient {
  clientId: string;
  companyId?: string;
  churnRiskLevel: string;
  churnRiskScore: number;
  daysSinceLastOrder?: number;
  orderCount: number;
  predictedNextOrderAt?: string;
  avgDaysBetweenOrders?: number;
}

interface Forecast {
  entityType: string;
  entityId: string;
  forecastMonth: string;
  predictedQty: number;
  predictedRevenue: number;
  confidenceScore: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    medium: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
    low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  };
  const c = colors[level] ?? colors.low;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {level}
    </span>
  );
}

export default function RetentionPage() {
  const [churnClients, setChurnClients] = useState<ChurnClient[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [tab, setTab] = useState<'churn' | 'forecast'>('churn');
  const [refreshing, setRefreshing] = useState(false);
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const load = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [cRes, fRes] = await Promise.all([
        fetch(`${base}/api/v1/retention/churn-risks`, { headers }),
        fetch(`${base}/api/v1/retention/forecasts?entityType=product`, { headers }),
      ]);
      if (cRes.ok) setChurnClients(await cRes.json() as ChurnClient[]);
      if (fRes.ok) setForecasts(await fRes.json() as Forecast[]);
    } catch { /* graceful */ }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${base}/api/v1/retention/refresh`, { method: 'POST', headers });
      await load();
    } catch { /* graceful */ }
    setRefreshing(false);
  }

  const highRisk = churnClients.filter(c => c.churnRiskLevel === 'high').length;
  const medRisk = churnClients.filter(c => c.churnRiskLevel === 'medium').length;

  return (
    <div style={{ padding: '32px 40px', background: '#07111f', minHeight: '100vh', color: '#f0f6ff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Retention Loop Engine</h1>
          <p style={{ color: '#8ba8c7', margin: '4px 0 0', fontSize: 14 }}>
            Churn prediction, procurement cycles, demand forecasting
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={refreshing}
          style={{
            background: refreshing ? '#1a2f48' : '#4da3ff',
            color: refreshing ? '#8ba8c7' : '#07111f',
            border: 'none', borderRadius: 8, padding: '10px 20px',
            fontSize: 14, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshing ? 'Refreshing…' : '⟳ Refresh Cycles'}
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'High Risk Clients', value: String(highRisk), color: '#ef4444' },
          { label: 'Medium Risk', value: String(medRisk), color: '#f59e0b' },
          { label: 'Total Tracked', value: String(churnClients.length), color: '#f0f6ff' },
          { label: 'Active Forecasts', value: String(forecasts.length), color: '#4da3ff' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: '#8ba8c7', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0b1526', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #1a2f48' }}>
        {(['churn', 'forecast'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? '#4da3ff' : 'transparent',
              color: tab === t ? '#07111f' : '#8ba8c7',
            }}
          >
            {t === 'churn' ? '⚠️ Churn Risks' : '📈 Demand Forecast'}
          </button>
        ))}
      </div>

      {/* Churn Risks Table */}
      {tab === 'churn' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0b1526' }}>
                {['Client', 'Risk Level', 'Score', 'Days Since Order', 'Total Orders', 'Avg Cycle', 'Predicted Next'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {churnClients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#4d6a87', fontSize: 14 }}>
                    No churn data yet — refresh cycles to compute
                  </td>
                </tr>
              ) : churnClients.map(c => (
                <tr key={c.clientId} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#f0f6ff' }}>{c.clientId.slice(0, 12)}…</td>
                  <td style={{ padding: '12px 16px' }}><RiskBadge level={c.churnRiskLevel} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#8ba8c7' }}>{(c.churnRiskScore * 100).toFixed(0)}%</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: c.daysSinceLastOrder && c.daysSinceLastOrder > 60 ? '#ef4444' : '#f0f6ff' }}>
                    {c.daysSinceLastOrder != null ? `${c.daysSinceLastOrder}d` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.orderCount}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#8ba8c7' }}>
                    {c.avgDaysBetweenOrders != null ? `${c.avgDaysBetweenOrders.toFixed(0)}d` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#4da3ff' }}>
                    {c.predictedNextOrderAt ? new Date(c.predictedNextOrderAt).toLocaleDateString('pt-PT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Demand Forecasts */}
      {tab === 'forecast' && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Entity', 'Type', 'Forecast Month', 'Predicted Qty', 'Predicted Revenue', 'Confidence'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecasts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#4d6a87', fontSize: 14 }}>
                    No forecasts yet — forecasts auto-compute after orders are placed
                  </td>
                </tr>
              ) : forecasts.map(f => (
                <tr key={`${f.entityType}-${f.entityId}`} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#f0f6ff' }}>{f.entityId.slice(0, 16)}…</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'rgba(77,163,255,0.15)', color: '#4da3ff', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                      {f.entityType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#8ba8c7' }}>{f.forecastMonth}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{f.predictedQty}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#4da3ff' }}>{fmt(f.predictedRevenue)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: '#1a2f48', borderRadius: 2, maxWidth: 60 }}>
                        <div style={{ width: `${f.confidenceScore * 100}%`, height: '100%', background: '#4da3ff', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#8ba8c7' }}>{(f.confidenceScore * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
