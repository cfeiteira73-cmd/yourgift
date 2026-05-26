'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { API_BASE, getAdminToken, timeAgo, formatDateTime } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventLog {
  id: string;
  entity: string;
  entityId: string;
  event: string;
  actorId: string | null;
  actorType: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  orderId?: string | null;
}

interface EventLogResponse {
  data: EventLog[];
  total: number;
  limit: number;
  offset: number;
}

type DateRange = '24h' | '7d' | '30d' | 'custom';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = ['order', 'quote', 'approval', 'budget', 'campaign', 'store'];

const EVENT_COLORS: Record<string, string> = {
  'order': 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
  'quote': 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/20',
  'approval': 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20',
  'budget': 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20',
  'campaign': 'bg-[#f472b6]/10 text-[#f472b6] border-[#f472b6]/20',
  'store': 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20',
  'inventory': 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20',
  'system': 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20',
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  admin: 'bg-[#4da3ff]/10 text-[#4da3ff] border-[#4da3ff]/20',
  client: 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20',
  system: 'bg-[#4d6a87]/10 text-[#4d6a87] border-[#4d6a87]/20',
};

const PAGE_SIZE = 50;

function getDateFrom(range: DateRange, custom?: string): string | undefined {
  if (range === 'custom') return custom;
  const now = new Date();
  if (range === '24h') return new Date(now.getTime() - 86_400_000).toISOString();
  if (range === '7d') return new Date(now.getTime() - 7 * 86_400_000).toISOString();
  if (range === '30d') return new Date(now.getTime() - 30 * 86_400_000).toISOString();
  return undefined;
}

// ─── Event badge ──────────────────────────────────────────────────────────────

function EventBadge({ event }: { event: string }) {
  const entity = event.split('.')[0] ?? 'system';
  const colorClass = EVENT_COLORS[entity] ?? EVENT_COLORS['system'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
      {event}
    </span>
  );
}

function ActorBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-[#4d6a87]">—</span>;
  const colorClass = ACTOR_TYPE_COLORS[type] ?? ACTOR_TYPE_COLORS['system'];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${colorClass}`}>
      {type}
    </span>
  );
}

// ─── Payload viewer ───────────────────────────────────────────────────────────

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const str = JSON.stringify(payload);
  const truncated = str.length > 80 ? str.slice(0, 80) + '…' : str;
  return (
    <span className="font-mono text-[#4d6a87] text-[10px]">{truncated}</span>
  );
}

// ─── Slide-over panel ─────────────────────────────────────────────────────────

function EventDetailPanel({
  event,
  onClose,
}: {
  event: EventLog;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-[#0b1526] border-l border-[#1a2f48] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
          <div>
            <EventBadge event={event.event} />
            <p className="text-xs text-[#4d6a87] mt-1">{formatDateTime(event.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6a87] hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'ID', value: event.id.slice(0, 16) + '…' },
              { label: 'Entity', value: `${event.entity}` },
              { label: 'Entity ID', value: event.entityId.slice(0, 16) + '…' },
              { label: 'Actor Type', value: event.actorType ?? '—' },
              { label: 'Actor ID', value: event.actorId?.slice(0, 16) ?? '—' },
              { label: 'Order ID', value: event.orderId?.slice(0, 16) ?? '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[#07111f] border border-[#1a2f48] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">{item.label}</p>
                <p className="text-xs font-mono text-[#f0f6ff] mt-0.5 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Payload */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-2">Payload</p>
            <pre className="rounded-xl bg-[#07111f] border border-[#1a2f48] p-4 text-xs text-[#8ba8c7] font-mono overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>

          {/* Links */}
          {event.orderId && (
            <a
              href={`/orders/${event.orderId}`}
              className="flex items-center gap-2 text-sm text-[#4da3ff] hover:text-[#74e7ff] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="3" width="10" height="9" rx="1" />
                <path d="M5 3V2.5a2.5 2.5 0 0 1 4 0V3" />
              </svg>
              Ver encomenda →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAuditPage() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [entityFilter, setEntityFilter] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Detail panel
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const buildUrl = useCallback((offset: number) => {
    const params = new URLSearchParams();
    if (entityFilter) params.set('entity', entityFilter);
    if (eventSearch) params.set('event', eventSearch);
    if (actorFilter) params.set('actorId', actorFilter);
    const fromDate = getDateFrom(dateRange, customFrom || undefined);
    if (fromDate) params.set('from', fromDate);
    if (dateRange === 'custom' && customTo) params.set('to', customTo);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));
    return `${API_BASE}/api/v1/events?${params.toString()}`;
  }, [entityFilter, eventSearch, actorFilter, dateRange, customFrom, customTo]);

  const load = useCallback(async (offset: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(buildUrl(offset), {
        headers: authHeaders(),
        signal: controller.signal,
      });
      const data = await res.json() as EventLogResponse;
      setEvents(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [buildUrl, authHeaders]);

  // Reload when filters change, reset to page 0
  useEffect(() => {
    setPage(0);
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, eventSearch, actorFilter, dateRange, customFrom, customTo]);

  useEffect(() => {
    if (page > 0) load(page * PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportCsv = useCallback(() => {
    if (!events.length) return;
    const headers = ['id', 'event', 'entity', 'entityId', 'actorType', 'actorId', 'createdAt'];
    const rows = events.map((e) => [
      e.id,
      e.event,
      e.entity,
      e.entityId,
      e.actorType ?? '',
      e.actorId ?? '',
      e.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  const SELECT_STYLE = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 10px center',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Registo de Auditoria</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${total.toLocaleString('pt-PT')} eventos`}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!events.length}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 2v7M4 7l3 3 3-3" />
            <path d="M2 11h10" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Entity type */}
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          style={SELECT_STYLE}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
        >
          <option value="">Todas as entidades</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        {/* Event search */}
        <div className="relative min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d6a87]"
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="5.5" cy="5.5" r="4" />
            <path d="M9 9l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar evento..."
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
          />
        </div>

        {/* Actor ID */}
        <input
          type="text"
          placeholder="Actor ID..."
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors min-w-[150px]"
        />

        {/* Date range */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          style={SELECT_STYLE}
          className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none pr-8 cursor-pointer"
        >
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="custom">Personalizado</option>
        </select>

        {/* Custom date range */}
        {dateRange === 'custom' && (
          <>
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
            />
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
            />
          </>
        )}

        {/* Clear */}
        {(entityFilter || eventSearch || actorFilter || dateRange !== '7d') && (
          <button
            type="button"
            onClick={() => {
              setEntityFilter('');
              setEventSearch('');
              setActorFilter('');
              setDateRange('7d');
              setCustomFrom('');
              setCustomTo('');
            }}
            className="px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:border-[#f87171]/30 hover:text-[#f87171] transition-all"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              {['Timestamp', 'Evento', 'Entidade', 'Actor', 'Payload'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-[#1a2f48]/50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-[#0d1f3a] rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#4d6a87]">
                  Nenhum evento encontrado para os filtros actuais
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-[#1a2f48]/50 hover:bg-[#102131]/70 transition-colors cursor-pointer"
                  onClick={() => setSelectedEvent(ev)}
                >
                  {/* Timestamp */}
                  <td className="px-4 py-2.5 text-[#4d6a87] tabular-nums whitespace-nowrap" title={formatDateTime(ev.createdAt)}>
                    {timeAgo(ev.createdAt)}
                  </td>

                  {/* Event badge */}
                  <td className="px-4 py-2.5">
                    <EventBadge event={ev.event} />
                  </td>

                  {/* Entity */}
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[#8ba8c7]">{ev.entity}</span>
                      <span className="font-mono text-[#4d6a87] text-[10px]">{ev.entityId.slice(0, 12)}…</span>
                    </div>
                  </td>

                  {/* Actor */}
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <ActorBadge type={ev.actorType} />
                      {ev.actorId && (
                        <span className="font-mono text-[#4d6a87] text-[10px]">{ev.actorId.slice(0, 12)}…</span>
                      )}
                    </div>
                  </td>

                  {/* Payload preview */}
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <PayloadPreview payload={ev.payload} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#4d6a87]">
            Página {page + 1} de {totalPages} · {total.toLocaleString('pt-PT')} eventos
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-sm text-[#8ba8c7] hover:bg-[#102131] transition-all disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-[#1a2f48] text-sm text-[#8ba8c7] hover:bg-[#102131] transition-all disabled:opacity-40"
            >
              Seguinte →
            </button>
          </div>
        </div>
      )}

      {/* Detail Slide-over */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
