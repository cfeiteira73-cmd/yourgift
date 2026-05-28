'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ClientWithHealth {
  id: string;
  name: string | null;
  email: string | null;
  total_revenue: number | null;
  last_order_date: string | null;
  rev_90d: number;
  health?: {
    overall_score: number;
    risk_level: string | null;
    churn_probability: number | null;
    next_action: string | null;
    revenue_score: number | null;
    engagement_score: number | null;
  } | null;
}

interface Dashboard {
  summary: {
    total_clients: number;
    champions: number;
    at_risk: number;
    needs_attention: number;
    avg_health_score: number;
    health_distribution: Record<string, number>;
  };
  at_risk_clients: ClientWithHealth[];
  champion_clients: ClientWithHealth[];
  needs_attention: ClientWithHealth[];
}

interface RenewalRow {
  client_id: string;
  churn_probability: number;
  risk_level: string | null;
  overall_score: number;
  next_action: string | null;
  client: { name: string | null; email: string | null; total_revenue: number | null; last_order_date: string | null } | null;
}

const TIER_META = {
  champions:       { label: '🏆 Campeões',          color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
  needs_attention: { label: '⚠️ Atenção Necessária', color: 'text-amber-400',   border: 'border-amber-500/20',  bg: 'bg-amber-500/5' },
  at_risk:         { label: '🚨 Em Risco',            color: 'text-red-400',     border: 'border-red-500/20',    bg: 'bg-red-500/5' },
};

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-amber-400',
  medium:   'text-yellow-400',
  low:      'text-emerald-400',
};

