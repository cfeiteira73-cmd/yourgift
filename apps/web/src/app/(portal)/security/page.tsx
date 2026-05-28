'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityEvent {
  id: string;
  user_email: string | null;
  event_type: string;
  severity: string;
  outcome: string;
  risk_score: number;
  signals: string[];
  reviewed: boolean;
  created_at: string;
  ip_address: string | null;
}

interface ThreatIntel {
  id: string;
  indicator: string;
  type: string;
  threat_level: string;
  reason: string | null;
  active: boolean;
}

interface Posture {
  score: number;
  critical_events: number;
  blocked_requests: number;
  high_risk_unreviewed: number;
  active_threats: number;
}

interface Dashboard {
  posture: Posture;
  recent_events: SecurityEvent[];
  high_risk: SecurityEvent[];
  threat_intel: ThreatIntel[];
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high:     'bg-amber-500/15 text-amber-400',
  medium:   'bg-yellow-500/15 text-yellow-400',
  low:      'bg-blue-500/15 text-blue-400',
  info:     'bg-white/10 text-white/40',
};

const OUTCOME_COLORS: Record<string, string> = {
  blocked: 'text-red-400',
  flagged: 'text-amber-400',
  allowed: 'text-white/40',
};

const THREAT_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-amber-400',
  medium:   'text-yellow-400',
  low:      'text-blue-400',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function PostureGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Seguro' : score >= 60 ? 'Em Atenção' : 'Em Risco';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x={36} y={40} textAnchor="middle" fill="white" fontSize={13} fontWeight="700">{score}</text>
      </svg>
      <p style={{ color }} className="text-[9px] font-medium">{label}</p>
    </div>
  );
}

function AddThreatModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ indicator: '', type: 'ip', threat_level: 'medium', reason: '', auto_block: false });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.indicator) return;
    setSaving(true);
    try {
      await fetch('/api/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'add_threat', ...form }),
      });
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-sm font-semibold">Adicionar Threat Intel</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-wider">Indicador *</label>
            <input type="text" value={form.indicator} onChange={e => setForm(f => ({ ...f, indicator: e.target.value }))}
              placeholder="IP, email, domínio…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/50 text-[10px] uppercase tracking-wider">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none">
                {['ip', 'email', 'user_agent', 'domain'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-[10px] uppercase tracking-wider">Nível</label>
              <select value={form.threat_level} onChange={e => setForm(f => ({ ...f, threat_level: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none">
                {['low', 'medium', 'high', 'critical'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-wider">Razão</label>
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none" />
          </div>
          <button type="submit" disabled={saving || !form.indicator}
            className="w-full py-2 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {saving ? 'A adicionar…' : 'Adicionar Threat'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function SecurityPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ anomalies: unknown[]; ai_analysis: string; entries_scanned: number } | null>(null);
  const [showThreat, setShowThreat] = useState(false);
  const [tab, setTab] = useState<'events' | 'threats' | 'scan'>('events');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security?mode=dashboard');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scanAudit() {
    setScanning(true);
    setTab('scan');
    try {
      const res = await fetch('/api/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'scan_audit' }),
      });
      const d = await res.json();
      setScanResult(d);
      load();
    } finally {
      setScanning(false);
    }
  }

  async function reviewEvent(id: string) {
    await fetch('/api/security', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review_event', event_id: id }),
    });
    load();
  }

  const posture = data?.posture;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {showThreat && <AddThreatModal onClose={() => setShowThreat(false)} onDone={load} />}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Security Engine</h1>
          <p className="text-white/40 text-xs mt-0.5">Eventos suspeitos · Threat Intel · Auditoria Forense</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowThreat(true)}
            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
            + Threat Intel
          </button>
          <button type="button" onClick={scanAudit} disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {scanning ? (
              <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />A analisar…</>
            ) : '🔍 Scan Auditoria'}
          </button>
        </div>
      </div>

      {/* Posture + KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/3 p-4 flex items-center justify-center">
          <PostureGauge score={posture?.score ?? 100} />
        </div>
        {[
          { label: 'Eventos Críticos', value: posture?.critical_events ?? '—', color: posture && posture.critical_events > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Bloqueados', value: posture?.blocked_requests ?? '—', color: 'text-amber-400' },
          { label: 'Alto Risco N/Rev.', value: posture?.high_risk_unreviewed ?? '—', color: posture && posture.high_risk_unreviewed > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Threats Ativos', value: posture?.active_threats ?? '—', color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {[
          { key: 'events',  label: `Eventos (${(data?.recent_events ?? []).length})` },
          { key: 'threats', label: `Threat Intel (${(data?.threat_intel ?? []).length})` },
          { key: 'scan',    label: 'Scan Resultado' },
        ].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === key ? 'text-white bg-white/8 border-b-2 border-red-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'events' && (
          <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-5">
            {/* Event list */}
            <div className="col-span-2 space-y-1.5">
              {(data?.recent_events ?? []).length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/3 p-8 text-center">
                  <p className="text-2xl mb-2">🛡️</p>
                  <p className="text-white/30 text-xs">Sem eventos registados</p>
                </div>
              ) : (data?.recent_events ?? []).map(ev => (
                <div key={ev.id} className="rounded-xl border border-white/5 bg-white/3 px-3 py-2 flex items-center gap-3">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${SEV_COLORS[ev.severity] ?? ''}`}>
                    {ev.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[10px] font-medium truncate">{ev.event_type.replace(/_/g, ' ')}</p>
                    {ev.user_email && <p className="text-white/30 text-[9px] truncate">{ev.user_email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-medium ${OUTCOME_COLORS[ev.outcome] ?? ''}`}>{ev.outcome}</span>
                    <span className="text-white/30 text-[9px]">{ev.risk_score}</span>
                    <span className="text-white/20 text-[9px]">{timeAgo(ev.created_at)}</span>
                    {!ev.reviewed && ev.risk_score >= 40 && (
                      <button type="button" onClick={() => reviewEvent(ev.id)}
                        className="px-1.5 py-0.5 rounded border border-white/10 hover:bg-white/5 text-white/40 text-[8px] transition-colors">
                        Rev
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* High risk sidebar */}
            <div className="space-y-2">
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Alto Risco Não Revisto ({(data?.high_risk ?? []).length})
              </p>
              {(data?.high_risk ?? []).length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/3 p-6 text-center">
                  <p className="text-xl mb-1">✅</p>
                  <p className="text-white/30 text-[10px]">Nenhum pendente</p>
                </div>
              ) : (data?.high_risk ?? []).map(ev => (
                <div key={ev.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-red-400 text-[10px] font-medium truncate">{ev.event_type.replace(/_/g, ' ')}</p>
                    <span className="text-white font-bold text-xs shrink-0">{ev.risk_score}</span>
                  </div>
                  {ev.user_email && <p className="text-white/40 text-[9px] truncate">{ev.user_email}</p>}
                  <button type="button" onClick={() => reviewEvent(ev.id)}
                    className="w-full py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-400 text-[9px] transition-colors">
                    Marcar Revisto
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'threats' && (
          <motion.div key="threats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {(data?.threat_intel ?? []).length === 0 ? (
              <p className="text-white/30 text-xs py-8 text-center">Sem threat intel · Adiciona indicadores suspeitos</p>
            ) : (
              <div className="rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40">
                      {['Indicador', 'Tipo', 'Nível', 'Razão', 'Estado'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.threat_intel ?? []).map((t, i) => (
                      <tr key={t.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/1' : ''}`}>
                        <td className="px-4 py-2.5 text-white font-medium font-mono text-[9px]">{t.indicator}</td>
                        <td className="px-4 py-2.5 text-white/60">{t.type}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-medium ${THREAT_COLORS[t.threat_level] ?? ''}`}>{t.threat_level}</span>
                        </td>
                        <td className="px-4 py-2.5 text-white/40 max-w-xs truncate">{t.reason ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${t.active ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/30'}`}>
                            {t.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {scanning ? (
              <div className="flex items-center justify-center gap-3 py-16">
                <span className="w-5 h-5 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                <p className="text-white/40 text-xs">A analisar audit trail…</p>
              </div>
            ) : scanResult ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Entradas Analisadas', value: scanResult.entries_scanned, color: 'text-blue-400' },
                    { label: 'Anomalias Detetadas', value: scanResult.anomalies.length, color: scanResult.anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400' },
                    { label: 'Estado', value: scanResult.anomalies.length === 0 ? 'Limpo' : 'Anomalias', color: scanResult.anomalies.length === 0 ? 'text-emerald-400' : 'text-red-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
                      <p className={`text-2xl font-bold ${color}`}>{String(value)}</p>
                      <p className="text-white/40 text-[10px] mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                {scanResult.ai_analysis && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-amber-400 text-[10px] font-medium mb-2">🤖 Análise AI</p>
                    <p className="text-white/70 text-xs leading-relaxed">{scanResult.ai_analysis}</p>
                  </div>
                )}
                {scanResult.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Anomalias Detetadas</p>
                    {(scanResult.anomalies as Record<string, unknown>[]).map((a, i) => (
                      <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3">
                        <pre className="text-white/60 text-[9px] leading-relaxed overflow-x-auto">
                          {JSON.stringify(a, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
                {scanResult.anomalies.length === 0 && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
                    <p className="text-3xl mb-3">✅</p>
                    <p className="text-emerald-400 text-sm font-semibold">Audit trail limpo</p>
                    <p className="text-white/40 text-xs mt-1">Sem anomalias detetadas em {scanResult.entries_scanned} entradas</p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/3 p-10 text-center">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-white/30 text-xs">Clica em "Scan Auditoria" para analisar o audit trail</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
