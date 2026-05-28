'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface AuditEntry {
  id: string;
  user_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  result: string;
  duration_ms: number | null;
  created_at: string;
}

interface Stats {
  today: number;
  week: number;
  top_actions: { action: string; count: number }[];
  results: Record<string, number>;
}

const RESULT_COLORS: Record<string, string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  partial: 'text-amber-400',
};

const ACTION_ICONS: Record<string, string> = {
  order:    '📦',
  quote:    '📋',
  client:   '👤',
  invoice:  '💳',
  artwork:  '🎨',
  login:    '🔑',
  settings: '⚙️',
  export:   '📤',
  supplier: '🏭',
};

function actionIcon(action: string): string {
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (action.includes(key)) return icon;
  }
  return '⚡';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function ActivityPage() {
  const [trail, setTrail] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'order' | 'quote' | 'client'>('all');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resultFilter = filter === 'error' ? '&result=error' : '';
      const [trailRes, statsRes] = await Promise.all([
        fetch(`/api/audit?mode=trail&limit=${LIMIT}&offset=${offset}${resultFilter}`),
        fetch('/api/audit?mode=stats'),
      ]);
      const [trailData, statsData] = await Promise.all([trailRes.json(), statsRes.json()]);
      setTrail(trailData.trail ?? []);
      setTotal(trailData.total ?? 0);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setOffset(0); }, [filter]);

  const filtered = filter === 'all' || filter === 'error'
    ? trail
    : trail.filter(e => e.action.includes(filter) || e.entity_type?.includes(filter));

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Activity Stream</h1>
          <p className="text-white/40 text-xs mt-0.5">Registo imutável de todas as acções da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'error', 'order', 'quote', 'client'] as const).map(f => (
            <button key={f} type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}>
              {f === 'all' ? 'Tudo' : f === 'error' ? '⚠ Erros' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-xl font-bold text-white">{stats.today.toLocaleString('pt-PT')}</p>
            <p className="text-white/40 text-[10px] mt-1">Acções hoje</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-xl font-bold text-blue-400">{stats.week.toLocaleString('pt-PT')}</p>
            <p className="text-white/40 text-[10px] mt-1">Esta semana</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-xl font-bold text-emerald-400">{stats.results?.success ?? 0}</p>
            <p className="text-white/40 text-[10px] mt-1">Sucesso</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-xl font-bold text-red-400">{stats.results?.error ?? 0}</p>
            <p className="text-white/40 text-[10px] mt-1">Erros</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Trail */}
        <div className="col-span-2 space-y-2">
          {loading ? (
            <p className="text-white/30 text-xs text-center py-10">A carregar…</p>
          ) : filtered.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-10">Sem entradas</p>
          ) : (
            <>
              {filtered.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex gap-3 items-start p-3 rounded-xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-sm shrink-0 mt-0.5">
                    {actionIcon(entry.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-xs font-medium truncate">{entry.action}</p>
                      <span className={`text-[10px] font-medium ${RESULT_COLORS[entry.result] ?? 'text-white/40'}`}>
                        {entry.result}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-white/30 text-[10px]">{entry.user_email}</span>
                      {entry.entity_type && (
                        <span className="text-white/20 text-[10px]">
                          {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id.slice(0, 8)}` : ''}
                        </span>
                      )}
                      {entry.duration_ms != null && (
                        <span className="text-white/20 text-[10px]">{entry.duration_ms}ms</span>
                      )}
                    </div>
                  </div>
                  <span className="text-white/20 text-[10px] shrink-0 mt-1">{timeAgo(entry.created_at)}</span>
                </motion.div>
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-white/30 text-xs">{total.toLocaleString('pt-PT')} entradas no total</span>
                <div className="flex gap-2">
                  <button type="button" disabled={offset === 0}
                    onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                    className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 disabled:opacity-30 transition-colors">
                    ← Anterior
                  </button>
                  <button type="button" disabled={offset + LIMIT >= total}
                    onClick={() => setOffset(o => o + LIMIT)}
                    className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:bg-white/5 disabled:opacity-30 transition-colors">
                    Próximo →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top actions sidebar */}
        <div className="space-y-4">
          {stats?.top_actions && stats.top_actions.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3">
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Top Acções</p>
              <div className="space-y-2">
                {stats.top_actions.slice(0, 8).map((a, i) => (
                  <div key={a.action} className="flex items-center gap-2">
                    <span className="text-white/20 text-[10px] w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-white/60 text-[10px] truncate">{a.action}</span>
                        <span className="text-white/40 text-[10px] shrink-0 ml-2">{a.count}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-blue-500/50"
                          style={{ width: `${Math.round((a.count / stats.top_actions[0].count) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
