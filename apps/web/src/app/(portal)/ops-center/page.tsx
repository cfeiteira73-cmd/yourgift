'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StuckOrder {
  id: string;
  reference: string;
  status: string;
  total_amount: number;
  currency: string;
  hours_stuck: number;
  severity: 'critical' | 'high' | 'medium';
  updated_at: string;
  clients: { company_name: string } | null;
}

interface FailedWebhook {
  id: string;
  event_type: string;
  endpoint_url: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
}

interface OpenDispute {
  id: string;
  stripe_dispute_id: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  due_by: string | null;
  created_at: string;
}

interface FailedPayment {
  id: string;
  event_type: string;
  amount: number | null;
  object_id: string | null;
  created_at: string;
}

interface DriftSettlement {
  settlement_date: string;
  net_settled: number;
  gross_volume: number;
  drift_amount: number;
  status: string;
}

interface SLABreach {
  id: string;
  entity_type: string;
  entity_id: string;
  hours_overdue: number;
  created_at: string;
  omega_final_sla_rules: {
    name: string;
    severity: string;
    threshold_hours: number;
  } | null;
}

interface ProductionDelay {
  id: string;
  reference: string;
  status: string;
  expected_delivery: string | null;
  total_amount: number;
  currency: string;
  is_overdue: boolean;
  hours_to_deadline: number | null;
  clients: { company_name: string } | null;
}

interface Anomaly {
  id: string;
  anomaly_type: string;
  severity: string;
  description: string;
  entity_type: string;
  entity_id: string | null;
  confidence_score: number | null;
  status: string;
  detected_at: string;
}