function fmt(n: number | null) {
  if (n == null) return '—';
  if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function ClientCard({
  client, tier, onQBR,
}: { client: ClientWithHealth; tier: 'champions' | 'needs_attention' | 'at_risk'; onQBR: (id: string, name: string) => void }) {
  const meta = TIER_META[tier];
  const score = client.health?.overall_score ?? Number(client.total_revenue ?? 0);
  const churnPct = client.health?.churn_probability != null
    ? Math.round(Number(client.health.churn_probability) * 100) : null;
  const days = daysSince(client.last_order_date);

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-3 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white text-[10px] font-medium truncate">{client.name ?? 'Cliente'}</p>
          <p className="text-white/30 text-[9px] truncate">{client.email ?? '—'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-bold ${tier === 'champions' ? 'text-emerald-400' : tier === 'at_risk' ? 'text-red-400' : 'text-amber-400'}`}>
            {score}/100
          </p>
        </div>
      </div>
      <div className="flex gap-3 text-[9px] flex-wrap">
        <span className="text-white/40">Rev: {fmt(client.total_revenue)}</span>
        <span className="text-white/40">90d: {fmt(client.rev_90d)}</span>
        {days !== null && <span className={days > 60 ? 'text-red-400' : 'text-white/40'}>{days}d sem enc.</span>}
        {churnPct !== null && <span className={`${churnPct > 50 ? 'text-red-400' : 'text-white/40'}`}>{churnPct}% churn</span>}
      </div>
      {client.health?.next_action && (
        <p className="text-white/40 text-[9px] leading-snug line-clamp-1">{client.health.next_action}</p>
      )}
      <button type="button" onClick={() => onQBR(client.id, client.name ?? 'Cliente')}
        className="w-full py-1 rounded-lg border border-white/10 hover:bg-white/8 text-white/40 text-[9px] transition-colors">
        ✨ QBR AI
      </button>
    </div>
  );
}

export default function ClientSuccessPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'portfolio' | 'renewals'>('portfolio');
  const [qbrModal, setQbrModal] = useState<{ id: string; name: string } | null>(null);
  const [qbrContent, setQbrContent] = useState('');
  const [qbrLoading, setQbrLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client-success?mode=dashboard');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadRenewals() {
    setTab('renewals');
    const res = await fetch('/api/client-success?mode=renewals');
    const d = await res.json();
    setRenewals(d.renewals ?? []);
  }

  async function generateQBR(clientId: string, clientName: string) {
    setQbrModal({ id: clientId, name: clientName });
    setQbrContent('');
    setQbrLoading(true);
    try {
      const res = await fetch('/api/client-success', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ai_qbr', client_id: clientId }),
      });
      const d = await res.json();
      setQbrContent(d.qbr ?? '');
    } finally {
      setQbrLoading(false);
    }
  }

  const summary = data?.summary;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* QBR Modal */}
      <AnimatePresence>
        {qbrModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-white text-sm font-semibold">QBR: {qbrModal.name}</h2>
                <button type="button" onClick={() => setQbrModal(null)} className="text-white/40 hover:text-white text-lg">×</button>
              </div>
              {qbrLoading ? (
                <div className="flex items-center justify-center gap-3 py-8">
                  <span className="w-5 h-5 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
                  <p className="text-white/40 text-xs">A preparar QBR com AI…</p>
                </div>
              ) : (
                <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 p-4">
                  <p className="text-violet-400 text-[10px] font-medium mb-2">🤖 Pontos de Conversa QBR</p>
                  <p className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap">{qbrContent}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Client Success</h1>
          <p className="text-white/40 text-xs mt-0.5">Portfolio health · QBR AI · Renewals · Segmentação</p>
        </div>
        <button type="button" onClick={load}
          className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Clientes', value: summary?.total_clients ?? '—', color: 'text-white' },
          { label: 'Health Médio', value: summary ? `${summary.avg_health_score}/100` : '—', color: 'text-blue-400' },
          { label: '🏆 Campeões', value: summary?.champions ?? '—', color: 'text-emerald-400' },
          { label: '⚠️ Atenção', value: summary?.needs_attention ?? '—', color: 'text-amber-400' },
          { label: '🚨 Em Risco', value: summary?.at_risk ?? '—', color: summary && summary.at_risk > 0 ? 'text-red-400' : 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Health distribution bar */}
      {summary && (
        <div className="rounded-xl border border-white/5 bg-white/3 p-4">
          <p className="text-white/40 text-[10px] font-medium mb-3">Distribuição de Health</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {[
              { key: 'champions',       color: 'bg-emerald-500' },
              { key: 'healthy',         color: 'bg-blue-500' },
              { key: 'needs_attention', color: 'bg-amber-500' },
              { key: 'at_risk',         color: 'bg-red-500' },
            ].map(({ key, color }) => {
              const count = summary.health_distribution[key] ?? 0;
              const pct = summary.total_clients > 0 ? (count / summary.total_clients) * 100 : 0;
              return pct > 0 ? <div key={key} className={`${color}`} style={{ width: `${pct}%` }} title={`${key}: ${count}`} /> : null;
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[9px] text-white/40">
            {[
              { label: 'Campeões', color: 'bg-emerald-500', key: 'champions' },
              { label: 'Saudáveis', color: 'bg-blue-500', key: 'healthy' },
              { label: 'Atenção', color: 'bg-amber-500', key: 'needs_attention' },
              { label: 'Risco', color: 'bg-red-500', key: 'at_risk' },
            ].map(({ label, color, key }) => (
              <div key={key} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span>{label}: {summary.health_distribution[key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {[
          { key: 'portfolio', label: 'Portfolio' },
          { key: 'renewals',  label: 'Pipeline de Renovações' },
        ].map(({ key, label }) => (
          <button type="button" key={key} 
            onClick={() => key === 'renewals' ? loadRenewals() : setTab('portfolio')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === key ? 'text-white bg-white/8 border-b-2 border-blue-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'portfolio' && (
          <motion.div key="portfolio" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-5">
            {(['at_risk', 'needs_attention', 'champions'] as const).map(tier => {
              const meta = TIER_META[tier];
              const clients = tier === 'at_risk' ? (data?.at_risk_clients ?? [])
                : tier === 'needs_attention' ? (data?.needs_attention ?? [])
                : (data?.champion_clients ?? []);
              return (
                <div key={tier} className="space-y-2">
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${meta.color}`}>
                    {meta.label} ({clients.length})
                  </p>
                  {clients.length === 0 ? (
                    <p className="text-white/20 text-[9px] py-4 text-center">Nenhum</p>
                  ) : clients.map(c => (
                    <ClientCard key={c.id} client={c} tier={tier} onQBR={generateQBR} />
                  ))}
                </div>
              );
            })}
          </motion.div>
        )}

        {tab === 'renewals' && (
          <motion.div key="renewals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Clientes ordenados por risco de churn
            </p>
            {renewals.length === 0 ? (
              <p className="text-white/30 text-xs py-8 text-center">Sem dados · Executa Intelligence → Score All primeiro</p>
            ) : (
              <div className="rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40">
                      {['Cliente', 'Score', 'Risco Churn', 'Risk Level', 'Revenue Total', 'Próxima Acção'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renewals.map((r, i) => (
                      <tr key={r.client_id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/1' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="text-white font-medium">{r.client?.name ?? '—'}</p>
                          <p className="text-white/30">{r.client?.email ?? '—'}</p>
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">{r.overall_score}/100</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-medium ${Number(r.churn_probability) > 0.6 ? 'text-red-400' : Number(r.churn_probability) > 0.3 ? 'text-amber-400' : 'text-white'}`}>
                            {Math.round(Number(r.churn_probability) * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[9px] font-medium ${RISK_COLORS[r.risk_level ?? 'low'] ?? 'text-white'}`}>
                            {r.risk_level ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white">{fmt(r.client?.total_revenue ?? null)}</td>
                        <td className="px-4 py-2.5 text-white/40 max-w-xs truncate">{r.next_action ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
