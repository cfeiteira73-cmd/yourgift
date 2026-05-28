'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const ACTION_META: Record<string, { icon: string; color: string }> = {
  order_created:          { icon: '📦', color: 'text-blue-400' },
  order_status_changed:   { icon: '🔄', color: 'text-amber-400' },
  order_cancelled:        { icon: '✕',  color: 'text-red-400' },
  quote_submitted:        { icon: '📋', color: 'text-blue-400' },
  quote_approved:         { icon: '✓',  color: 'text-emerald-400' },
  quote_rejected:         { icon: '✗',  color: 'text-red-400' },
  quote_converted:        { icon: '💫', color: 'text-purple-400' },
  invoice_paid:           { icon: '💳', color: 'text-emerald-400' },
  client_profile_updated: { icon: '👤', color: 'text-white/60' },
  artwork_uploaded:       { icon: '🎨', color: 'text-blue-400' },
  artwork_approved:       { icon: '✅', color: 'text-emerald-400' },
  settings_changed:       { icon: '⚙️', color: 'text-amber-400' },
  login:                  { icon: '🔑', color: 'text-white/50' },
  logout:                 { icon: '🚪', color: 'text-white/30' },
  export_requested:       { icon: '📤', color: 'text-amber-400' },
  integration_tested:     { icon: '🔌', color: 'text-blue-400' },
  integration_toggled:    { icon: '🔄', color: 'text-white/50' },
  supplier_scored:        { icon: '⭐', color: 'text-amber-400' },
  cockpit_viewed:         { icon: '👁',  color: 'text-white/30' },
  report_generated:       { icon: '📊', color: 'text-blue-400' },
  portal_error:           { icon: '🚨', color: 'text-red-400' },
};

// High-risk actions that warrant visual emphasis
const HIGH_RISK = new Set(['order_cancelled', 'quote_rejected', 'settings_changed', 'export_requested', 'portal_error']);

function fmt(d: string) {
  return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'medium' });
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const ALL_ACTIONS = Object.keys(ACTION_META).sort();

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [limit, setLimit] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterAction) params.set('action', filterAction);
      const res = await fetch(`/api/audit?${params}`);
      const d = await res.json();
      setEntries(d.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, [limit, filterAction]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 10000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  const uniqueActors = [...new Set(entries.map(e => e.actor_email))];
  const displayed = filterActor ? entries.filter(e => e.actor_email === filterActor) : entries;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Audit Trail</h1>
          <p className="text-white/40 text-xs mt-0.5">Registo imutável · Todas as ações privilegiadas · Append-only</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ${
              autoRefresh ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button type="button" onClick={load}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[10px] transition-colors">
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Entradas',       value: displayed.length },
          { label: 'Atores Únicos',  value: uniqueActors.length },
          { label: 'Alto Risco',     value: displayed.filter(e => HIGH_RISK.has(e.action)).length },
          { label: 'Última Ação',    value: displayed[0] ? timeAgo(displayed[0].created_at) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-2xl font-bold text-white">{loading ? '—' : String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs">
            <option value="">Todas as ações</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <select value={filterActor} onChange={e => setFilterActor(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs">
            <option value="">Todos os atores</option>
            {uniqueActors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-xs">
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} entradas</option>)}
        </select>
        {(filterAction || filterActor) && (
          <button type="button" onClick={() => { setFilterAction(''); setFilterActor(''); }}
            className="px-3 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-[10px]">
            ✕ Limpar
          </button>
        )}
      </div>

      {/* Audit log */}
      {loading ? (
        <div className="space-y-1 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/2 p-10 text-center">
          <p className="text-white/30 text-xs">Nenhuma entrada encontrada</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr] gap-3 px-4 py-2 border-b border-white/5 bg-white/3">
            {['Hora', 'Ação', 'Ator', 'Entity', 'IP'].map(h => (
              <span key={h} className="text-white/30 text-[9px] font-medium uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {displayed.map(entry => {
            const meta = ACTION_META[entry.action] ?? { icon: '•', color: 'text-white/40' };
            const isHighRisk = HIGH_RISK.has(entry.action);
            const isExpanded = expanded === entry.id;

            return (
              <div key={entry.id}
                className={`border-b border-white/5 last:border-0 transition-colors cursor-pointer ${
                  isHighRisk ? 'hover:bg-red-500/5' : 'hover:bg-white/3'
                } ${isExpanded ? (isHighRisk ? 'bg-red-500/5' : 'bg-white/5') : ''}`}
                onClick={() => setExpanded(isExpanded ? null : entry.id)}>

                <div className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr] gap-3 px-4 py-2.5 items-center">
                  <span className="text-white/30 text-[9px] font-mono">{timeAgo(entry.created_at)}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px]">{meta.icon}</span>
                    <span className={`text-[9px] font-medium truncate ${meta.color} ${isHighRisk ? 'font-semibold' : ''}`}>
                      {entry.action}
                    </span>
                    {isHighRisk && <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />}
                  </div>
                  <span className="text-white/50 text-[9px] truncate">{entry.actor_email}</span>
                  <span className="text-white/30 text-[9px] font-mono truncate">
                    {entry.entity_type ? `${entry.entity_type}` : '—'}
                  </span>
                  <span className="text-white/20 text-[9px] font-mono truncate">{entry.ip ?? '—'}</span>
                </div>

                {/* Expanded metadata */}
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/30 mb-0.5">Timestamp</p>
                        <p className="text-white/60 font-mono">{fmt(entry.created_at)}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/30 mb-0.5">Entity ID</p>
                        <p className="text-white/60 font-mono truncate">{entry.entity_id ?? '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/30 mb-0.5">Actor ID</p>
                        <p className="text-white/60 font-mono truncate">{entry.actor_id.slice(0, 12)}…</p>
                      </div>
                    </div>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="rounded-lg bg-white/5 p-2">
                        <p className="text-white/30 text-[9px] mb-1">Metadata</p>
                        <pre className="text-white/40 text-[9px] font-mono overflow-auto max-h-24 leading-relaxed">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance note */}
      <div className="flex items-center gap-2 text-[10px] text-white/20">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Audit trail imutável — entradas write-once, nunca modificadas ou eliminadas via API
      </div>
    </div>
  );
}
