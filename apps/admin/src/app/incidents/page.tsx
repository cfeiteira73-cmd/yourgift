'use client';

import { useEffect, useState, useCallback } from 'react';
import { API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'SEV0' | 'SEV1' | 'SEV2' | 'SEV3';
type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';

interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  blastRadius: string;
  affectedServices: string[];
  startedAt: string;
  resolvedAt?: string;
  mttrMinutes?: number;
}

interface IncidentEvent {
  id: string;
  type: 'created' | 'status_change' | 'update' | 'resolved';
  message: string;
  author?: string;
  timestamp: string;
}

interface IncidentStats {
  mttrP50Minutes: number;
  mttrP95Minutes: number;
  totalLast30d: number;
  meanTimeToDetectMinutes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' };
}

const SEV_CONFIG: Record<Severity, { color: string; border: string; bg: string; pulse: boolean }> = {
  SEV0: { color: '#ef4444', border: 'border-[#ef4444]', bg: 'rgba(239,68,68,0.1)', pulse: true },
  SEV1: { color: '#f97316', border: 'border-[#f97316]', bg: 'rgba(249,115,22,0.08)', pulse: false },
  SEV2: { color: '#f59e0b', border: 'border-[#f59e0b]', bg: 'rgba(245,158,11,0.08)', pulse: false },
  SEV3: { color: '#6b7280', border: 'border-[#374151]', bg: 'rgba(107,114,128,0.06)', pulse: false },
};

const STATUS_FLOW: IncidentStatus[] = ['open', 'investigating', 'mitigated', 'resolved'];

function statusNext(current: IncidentStatus): IncidentStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

function statusColor(status: IncidentStatus): string {
  return { open: '#ef4444', investigating: '#f59e0b', mitigated: '#4da3ff', resolved: '#63e6be' }[status];
}

function eventTypeIcon(type: IncidentEvent['type']): string {
  return { created: '🔴', status_change: '🔄', update: '📝', resolved: '✅' }[type];
}

// ── Create Incident Form ──────────────────────────────────────────────────────

function CreateIncidentForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('SEV2');
  const [services, setServices] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/v1/incidents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          severity,
          affectedServices: services.split(',').map((s) => s.trim()).filter(Boolean),
          description: description.trim(),
        }),
      });
      setTitle(''); setSeverity('SEV2'); setServices(''); setDescription('');
      setOpen(false);
      onCreated();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg text-[12px] font-medium hover:bg-[#ef4444]/20 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M6.5 1v11M1 6.5h11" />
        </svg>
        Declare Incident
      </button>
    );
  }

  return (
    <div className="bg-[#0b1526] border border-[#ef4444]/30 rounded-xl p-5 space-y-3">
      <h3 className="text-[13px] font-semibold text-[#f0f6ff]">Declare New Incident</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Incident title…"
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[13px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
      />
      <div className="flex gap-2">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[12px] text-[#f0f6ff] focus:outline-none focus:border-[#4da3ff]/60"
        >
          {(['SEV0', 'SEV1', 'SEV2', 'SEV3'] as Severity[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          value={services}
          onChange={(e) => setServices(e.target.value)}
          placeholder="Affected services (comma-separated)"
          className="flex-1 bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description…"
        rows={2}
        className="w-full bg-[#07111f] border border-[#1a2f48] rounded-lg px-3 py-2 text-[12px] text-[#f0f6ff] placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/60 resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !title.trim()}
          className="px-4 py-2 bg-[#ef4444] text-white rounded-lg text-[12px] font-semibold hover:bg-[#dc2626] disabled:opacity-50 transition-colors"
        >
          {submitting ? '…' : 'Declare'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] rounded-lg text-[12px] hover:text-[#8ba8c7] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Timeline Panel ────────────────────────────────────────────────────────────

function TimelinePanel({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${API_BASE}/api/v1/incidents/${incidentId}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json() as { events?: IncidentEvent[] };
        setEvents(data.events ?? []);
      }
      setLoading(false);
    })();
  }, [incidentId]);

  return (
    <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2f48] bg-[#07111f]/50">
        <span className="text-[12px] font-semibold text-[#f0f6ff]">Timeline</span>
        <button type="button" onClick={onClose} className="text-[#4d6a87] hover:text-[#f0f6ff] text-[18px] leading-none">&times;</button>
      </div>
      {loading ? (
        <div className="py-8 text-center text-[#4d6a87] text-[12px]">Loading…</div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-[#4d6a87] text-[12px]">No events yet.</div>
      ) : (
        <div className="p-4 space-y-3">
          {events.map((ev, i) => (
            <div key={ev.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="text-base">{eventTypeIcon(ev.type)}</div>
                {i < events.length - 1 && <div className="w-px flex-1 bg-[#1a2f48] mt-1" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="text-[12px] text-[#cfe4ff]">{ev.message}</div>
                <div className="text-[10px] text-[#4d6a87] mt-0.5">
                  {ev.author ? `${ev.author} · ` : ''}{new Date(ev.timestamp).toLocaleString('pt-PT')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const h = authHeaders();
    const [incRes, stRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/incidents?limit=50`, { headers: h }),
      fetch(`${API_BASE}/api/v1/incidents/stats`, { headers: h }),
    ]);
    if (incRes.status === 'fulfilled' && incRes.value.ok) {
      const data = await incRes.value.json() as { incidents: Incident[] };
      setIncidents(data.incidents ?? []);
    }
    if (stRes.status === 'fulfilled' && stRes.value.ok) {
      setStats(await stRes.value.json() as IncidentStats);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const updateStatus = async (incidentId: string, status: IncidentStatus) => {
    setUpdatingId(incidentId);
    await fetch(`${API_BASE}/api/v1/incidents/${incidentId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    await fetchData();
    setUpdatingId(null);
  };

  const active = incidents.filter((i) => i.status !== 'resolved');
  const sevCounts: Record<Severity, number> = { SEV0: 0, SEV1: 0, SEV2: 0, SEV3: 0 };
  active.forEach((i) => { sevCounts[i.severity]++; });

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[#ef4444]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 1L1 17h16L9 1z" />
              <path d="M9 7v4M9 13h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#f0f6ff]">Incident Command</h1>
            <p className="text-[12px] text-[#4d6a87] mt-0.5">
              {active.length} active · auto-refresh 15s
              {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('pt-PT')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* SEV chips */}
          {(['SEV0', 'SEV1', 'SEV2', 'SEV3'] as Severity[]).map((sev) => {
            const cfg = SEV_CONFIG[sev];
            return (
              <div
                key={sev}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-semibold"
                style={{ borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color }}
              >
                {sevCounts[sev] > 0 && cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                {sev} <span className="font-bold">{sevCounts[sev]}</span>
              </div>
            );
          })}
          <CreateIncidentForm onCreated={() => void fetchData()} />
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'MTTR p50', value: `${stats.mttrP50Minutes}m`, color: '#63e6be' },
            { label: 'MTTR p95', value: `${stats.mttrP95Minutes}m`, color: '#fbbf24' },
            { label: 'Total (30d)', value: stats.totalLast30d, color: '#4da3ff' },
            { label: 'Mean TTD', value: `${stats.meanTimeToDetectMinutes}m`, color: '#a78bfa' },
          ].map((k) => (
            <div key={k.label} className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-4">
              <div className="text-[22px] font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[11px] text-[#4d6a87] mt-1 uppercase tracking-wider">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_340px] gap-4">
        {/* Incidents list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-[#0b1526] border border-[#1a2f48] rounded-xl text-[#4d6a87] text-[13px]">
              <span className="w-4 h-4 border border-[#4da3ff] border-t-transparent rounded-full animate-spin mr-2" />
              Loading incidents…
            </div>
          ) : active.length === 0 ? (
            <div className="flex items-center justify-center py-20 bg-[#0b1526] border border-[#1a2f48] rounded-xl text-[#4d6a87] text-[13px]">
              <div className="text-center">
                <div className="text-[#63e6be] text-2xl mb-2">✓</div>
                No active incidents — all systems nominal.
              </div>
            </div>
          ) : (
            active.map((incident) => {
              const sevCfg = SEV_CONFIG[incident.severity];
              const next = statusNext(incident.status);
              const isUpdating = updatingId === incident.id;
              return (
                <div
                  key={incident.id}
                  className={`bg-[#0b1526] border-2 rounded-xl p-4 transition-all ${sevCfg.border} ${sevCfg.pulse ? 'shadow-[0_0_12px_rgba(239,68,68,0.2)]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: sevCfg.bg, color: sevCfg.color }}
                      >{incident.severity}</span>
                      {sevCfg.pulse && <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#f0f6ff]">{incident.title}</div>
                      {incident.blastRadius && (
                        <div className="text-[11px] text-[#4d6a87] mt-0.5">{incident.blastRadius}</div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {incident.affectedServices.map((svc) => (
                          <span key={svc} className="text-[10px] px-2 py-0.5 rounded bg-[#1a2f48] text-[#8ba8c7]">{svc}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize"
                          style={{ backgroundColor: `${statusColor(incident.status)}15`, color: statusColor(incident.status) }}
                        >{incident.status}</span>
                        <span className="text-[10px] text-[#4d6a87]">
                          Started {new Date(incident.startedAt).toLocaleString('pt-PT')}
                        </span>
                        {incident.mttrMinutes && (
                          <span className="text-[10px] text-[#4da3ff]">MTTR {incident.mttrMinutes}m</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {next && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(incident.id, next)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] rounded-lg text-[11px] font-medium hover:bg-[#4da3ff]/20 disabled:opacity-50 transition-colors capitalize"
                        >
                          {isUpdating ? '…' : `→ ${next}`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(selectedId === incident.id ? null : incident.id)}
                        className="px-3 py-1.5 bg-[#0b1526] border border-[#1a2f48] text-[#4d6a87] rounded-lg text-[11px] hover:text-[#8ba8c7] transition-colors"
                      >
                        Timeline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Timeline panel */}
        <div>
          {selectedId ? (
            <TimelinePanel incidentId={selectedId} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl p-6 text-center text-[#4d6a87] text-[12px]">
              Select an incident to view its timeline.
            </div>
          )}
        </div>
      </div>

      {/* Resolved incidents */}
      {incidents.filter((i) => i.status === 'resolved').length > 0 && (
        <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#1a2f48] bg-[#07111f]/50 text-[11px] font-semibold text-[#4d6a87] uppercase tracking-wider">
            Recently Resolved
          </div>
          {incidents.filter((i) => i.status === 'resolved').slice(0, 5).map((incident) => (
            <div key={incident.id} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a2f48]/50 hover:bg-[#07111f]/40">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1a2f48] text-[#4d6a87]">{incident.severity}</span>
              <div className="flex-1 text-[12px] text-[#8ba8c7]">{incident.title}</div>
              {incident.mttrMinutes && (
                <span className="text-[11px] text-[#63e6be]">MTTR {incident.mttrMinutes}m</span>
              )}
              <span className="text-[10px] text-[#4d6a87]">{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('pt-PT') : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
