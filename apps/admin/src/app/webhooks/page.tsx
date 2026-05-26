'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, formatDateTime, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description?: string;
  companyId?: string;
  createdAt: string;
  _count: { deliveries: number };
}

interface WebhookDelivery {
  id: string;
  event: string;
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  attempts: number;
  deliveredAt?: string;
  createdAt: string;
}

const ALL_EVENTS = [
  'order.created',
  'order.paid',
  'order.approved',
  'order.shipped',
  'order.delivered',
  'quote.created',
  'quote.approved',
  'approval.requested',
  'approval.resolved',
  'campaign.created',
  'inventory.low',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function truncate(str: string, max = 50): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventBadge({ event }: { event: string }) {
  const colorMap: Record<string, string> = {
    'order.created': 'bg-[#4da3ff]/10 text-[#4da3ff]',
    'order.paid': 'bg-[#22c55e]/10 text-[#22c55e]',
    'order.approved': 'bg-[#22c55e]/10 text-[#22c55e]',
    'order.shipped': 'bg-[#f59e0b]/10 text-[#f59e0b]',
    'order.delivered': 'bg-[#a78bfa]/10 text-[#a78bfa]',
    'quote.created': 'bg-[#4da3ff]/10 text-[#4da3ff]',
    'quote.approved': 'bg-[#22c55e]/10 text-[#22c55e]',
    'approval.requested': 'bg-[#f59e0b]/10 text-[#f59e0b]',
    'approval.resolved': 'bg-[#22c55e]/10 text-[#22c55e]',
    'campaign.created': 'bg-[#e879f9]/10 text-[#e879f9]',
    'inventory.low': 'bg-[#f87171]/10 text-[#f87171]',
  };
  const color = colorMap[event] ?? 'bg-[#4d6a87]/20 text-[#8ba8c7]';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {event}
    </span>
  );
}

