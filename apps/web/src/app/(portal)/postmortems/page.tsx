'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PMStats {
  total_postmortems: number;
  published: number;
  draft: number;
  total_incidents_resolved: number;
  avg_mttr_minutes: number;
  postmortem_coverage_pct: number;
}

interface Postmortem {
  id: string;
  incident_id: string | null;
  title: string;
  severity: string;
  status: string;
  authored_by: string | null;
  root_cause: string | null;
  impact_summary: string | null;
  lessons_learned: string | null;
  action_items: Array<{ text: string; status: string }> | null;
  timeline: Array<{ time: string; event: string }> | null;
  contributing_factors: string[] | null;
  created_at: string;
  published_at: string | null;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high:     'bg-amber-500/15 text-amber-400',
  medium:   'bg-yellow-500/15 text-yellow-400',
  low:      'bg-blue-500/15 text-blue-400',
};

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-white/10 text-white/50',
  in_review:  'bg-blue-500/15 text-blue-400',
  approved:   'bg-emerald-500/15 text-emerald-400',
  published:  'bg-violet-500/15 text-violet-400',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/ops?mode=incidents').then(r => r.json()).then(d => setIncidents(d.incidents ?? []));
  }, []);

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    try {
      await fetch('/api/postmortems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', incident_id: selected }),
      });
      onDone();
      onClose();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-sm font-semibold">Gerar Postmortem com AI</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <div>
          <label className="text-white/50 text-[10px] uppercase tracking-wider">Seleciona o Incidente</label>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-violet-500/50">
            <option value="">— Escolher incidente —</option>
            {incidents.map(i => (
              <option key={i.id} value={i.id}>[{i.severity}] {i.title}</option>
            ))}
          </select>
        </div>
        <p className="text-white/40 text-[10px]">
          O AI irá analisar o incidente e gerar automaticamente a causa-raiz, lições aprendidas e action items.
        </p>
        <button type="button" onClick={generate} disabled={generating || !selected}
          className="w-full py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A gerar…
            </span>
          ) : '✨ Gerar Postmortem AI'}
        </button>
      </motion.div>
    </div>
  );
}

function CreateManualModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ title: '', severity: 'medium', impact_summary: '', root_cause: '' });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch('/api/postmortems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_manual', ...form }),
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
        className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-sm font-semibold">Novo Postmortem Manual</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-wider">Título *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Postmortem: Incidente X"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="text-white/50 text-[10px] uppercase tracking-wider">Severidade</label>
            <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none">
              {['low', 'medium', 'high', 'critical'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {[
            { label: 'Impacto', key: 'impact_summary' },
            { label: 'Causa-Raiz', key: 'root_cause' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-white/50 text-[10px] uppercase tracking-wider">{label}</label>
              <textarea value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs mt-1 focus:outline-none resize-none" />
            </div>
          ))}
          <button type="submit" disabled={saving || !form.title}
            className="w-full py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
            {saving ? 'A criar…' : 'Criar Postmortem'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function PostmortemsPage() {
  const [stats, setStats] = useState<PMStats | null>(null);
  const [postmortems, setPostmortems] = useState<Postmortem[]>([]);
  const [selected, setSelected] = useState<Postmortem | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'generate' | 'manual' | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/postmortems?mode=stats'),
        fetch('/api/postmortems?mode=list'),
      ]);
      const [sd, ld] = await Promise.all([statsRes.json(), listRes.json()]);
      setStats(sd.stats);
      setPostmortems(ld.postmortems ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function publish(id: string) {
    setPublishing(true);
    try {
      await fetch('/api/postmortems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish', id }),
      });
      load();
      setSelected(prev => prev ? { ...prev, status: 'published' } : prev);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="p-6 space-y-5 min-h-full">
      {modal === 'generate' && <GenerateModal onClose={() => setModal(null)} onDone={load} />}
      {modal === 'manual' && <CreateManualModal onClose={() => setModal(null)} onDone={load} />}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Postmortems</h1>
          <p className="text-white/40 text-xs mt-0.5">AI-generated incident analysis · Lições aprendidas · Action items</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModal('manual')}
            className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-xs transition-colors">
            + Manual
          </button>
          <button type="button" onClick={() => setModal('generate')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
            ✨ Gerar com AI
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: stats?.total_postmortems ?? '—', color: 'text-white' },
          { label: 'Publicados', value: stats?.published ?? '—',         color: 'text-violet-400' },
          { label: 'MTTR Médio', value: stats ? `${stats.avg_mttr_minutes}m` : '—', color: 'text-blue-400' },
          { label: 'Cobertura',  value: stats ? `${stats.postmortem_coverage_pct}%` : '—', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${color}`}>{String(value)}</p>
            <p className="text-white/40 text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* List */}
        <div className="space-y-2">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Postmortems ({postmortems.length})</p>
          {loading ? (
            <p className="text-white/30 text-xs text-center py-8">A carregar…</p>
          ) : postmortems.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/3 p-8 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-white/30 text-xs">Sem postmortems · Cria o primeiro</p>
            </div>
          ) : postmortems.map(pm => (
            <motion.button key={pm.id} type="button" whileHover={{ x: 2 }}
              onClick={() => setSelected(pm)}
              className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                selected?.id === pm.id ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'
              }`}>
              <div className="flex justify-between items-center gap-2">
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[pm.severity] ?? ''}`}>
                  {pm.severity}
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[pm.status] ?? ''}`}>
                  {pm.status}
                </span>
              </div>
              <p className="text-white text-[10px] font-medium leading-snug line-clamp-2">{pm.title}</p>
              <p className="text-white/30 text-[9px]">{timeAgo(pm.created_at)} · {pm.authored_by?.split('@')[0] ?? 'sistema'}</p>
            </motion.button>
          ))}
        </div>

        {/* Detail */}
        <div className="col-span-2">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold leading-snug">{selected.title}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[selected.severity] ?? ''}`}>
                          {selected.severity}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[selected.status] ?? ''}`}>
                          {selected.status}
                        </span>
                      </div>
                    </div>
                    {selected.status !== 'published' && (
                      <button type="button" onClick={() => publish(selected.id)} disabled={publishing}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 text-[10px] font-medium transition-colors disabled:opacity-50 shrink-0">
                        {publishing ? 'A publicar…' : '↑ Publicar'}
                      </button>
                    )}
                  </div>

                  {/* Sections */}
                  {[
                    { label: '📍 Impacto', content: selected.impact_summary },
                    { label: '🔍 Causa-Raiz', content: selected.root_cause },
                    { label: '📚 Lições Aprendidas', content: selected.lessons_learned },
                  ].map(({ label, content }) => (
                    content ? (
                      <div key={label} className="rounded-xl bg-white/4 border border-white/5 p-3">
                        <p className="text-white/50 text-[10px] font-medium mb-1.5">{label}</p>
                        <p className="text-white/70 text-xs leading-relaxed">{content}</p>
                      </div>
                    ) : null
                  ))}

                  {/* Timeline */}
                  {(selected.timeline ?? []).length > 0 && (
                    <div>
                      <p className="text-white/50 text-[10px] font-medium mb-2">⏱ Timeline</p>
                      <div className="space-y-1.5">
                        {(selected.timeline ?? []).map((t, i) => (
                          <div key={i} className="flex items-start gap-3 text-[10px]">
                            <span className="text-white/30 shrink-0 w-20 truncate">
                              {new Date(t.time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-white/70">{t.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action items */}
                  {(selected.action_items ?? []).length > 0 && (
                    <div>
                      <p className="text-white/50 text-[10px] font-medium mb-2">✅ Action Items</p>
                      <div className="space-y-1.5">
                        {(selected.action_items ?? []).map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-[10px] text-white/60">
                            <span className="text-white/30 shrink-0">{i + 1}.</span>
                            <span className="leading-relaxed">{typeof item === 'string' ? item : item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-4xl">📋</div>
                <p className="text-white/30 text-xs">Seleciona um postmortem ou gera um novo com AI</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
