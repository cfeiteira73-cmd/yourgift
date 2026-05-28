'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  last_check: string | null;
  last_success: string | null;
  last_error: string | null;
  error_count: number;
  avg_latency_ms: number | null;
  is_active: boolean;
  webhook_url: string | null;
}

interface Summary {
  total: number;
  active: number;
  health_score: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
}

interface EcosystemData {
  integrations: Integration[];
  summary: Summary;
}

const TYPE_ICONS: Record<string, string> = {
  payment:     '💳',
  database:    '🗄️',
  catalog:     '📦',
  ai:          '🤖',
  email:       '📧',
  storage:     '☁️',
  cdn:         '🌐',
  erp:         '🏢',
  crm:         '👥',
  commerce:    '🛒',
  marketplace: '🏪',
};

const STATUS_META: Record<string, { color: string; dot: string; label: string }> = {
  healthy:  { color: 'text-emerald-400', dot: 'bg-emerald-500', label: 'Saudável' },
  degraded: { color: 'text-amber-400',   dot: 'bg-amber-500',   label: 'Degradado' },
  down:     { color: 'text-red-400',     dot: 'bg-red-500',     label: 'Inativo' },
  unknown:  { color: 'text-white/40',    dot: 'bg-white/20',    label: 'Desconhecido' },
  disabled: { color: 'text-white/20',    dot: 'bg-white/10',    label: 'Desativado' },
};

function timeAgo(d: string | null) {
  if (!d) return 'nunca';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function EcosystemPage() {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState<string>('');
  const [tab, setTab] = useState<'all' | 'active' | 'disabled'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ecosystem?mode=dashboard');
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ping(integrationId: string) {
    setPinging(integrationId);
    try {
      await fetch('/api/ecosystem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ping', integration_id: integrationId }),
      });
      load();
    } finally {
      setPinging('');
    }
  }

  async function pingAll() {
    setPinging('all');
    try {
      await fetch('/api/ecosystem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ping_all' }),
      });
      load();
    } finally {
      setPinging('');
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch('/api/ecosystem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', integration_id: id, active }),
    });
    load();
  }

  const integrations = data?.integrations ?? [];
  const filtered = integrations.filter(i =>
    tab === 'all' ? true : tab === 'active' ? i.is_active : !i.is_active
  );
  const summary = data?.summary;

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Global Ecosystem</h1>
          <p className="text-white/40 text-xs mt-0.5">Integrações · Health checks · Conectores externos</p>
        </div>
        <button type="button" onClick={pingAll} disabled={pinging === 'all'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
          {pinging === 'all' ? (
            <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />A verificar…</>
          ) : '⚡ Ping All'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Health Score', value: summary ? `${summary.health_score}%` : '—', color: summary && summary.health_score < 80 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Saudáveis',    value: summary?.healthy ?? '—',  color: 'text-emerald-400' },
          { label: 'Degradados',   value: summary?.degraded ?? '—', color: summary && summary.degraded > 0 ? 'text-amber-400' : 'text-white' },
          { label: 'Inativos',     value: summary?.down ?? '—',     color: summary && summary.down > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Desconhecidos',value: summary?.unknown ?? '—',  color: 'text-white/40' },
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
          { key: 'active',   label: `Ativos (${integrations.filter(i => i.is_active).length})` },
          { key: 'disabled', label: `Desativados (${integrations.filter(i => !i.is_active).length})` },
          { key: 'all',      label: 'Todos' },
        ].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === key ? 'text-white bg-white/8 border-b-2 border-blue-400' : 'text-white/40 hover:text-white/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map(int => {
          const meta = STATUS_META[int.status] ?? STATUS_META.unknown;
          const icon = TYPE_ICONS[int.type] ?? '🔗';
          const isPinging = pinging === int.id;

          return (
            <motion.div key={int.id} whileHover={{ scale: 1.01 }}
              className={`rounded-2xl border p-4 space-y-3 transition-colors cursor-pointer ${
                selected?.id === int.id ? 'border-blue-500/30 bg-blue-500/8' : 'border-white/8 bg-white/3 hover:bg-white/5'
              } ${!int.is_active ? 'opacity-50' : ''}`}
              onClick={() => setSelected(selected?.id === int.id ? null : int)}>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-white text-xs font-semibold">{int.name}</p>
                    <p className="text-white/30 text-[9px]">{int.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${int.status === 'healthy' ? 'animate-pulse' : ''}`} />
                  <span className={`text-[9px] font-medium ${meta.color}`}>{meta.label}</span>
                </div>
              </div>

              <div className="flex gap-3 text-[9px] text-white/30">
                {int.avg_latency_ms != null && <span>{int.avg_latency_ms}ms</span>}
                <span>Verificado: {timeAgo(int.last_check)}</span>
                {int.error_count > 0 && <span className="text-red-400">{int.error_count} erros</span>}
              </div>

              {int.last_error && (
                <p className="text-red-400 text-[9px] leading-snug truncate">{int.last_error}</p>
              )}

              <div className="flex gap-1.5">
                {int.is_active && (
                  <button type="button" onClick={e => { e.stopPropagation(); ping(int.id); }} disabled={isPinging}
                    className="flex-1 py-1 rounded-lg border border-white/10 hover:bg-white/8 text-white/50 text-[9px] transition-colors disabled:opacity-50">
                    {isPinging ? '…' : '⚡ Ping'}
                  </button>
                )}
                <button type="button" onClick={e => { e.stopPropagation(); toggle(int.id, !int.is_active); }}
                  className={`flex-1 py-1 rounded-lg border text-[9px] transition-colors ${
                    int.is_active
                      ? 'border-red-500/20 hover:bg-red-500/10 text-red-400/60'
                      : 'border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400/60'
                  }`}>
                  {int.is_active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TYPE_ICONS[selected.type] ?? '🔗'}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{selected.name}</p>
                  <p className="text-white/40 text-[10px]">{selected.type} · ID: {selected.id.slice(0, 8)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-white/30 hover:text-white text-lg">×</button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[10px]">
              {[
                { label: 'Status', value: STATUS_META[selected.status]?.label ?? selected.status },
                { label: 'Latência Média', value: selected.avg_latency_ms != null ? `${selected.avg_latency_ms}ms` : '—' },
                { label: 'Última Verificação', value: timeAgo(selected.last_check) },
                { label: 'Erros Totais', value: String(selected.error_count) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-white/5 p-2.5">
                  <p className="text-white/40 mb-0.5">{label}</p>
                  <p className="text-white font-medium">{value}</p>
                </div>
              ))}
            </div>
            {selected.last_error && (
              <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3">
                <p className="text-red-400 text-[10px] font-medium mb-1">Último Erro</p>
                <p className="text-red-300/70 text-[10px]">{selected.last_error}</p>
              </div>
            )}
            {selected.webhook_url && (
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-white/40 text-[10px] font-medium mb-1">Webhook URL</p>
                <p className="text-white/60 text-[10px] font-mono truncate">{selected.webhook_url}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