// ── Create Endpoint Modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { setError('URL é obrigatório'); return; }
    if (selectedEvents.length === 0) { setError('Selecciona pelo menos um evento'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/webhooks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url: url.trim(), description: description.trim() || undefined, events: selectedEvents }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar endpoint');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0b1526] border border-[#1a2f48] rounded-xl shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
          <h2 className="text-sm font-semibold text-white">Novo Endpoint</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6a87] hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">
              URL do Endpoint <span className="text-[#f87171]">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-1.5">
              Descrição <span className="text-[#4d6a87]">(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Zapier — Notificações de encomendas"
              className="w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff] transition-colors"
            />
          </div>

          {/* Events */}
          <div>
            <label className="block text-xs font-medium text-[#8ba8c7] mb-2">
              Eventos <span className="text-[#f87171]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {ALL_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-transparent hover:border-[#1a2f48] hover:bg-[#07111f] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded border-[#1a2f48] bg-[#07111f] text-[#4da3ff] focus:ring-[#4da3ff]/30"
                  />
                  <span className="text-xs text-[#8ba8c7]">{event}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[#4d6a87] mt-1.5">
              {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''} seleccionado{selectedEvents.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-[#f87171] bg-[#f87171]/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#8ba8c7] hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74e7ff] disabled:opacity-50 transition-colors"
            >
              {loading ? 'A criar…' : 'Criar Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Deliveries Drawer ─────────────────────────────────────────────────────────

interface DeliveriesDrawerProps {
  endpoint: WebhookEndpoint;
  onClose: () => void;
}

function DeliveriesDrawer({ endpoint, onClose }: DeliveriesDrawerProps) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/webhooks/${endpoint.id}/deliveries`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as WebhookDelivery[];
          setDeliveries(data);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [endpoint.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-xl h-full bg-[#0b1526] border-l border-[#1a2f48] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
          <div>
            <h2 className="text-sm font-semibold text-white">Histórico de Entregas</h2>
            <p className="text-[11px] text-[#4d6a87] mt-0.5 font-mono">{truncate(endpoint.url, 55)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6a87] hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#4da3ff]/30 border-t-[#4da3ff] rounded-full animate-spin" />
            </div>
          )}

          {!loading && deliveries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#1a2f48] flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="9" cy="9" r="7.5" />
                  <path d="M9 5v4M9 13h.01" />
                </svg>
              </div>
              <p className="text-sm text-[#8ba8c7]">Sem entregas ainda</p>
              <p className="text-xs text-[#4d6a87] mt-1">As entregas aparecerão aqui após o primeiro evento</p>
            </div>
          )}

          {deliveries.map((d) => (
            <div
              key={d.id}
              className="bg-[#07111f] border border-[#1a2f48] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                {/* Status dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${d.success ? 'bg-[#22c55e]' : 'bg-[#f87171]'}`}
                />
                <EventBadge event={d.event} />
                {d.statusCode && (
                  <span className={`text-[10px] font-mono font-bold ${d.success ? 'text-[#22c55e]' : 'text-[#f87171]'}`}>
                    {d.statusCode}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[#4d6a87]">
                  {formatDateTime(d.createdAt)}
                </span>
              </div>
              {d.responseBody && (
                <pre className="text-[10px] text-[#8ba8c7] bg-[#0b1526] border border-[#1a2f48] rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                  {d.responseBody}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);

  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/webhooks`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as WebhookEndpoint[];
        setEndpoints(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEndpoints();
  }, [loadEndpoints]);

  async function handleToggle(endpoint: WebhookEndpoint) {
    try {
      await fetch(`${API_BASE}/api/v1/webhooks/${endpoint.id}/toggle`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !endpoint.isActive }),
      });
      await loadEndpoints();
    } catch {
      // silent
    }
  }

  async function handleDelete(endpoint: WebhookEndpoint) {
    if (!confirm(`Remover endpoint ${endpoint.url}?`)) return;
    try {
      await fetch(`${API_BASE}/api/v1/webhooks/${endpoint.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await loadEndpoints();
    } catch {
      // silent
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Webhooks</h1>
          <p className="text-sm text-[#4d6a87] mt-0.5">
            Disponível para integrações Zapier, Make, n8n e sistemas customizados
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74e7ff] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Novo Endpoint
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#4da3ff]/5 border border-[#4da3ff]/20">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4da3ff" strokeWidth="1.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7v4M8 5h.01" />
        </svg>
        <div className="text-xs text-[#8ba8c7] leading-relaxed">
          <span className="font-semibold text-white">Como funciona:</span>{' '}
          Cada evento é enviado via POST com um header{' '}
          <code className="px-1 py-0.5 bg-[#0b1526] border border-[#1a2f48] rounded text-[#4da3ff] font-mono text-[10px]">
            X-YourGift-Signature
          </code>{' '}
          (HMAC-SHA256). Valida a assinatura no teu servidor para garantir autenticidade.
          O secret é gerado automaticamente e mostrado apenas uma vez — guarda-o em segurança.
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b1526] border border-[#1a2f48] rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_3fr_90px_70px_130px_100px] gap-4 px-5 py-3 border-b border-[#1a2f48]">
          {['URL', 'Eventos', 'Status', 'Entregas', 'Criado em', 'Ações'].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87]">
              {h}
            </span>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#4da3ff]/30 border-t-[#4da3ff] rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && endpoints.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#102131] flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#4d6a87" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 11h4l3 8 4-16 3 8h4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#8ba8c7]">Sem endpoints configurados</p>
            <p className="text-xs text-[#4d6a87] mt-1">Clica em "Novo Endpoint" para começar</p>
          </div>
        )}

        {/* Rows */}
        {!loading &&
          endpoints.map((ep) => (
            <div
              key={ep.id}
              className="grid grid-cols-[2fr_3fr_90px_70px_130px_100px] gap-4 px-5 py-4 border-b border-[#1a2f48] last:border-b-0 hover:bg-[#07111f]/50 transition-colors items-start"
            >
              {/* URL */}
              <div>
                <p className="text-xs font-mono text-[#8ba8c7] truncate" title={ep.url}>
                  {truncate(ep.url, 40)}
                </p>
                {ep.description && (
                  <p className="text-[10px] text-[#4d6a87] mt-0.5 truncate">{ep.description}</p>
                )}
              </div>

              {/* Events */}
              <div className="flex flex-wrap gap-1">
                {ep.events.slice(0, 4).map((ev) => (
                  <EventBadge key={ev} event={ev} />
                ))}
                {ep.events.length > 4 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] text-[#4d6a87] bg-[#1a2f48]">
                    +{ep.events.length - 4}
                  </span>
                )}
              </div>

              {/* Status toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => handleToggle(ep)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                    ep.isActive
                      ? 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20'
                      : 'bg-[#4d6a87]/20 text-[#4d6a87] hover:bg-[#4d6a87]/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${ep.isActive ? 'bg-[#22c55e]' : 'bg-[#4d6a87]'}`} />
                  {ep.isActive ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              {/* Deliveries count */}
              <div className="flex items-center">
                <span className="text-xs text-[#8ba8c7] font-mono">{ep._count.deliveries}</span>
              </div>

              {/* Created */}
              <div className="flex items-center">
                <span className="text-xs text-[#4d6a87]">{formatDateTime(ep.createdAt)}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {/* View deliveries */}
                <button
                  type="button"
                  title="Ver histórico de entregas"
                  onClick={() => setSelectedEndpoint(ep)}
                  className="p-1.5 rounded-lg text-[#4d6a87] hover:text-[#4da3ff] hover:bg-[#4da3ff]/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                    <circle cx="7" cy="7" r="2" />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  title="Remover endpoint"
                  onClick={() => handleDelete(ep)}
                  className="p-1.5 rounded-lg text-[#4d6a87] hover:text-[#f87171] hover:bg-[#f87171]/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 6v4M8.5 6v4" />
                    <rect x="2.5" y="3.5" width="9" height="9" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => void loadEndpoints()}
        />
      )}

      {selectedEndpoint && (
        <DeliveriesDrawer
          endpoint={selectedEndpoint}
          onClose={() => setSelectedEndpoint(null)}
        />
      )}
    </div>
  );
}
