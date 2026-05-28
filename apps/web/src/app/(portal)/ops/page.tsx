'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  status: string;
  assigned_to: string | null;
  ai_recommendation: string | null;
  root_cause: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  mttr_minutes: number | null;
  created_at: string;
}

interface SLABreach {
  id: string;
  entity_type: string;
  entity_id: string;
  hours_overdue: number;
  created_at: string;
  omega_final_sla_rules: {
    name: string;
    entity_type: string;
    threshold_hours: number;
    severity: string;
  } | null;
}

interface WarRoomData {
  summary: {
    open_incidents: number;
    critical_incidents: number;
    open_sla_breaches: number;
    active_sla_rules: number;
    health_score: number;
  };
  incidents: Incident[];
  sla_breaches: SLABreach[];
  mttr: { category: string; avg_mttr_minutes: number; count: number }[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  high:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  medium:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  low:      'bg-white/10 text-white/50',
};

const STATUS_STYLES: Record<string, string> = {
  open:          'bg-red-500/15 text-red-400',
  investigating: 'bg-amber-500/15 text-amber-400',
  resolved:      'bg-emerald-500/15 text-emerald-400',
  closed:        'bg-white/10 text-white/30',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';
  const r = 32, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={14} fontWeight={700}>{score}</text>
    </svg>
  );
}

function OpenIncidentModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', severity: 'medium', category: '', assigned_to: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'open_incident', ...form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0e1015] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold text-sm">Abrir Incidente</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-white/50 text-xs block mb-1">Título *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
              placeholder="Descrição breve do incidente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1">Severidade</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                <option value="">Geral</option>
                <option value="sla">SLA</option>
                <option value="financial">Financeiro</option>
                <option value="production">Produção</option>
                <option value="supplier">Fornecedor</option>
                <option value="system">Sistema</option>
                <option value="ai">AI</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1">Descrição</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 resize-none"
              placeholder="Detalhes do incidente…" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {loading ? 'A abrir…' : 'Abrir Incidente'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function OpsPage() {
  const [data, setData] = useState<WarRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [tab, setTab] = useState<'incidents' | 'sla' | 'mttr'>('incidents');
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops?mode=war_room');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateIncident(id: string, updates: Record<string, unknown>) {
    setActionLoading(id);
    await fetch('/api/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_incident', id, ...updates }),
    });
    setActionLoading('');
    load();
  }

  async function resolveIncident(id: string) {
    setActionLoading(id);
    await fetch('/api/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_incident', id }),
    });
    setActionLoading('');
    setSelectedIncident(null);
    load();
  }

  async function scanSLA() {
    setActionLoading('sla');
    await fetch('/api/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'scan_sla' }),
    });
    setActionLoading('');
    load();
  }

  const summary = data?.summary;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Operations War Room</h1>
          <p className="text-white/40 text-xs mt-0.5">Centro de comando · incidentes · SLA · MTTR</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={scanSLA} disabled={actionLoading === 'sla'}
            className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-white/50 text-xs transition-colors disabled:opacity-50">
            {actionLoading === 'sla' ? 'A escanear…' : 'Scan SLA'}
          </button>
          <button type="button" onClick={() => setShowOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-colors">
            <span className="text-base leading-none">+</span> Abrir Incidente
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-1 rounded-xl border border-white/5 bg-white/3 p-4 flex flex-col items-center justify-center gap-2">
          {summary && <HealthGauge score={summary.health_score} />}
          <p className="text-white/40 text-[10px]">Health Score</p>
        </div>
        {[
          { label: 'Incidentes Abertos', val: summary?.open_incidents ?? 0, color: 'text-red-400' },
          { label: 'Críticos', val: summary?.critical_incidents ?? 0, color: 'text-orange-400' },
          { label: 'SLA Breaches', val: summary?.open_sla_breaches ?? 0, color: 'text-amber-400' },
          { label: 'Regras SLA Ativas', val: summary?.active_sla_rules ?? 0, color: 'text-blue-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['incidents', 'sla', 'mttr'] as const).map(t => (
          <button type="button" key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}>
            {t === 'incidents' ? 'Incidentes' : t === 'sla' ? 'SLA Breaches' : 'MTTR'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* List */}
        <div className="col-span-2 space-y-2">
          {loading ? (
            <p className="text-white/30 text-xs text-center py-10">A carregar…</p>
          ) : tab === 'incidents' ? (
            (data?.incidents ?? []).length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/3 p-8 text-center">
                <p className="text-emerald-400 text-sm font-medium">✓ Sem incidentes abertos</p>
                <p className="text-white/30 text-xs mt-1">Sistema operacional</p>
              </div>
            ) : (data?.incidents ?? []).map(incident => (
              <motion.button key={incident.id} type="button" whileHover={{ x: 2 }}
                onClick={() => setSelectedIncident(incident)}
                className={`w-full text-left rounded-xl border p-4 space-y-2 transition-colors ${
                  selectedIncident?.id === incident.id
                    ? 'border-white/20 bg-white/8'
                    : 'border-white/5 bg-white/3 hover:bg-white/5'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white text-xs font-medium leading-snug">{incident.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_STYLES[incident.severity] ?? ''}`}>
                      {incident.severity}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[incident.status] ?? ''}`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  {incident.category && <span>{incident.category}</span>}
                  <span>{timeAgo(incident.created_at)} atrás</span>
                  {incident.assigned_to && <span>→ {incident.assigned_to}</span>}
                </div>
              </motion.button>
            ))
          ) : tab === 'sla' ? (
            (data?.sla_breaches ?? []).length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/3 p-8 text-center">
                <p className="text-emerald-400 text-sm font-medium">✓ Sem SLA breaches</p>
                <p className="text-white/30 text-xs mt-1">Todos os SLAs dentro do limite</p>
              </div>
            ) : (data?.sla_breaches ?? []).map(breach => (
              <div key={breach.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1.5">
                <div className="flex justify-between items-start">
                  <p className="text-white text-xs font-medium">{breach.omega_final_sla_rules?.name ?? 'SLA Rule'}</p>
                  <span className="text-amber-400 text-xs font-bold">{Number(breach.hours_overdue).toFixed(1)}h overdue</span>
                </div>
                <p className="text-white/40 text-[10px]">
                  {breach.entity_type} #{breach.entity_id?.slice(0, 8)} · limite {breach.omega_final_sla_rules?.threshold_hours}h
                </p>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {(data?.mttr ?? []).length === 0 ? (
                <p className="text-white/30 text-xs text-center py-10">Sem dados de MTTR</p>
              ) : (data?.mttr ?? []).map(m => (
                <div key={m.category} className="rounded-xl border border-white/5 bg-white/3 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-xs font-medium capitalize">{m.category}</span>
                    <span className="text-white/60 text-xs">{m.avg_mttr_minutes}min avg · {m.count} incidentes</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-blue-500/60"
                      style={{ width: `${Math.min(100, (m.avg_mttr_minutes / 120) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          <AnimatePresence mode="wait">
            {selectedIncident ? (
              <motion.div key={selectedIncident.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_STYLES[selectedIncident.severity] ?? ''}`}>
                      {selectedIncident.severity}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[selectedIncident.status] ?? ''}`}>
                      {selectedIncident.status}
                    </span>
                  </div>
                  <p className="text-white text-xs font-semibold leading-snug">{selectedIncident.title}</p>
                  {selectedIncident.description && (
                    <p className="text-white/50 text-[10px] mt-1 leading-relaxed">{selectedIncident.description}</p>
                  )}
                </div>

                {selectedIncident.ai_recommendation && (
                  <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
                    <p className="text-violet-300 text-[9px] font-medium uppercase tracking-wider mb-1">AI Recomendação</p>
                    <p className="text-white/70 text-[10px] leading-relaxed">{selectedIncident.ai_recommendation}</p>
                  </div>
                )}

                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-white/40">Aberto</span>
                    <span className="text-white/60">{timeAgo(selectedIncident.created_at)} atrás</span>
                  </div>
                  {selectedIncident.assigned_to && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Atribuído</span>
                      <span className="text-white/60 truncate ml-2">{selectedIncident.assigned_to}</span>
                    </div>
                  )}
                  {selectedIncident.mttr_minutes != null && (
                    <div className="flex justify-between">
                      <span className="text-white/40">MTTR</span>
                      <span className="text-emerald-400">{selectedIncident.mttr_minutes}min</span>
                    </div>
                  )}
                </div>

                {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'closed' && (
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    {selectedIncident.status === 'open' && (
                      <button type="button"
                        disabled={!!actionLoading}
                        onClick={() => updateIncident(selectedIncident.id, { status: 'investigating' })}
                        className="w-full py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                        Iniciar Investigação
                      </button>
                    )}
                    <button type="button"
                      disabled={!!actionLoading}
                      onClick={() => resolveIncident(selectedIncident.id)}
                      className="w-full py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                      {actionLoading === selectedIncident.id ? 'A resolver…' : 'Resolver Incidente'}
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-3xl">🛡️</div>
                <p className="text-white/30 text-xs">Seleciona um incidente para ver detalhes e tomar acção</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showOpen && (
          <OpenIncidentModal
            onClose={() => setShowOpen(false)}
            onCreated={() => { setShowOpen(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