interface Dashboard {
  health_score: number;
  stuck_orders: {
    stuck_orders: StuckOrder[];
    total_stuck: number;
    critical_stuck: number;
  };
  webhooks: {
    failed_webhooks: FailedWebhook[];
    dead_letter: FailedWebhook[];
    pending_count: number;
    total_failed: number;
    total_dead_letter: number;
  };
  payments: {
    open_disputes: OpenDispute[];
    failed_payments: FailedPayment[];
    reconciliation_drift: DriftSettlement[];
    total_at_risk: number;
    total_failed: number;
    total_drift_settlements: number;
  };
  production: {
    sla_breaches: SLABreach[];
    production_delays: ProductionDelay[];
    total_sla_breaches: number;
    overdue_count: number;
  };
  anomalies: {
    anomalies: Anomaly[];
    total: number;
    critical: number;
  };
  generated_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SEV: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-500/15', text: 'text-red-400',    dot: 'bg-red-500',    label: 'Crítico' },
  high:     { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-500',  label: 'Alto' },
  medium:   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Médio' },
  low:      { bg: 'bg-blue-500/15', text: 'text-blue-400',   dot: 'bg-blue-500',   label: 'Baixo' },
};

const TABS = [
  { key: 'overview',    label: 'Overview',         emoji: '🎯' },
  { key: 'stuck',       label: 'Stuck Orders',     emoji: '⏸' },
  { key: 'webhooks',    label: 'Webhooks',          emoji: '🔗' },
  { key: 'payments',    label: 'Pagamentos',        emoji: '💳' },
  { key: 'production',  label: 'Produção',          emoji: '🏭' },
  { key: 'anomalies',   label: 'Anomalias IA',      emoji: '🤖' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmtEur(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(n);
}

function HealthRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(240,236,228,0.06)" strokeWidth={8} />
      <circle
        cx={44} cy={44} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={44} y={44} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={18} fontWeight={700}>{score}</text>
    </svg>
  );
}

function SevBadge({ sev }: { sev: string }) {
  const s = SEV[sev] ?? SEV.medium;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-white/30">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OpsCenterPage() {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<typeof TABS[number]['key']>('overview');
  const [actioning, setActioning] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops-center?mode=dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setData(d);
      setLastRefresh(new Date());
    } catch (e) {
      setError('Erro ao carregar dados operacionais.');
      console.error('[ops-center]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 30s
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  async function retryWebhook(id: string) {
    setActioning(id);
    try {
      await fetch('/api/ops-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_webhook', id }),
      });
      await load(true);
    } finally { setActioning(null); }
  }

  async function resolveAnomaly(id: string) {
    setActioning(id);
    try {
      await fetch('/api/ops-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_anomaly', id }),
      });
      await load(true);
    } finally { setActioning(null); }
  }

  const totalAlerts = data
    ? (data.stuck_orders.total_stuck ?? 0)
    + (data.webhooks.total_dead_letter ?? 0)
    + (data.payments.open_disputes?.length ?? 0)
    + (data.production.total_sla_breaches ?? 0)
    + (data.anomalies.critical ?? 0)
    : 0;

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
              Live Operations Center
            </h1>
            {totalAlerts > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}
              >
                {totalAlerts} alertas
              </motion.span>
            )}
          </div>
          <p style={{ color: 'rgba(240,236,228,0.35)', fontSize: 14, margin: 0 }}>
            Missão de controlo em tempo real · Auto-refresh 30s
            {lastRefresh && ` · Atualizado ${timeAgo(lastRefresh.toISOString())}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data && <HealthRing score={data.health_score} />}
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(240,236,228,0.06)', color: '#fff', border: '1px solid rgba(240,236,228,0.10)',
              cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', marginTop: 8,
            }}
          >
            {loading ? '⟳ A carregar…' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#ef4444', marginBottom: 24, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(t => (
          <button
            type="button"
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              background: tab === t.key ? 'rgba(240,236,228,0.10)' : 'transparent',
              color: tab === t.key ? '#fff' : 'rgba(240,236,228,0.35)',
              border: tab === t.key ? '1px solid rgba(240,236,228,0.14)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <LoadingSkeleton />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'overview'   && data && <OverviewTab data={data} />}
            {tab === 'stuck'      && data && <StuckTab orders={data.stuck_orders.stuck_orders} />}
            {tab === 'webhooks'   && data && <WebhooksTab webhooks={data.webhooks} onRetry={retryWebhook} actioning={actioning} />}
            {tab === 'payments'   && data && <PaymentsTab payments={data.payments} />}
            {tab === 'production' && data && <ProductionTab production={data.production} />}
            {tab === 'anomalies'  && data && <AnomaliesTab anomalies={data.anomalies} onResolve={resolveAnomaly} actioning={actioning} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-dark" style={{ height: 100, borderRadius: 12 }} />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="yg-card" style={{ padding: 20 }}>
      <p style={{ color: 'rgba(240,236,228,0.35)', fontSize: 12, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: color ?? '#fff', margin: 0 }}>{value}</p>
      {sub && <p style={{ color: 'rgba(240,236,228,0.28)', fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function OverviewTab({ data }: { data: Dashboard }) {
  const d = data;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard
          label="Ordens paradas"
          value={d.stuck_orders.total_stuck}
          sub={`${d.stuck_orders.critical_stuck} críticas`}
          color={d.stuck_orders.critical_stuck > 0 ? '#ef4444' : '#fff'}
        />
        <StatCard
          label="Webhooks falhados"
          value={d.webhooks.total_failed + d.webhooks.total_dead_letter}
          sub={`${d.webhooks.total_dead_letter} dead letter`}
          color={(d.webhooks.total_failed + d.webhooks.total_dead_letter) > 0 ? '#f59e0b' : '#fff'}
        />
        <StatCard
          label="Disputas abertas"
          value={d.payments.open_disputes?.length ?? 0}
          sub={`${fmtEur(d.payments.total_at_risk ?? 0)} em risco`}
          color={(d.payments.open_disputes?.length ?? 0) > 0 ? '#ef4444' : '#fff'}
        />
        <StatCard
          label="Pagamentos falhados"
          value={d.payments.total_failed}
          color={d.payments.total_failed > 0 ? '#f59e0b' : '#fff'}
        />
        <StatCard
          label="SLA breaches"
          value={d.production.total_sla_breaches}
          sub={`${d.production.overdue_count} em produção`}
          color={d.production.total_sla_breaches > 0 ? '#f59e0b' : '#fff'}
        />
        <StatCard
          label="Anomalias IA"
          value={d.anomalies.total}
          sub={`${d.anomalies.critical} críticas`}
          color={d.anomalies.critical > 0 ? '#ef4444' : '#fff'}
        />
      </div>

      {/* Recent anomalies preview */}
      {d.anomalies.anomalies.length > 0 && (
        <div className="yg-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>⚠️ Anomalias Recentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.anomalies.anomalies.slice(0, 5).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SevBadge sev={a.severity} />
                <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.description}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(240,236,228,0.28)', whiteSpace: 'nowrap' }}>{timeAgo(a.detected_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StuckTab({ orders }: { orders: StuckOrder[] }) {
  if (!orders.length) return <EmptyState label="Nenhuma ordem parada. Sistema fluindo normalmente." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {orders.map(o => (
        <motion.div
          key={o.id}
          className="yg-card"
          style={{ padding: '16px 20px' }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SevBadge sev={o.severity} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
                  {o.reference} · {o.clients?.company_name ?? 'Cliente desconhecido'}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.35)', margin: '2px 0 0' }}>
                  Status: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{o.status}</span>
                  {' · '}Parado há <span style={{ color: o.severity === 'critical' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{o.hours_stuck}h</span>
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{fmtEur(o.total_amount, o.currency)}</p>
              <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>Atualizado {timeAgo(o.updated_at)}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WebhooksTab({
  webhooks,
  onRetry,
  actioning,
}: {
  webhooks: Dashboard['webhooks'];
  onRetry: (id: string) => void;
  actioning: string | null;
}) {
  const all = [...webhooks.failed_webhooks, ...webhooks.dead_letter];
  if (!all.length) return <EmptyState label="Nenhum webhook falhado. Tudo a entregar." />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Falhados" value={webhooks.total_failed} color="#f59e0b" />
        <StatCard label="Dead Letter" value={webhooks.total_dead_letter} color="#ef4444" />
        <StatCard label="Pendentes" value={webhooks.pending_count ?? 0} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {all.map(w => (
          <div key={w.id} className="yg-card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: w.status === 'dead_letter' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: w.status === 'dead_letter' ? '#ef4444' : '#f59e0b',
                  }}>{w.status}</span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{w.event_type}</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.28)', margin: 0 }}>
                  {w.endpoint_url} · {w.retry_count} tentativas · {timeAgo(w.created_at)}
                </p>
                {w.last_error && (
                  <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0', fontFamily: 'monospace' }}>
                    {w.last_error.slice(0, 100)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRetry(w.id)}
                disabled={actioning === w.id}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'rgba(154,124,74,0.14)', color: '#4da3ff',
                  border: '1px solid rgba(154,124,74,0.18)', cursor: actioning === w.id ? 'not-allowed' : 'pointer',
                }}
              >
                {actioning === w.id ? '⟳' : '↻ Retry'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: Dashboard['payments'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Disputes */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
          🚨 Disputas a Responder ({payments.open_disputes?.length ?? 0})
        </h3>
        {!payments.open_disputes?.length ? (
          <EmptyState label="Sem disputas urgentes." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payments.open_disputes.map(d => {
              const dueDate = d.due_by ? new Date(d.due_by) : null;
              const hoursLeft = dueDate ? Math.round((dueDate.getTime() - Date.now()) / 3600000) : null;
              const urgent = hoursLeft !== null && hoursLeft < 48;
              return (
                <div key={d.id} className="yg-card" style={{ padding: '14px 18px', borderColor: urgent ? 'rgba(239,68,68,0.3)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: urgent ? '#ef4444' : '#fff', margin: 0 }}>
                        {fmtEur(d.amount, d.currency)} · {d.reason ?? 'Sem motivo'}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.35)', margin: '2px 0 0' }}>
                        {d.stripe_dispute_id ?? d.id}
                        {hoursLeft !== null && (
                          <> · <span style={{ color: urgent ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                            {hoursLeft > 0 ? `${hoursLeft}h restantes` : 'EXPIRADO'}
                          </span></>
                        )}
                      </p>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                    }}>{d.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Failed Payments */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
          ❌ Pagamentos Falhados ({payments.total_failed})
        </h3>
        {!payments.failed_payments?.length ? (
          <EmptyState label="Sem pagamentos falhados recentes." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.failed_payments.map(p => (
              <div key={p.id} className="yg-card" style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#fff', fontWeight: 500, margin: 0 }}>{p.event_type}</p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>{p.object_id} · {timeAgo(p.created_at)}</p>
                  </div>
                  {p.amount && <p style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: 0 }}>{fmtEur(p.amount / 100)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reconciliation Drift */}
      {(payments.reconciliation_drift?.length ?? 0) > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
            ⚖️ Desvios de Reconciliação ({payments.total_drift_settlements})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.reconciliation_drift.map((s, i) => (
              <div key={i} className="yg-card" style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#fff', fontWeight: 500, margin: 0 }}>
                      Settlement {s.settlement_date}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>
                      Gross: {fmtEur(s.gross_volume)} · Net: {fmtEur(s.net_settled)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: s.drift_amount > 0 ? '#ef4444' : '#10b981', margin: 0 }}>
                      {s.drift_amount > 0 ? '+' : ''}{fmtEur(s.drift_amount)}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>{s.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductionTab({ production }: { production: Dashboard['production'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* SLA Breaches */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
          ⏰ SLA Breaches ({production.total_sla_breaches})
        </h3>
        {!production.sla_breaches?.length ? (
          <EmptyState label="Nenhum SLA breach ativo." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {production.sla_breaches.map(b => (
              <div key={b.id} className="yg-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {b.omega_final_sla_rules && <SevBadge sev={b.omega_final_sla_rules.severity ?? 'medium'} />}
                      <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                        {b.omega_final_sla_rules?.name ?? 'SLA breach'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.28)', margin: 0 }}>
                      {b.entity_type} · {b.entity_id.slice(0, 12)}…
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', margin: 0 }}>{b.hours_overdue}h</p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>em atraso</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Production Delays */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
          🏭 Entregas em Risco ({production.production_delays?.length ?? 0})
        </h3>
        {!production.production_delays?.length ? (
          <EmptyState label="Todas as produções dentro do prazo." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {production.production_delays.map(o => (
              <div key={o.id} className="yg-card" style={{ padding: '14px 18px', borderColor: o.is_overdue ? 'rgba(239,68,68,0.3)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: o.is_overdue ? '#ef4444' : '#fff', margin: 0 }}>
                      {o.reference} · {o.clients?.company_name ?? '—'}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.35)', margin: '2px 0 0' }}>
                      {o.is_overdue
                        ? <span style={{ color: '#ef4444', fontWeight: 600 }}>ATRASADO {Math.abs(o.hours_to_deadline ?? 0)}h</span>
                        : <span style={{ color: '#f59e0b' }}>Vence em {o.hours_to_deadline}h</span>
                      }
                    </p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                    {fmtEur(o.total_amount, o.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnomaliesTab({
  anomalies,
  onResolve,
  actioning,
}: {
  anomalies: Dashboard['anomalies'];
  onResolve: (id: string) => void;
  actioning: string | null;
}) {
  if (!anomalies.anomalies?.length) return <EmptyState label="Nenhuma anomalia detetada pela IA." />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Total" value={anomalies.total} />
        <StatCard label="Críticas" value={anomalies.critical} color={anomalies.critical > 0 ? '#ef4444' : '#fff'} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {anomalies.anomalies.map(a => (
          <motion.div
            key={a.id}
            className="yg-card"
            style={{ padding: '16px 20px' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <SevBadge sev={a.severity} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.anomaly_type}</span>
                  {a.confidence_score && (
                    <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)' }}>
                      {Math.round(a.confidence_score * 100)}% confiança
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>{a.description}</p>
                <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.28)', margin: 0 }}>
                  {a.entity_type}{a.entity_id ? ` · ${a.entity_id.slice(0, 12)}…` : ''} · {timeAgo(a.detected_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onResolve(a.id)}
                disabled={actioning === a.id}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'rgba(16,185,129,0.12)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.2)', cursor: actioning === a.id ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {actioning === a.id ? '…' : '✓ Resolver'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
