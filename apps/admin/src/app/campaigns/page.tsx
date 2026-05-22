'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, formatDate, API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
type CampaignType = 'onboarding_kit' | 'event_kit' | 'marketing_kit' | 'custom';
type FilterTab = 'all' | CampaignStatus;

interface CampaignItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
  product?: { id: string; title: string; imageUrl?: string };
}

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  company?: { id: string; name: string };
  companyId: string;
  items: CampaignItem[];
  _count?: { orders: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CampaignType, string> = {
  onboarding_kit: 'Onboarding',
  event_kit: 'Evento',
  marketing_kit: 'Marketing',
  custom: 'Custom',
};

const TYPE_COLORS: Record<CampaignType, string> = {
  onboarding_kit: 'bg-[#0d1f3a] text-[#4da3ff] border-[#1a3a5c]',
  event_kit: 'bg-[#1a0f3a] text-[#a78bfa] border-[#2a1f4a]',
  marketing_kit: 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
  custom: 'bg-[#2a1f00] text-[#fbbf24] border-[#3a2f00]',
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-[#1a2a3a] text-[#8ba8c7] border-[#2a3a4a]',
  active: 'bg-[#062515] text-[#63e6be] border-[#063e1f]',
  paused: 'bg-[#2a1f00] text-[#fbbf24] border-[#3a2f00]',
  completed: 'bg-[#0d1f3a] text-[#4da3ff] border-[#1a3a5c]',
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
};

// ── Create Campaign Modal ──────────────────────────────────────────────────────

interface CreateCampaignForm {
  name: string;
  type: CampaignType;
  companyId: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
}

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateCampaignForm>({
    name: '',
    type: 'custom',
    companyId: '',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof CreateCampaignForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.companyId.trim()) {
      setError('Nome e Company ID são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          companyId: form.companyId.trim(),
          description: form.description.trim() || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          budget: form.budget ? parseFloat(form.budget) : undefined,
          items: [],
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Erro ao criar campanha');
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-white">Nova Campanha</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6a87] hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-[#2a0a0a]/80 border border-[#f87171]/20 text-xs text-[#f87171]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
              Nome *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: Onboarding Kit Q3 2026"
              className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                Tipo *
              </label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value as CampaignType)}
                className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
              >
                {(Object.entries(TYPE_LABELS) as [CampaignType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                Budget (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={(e) => set('budget', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
              Company ID *
            </label>
            <input
              type="text"
              value={form.companyId}
              onChange={(e) => set('companyId', e.target.value)}
              placeholder="UUID da empresa"
              className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] font-mono focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descrição opcional..."
              rows={2}
              className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                Data Início
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8ba8c7] mb-1.5 uppercase tracking-wide">
                Data Fim
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#1a2f48] text-sm text-[#8ba8c7] hover:bg-[#102131] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'A criar...' : 'Criar Campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Campaign Items Modal ───────────────────────────────────────────────────────

function ItemsModal({
  campaign,
  onClose,
  onUpdated,
}: {
  campaign: Campaign;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [items, setItems] = useState<CampaignItem[]>(campaign.items);
  const [addForm, setAddForm] = useState({ productId: '', quantity: '1', unitPrice: '' });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.productId.trim()) return;
    setAdding(true);
    setError('');
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/campaigns/${campaign.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          productId: addForm.productId.trim(),
          quantity: parseInt(addForm.quantity, 10),
          unitPrice: addForm.unitPrice ? parseFloat(addForm.unitPrice) : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Erro ao adicionar item');
      }
      const newItem = (await res.json()) as CampaignItem;
      setItems((prev) => [...prev, newItem]);
      setAddForm({ productId: '', quantity: '1', unitPrice: '' });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/campaigns/${campaign.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      onUpdated();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0b1526] rounded-xl border border-[#1a2f48] p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white">Gerir Items</h3>
            <p className="text-xs text-[#4d6a87] mt-0.5 truncate max-w-[300px]">{campaign.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#4d6a87] hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Item list */}
        <div className="space-y-2 mb-5">
          {items.length === 0 ? (
            <p className="text-sm text-[#4d6a87] text-center py-6 border border-dashed border-[#1a2f48] rounded-lg">
              Sem items. Adiciona abaixo.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-[#102131] rounded-lg border border-[#1a2f48]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {item.product?.title ?? item.productId.slice(0, 12) + '...'}
                  </p>
                  <p className="text-xs text-[#4d6a87] mt-0.5">
                    Qty: {item.quantity}
                    {item.unitPrice != null ? ` · ${formatCurrency(item.unitPrice)}/un` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="text-[#4d6a87] hover:text-[#f87171] transition-colors disabled:opacity-40"
                >
                  {deletingId === item.id ? (
                    <span className="text-[10px]">...</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M4 3.5l.5 8h5l.5-8" />
                    </svg>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add item form */}
        <div className="border-t border-[#1a2f48] pt-4">
          <p className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wide mb-3">Adicionar Item</p>
          {error && (
            <p className="text-xs text-[#f87171] mb-3 px-3 py-2 bg-[#2a0a0a]/80 rounded-lg border border-[#f87171]/20">
              {error}
            </p>
          )}
          <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={addForm.productId}
              onChange={(e) => setAddForm((p) => ({ ...p, productId: e.target.value }))}
              placeholder="Product ID (UUID)"
              className="flex-1 min-w-[160px] px-3 py-2 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] font-mono focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              required
            />
            <input
              type="number"
              min="1"
              value={addForm.quantity}
              onChange={(e) => setAddForm((p) => ({ ...p, quantity: e.target.value }))}
              placeholder="Qty"
              className="w-20 px-3 py-2 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
              required
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={addForm.unitPrice}
              onChange={(e) => setAddForm((p) => ({ ...p, unitPrice: e.target.value }))}
              placeholder="Preço (€)"
              className="w-28 px-3 py-2 bg-[#102131] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 rounded-lg bg-[#4da3ff]/20 text-[#4da3ff] text-sm font-semibold border border-[#4da3ff]/30 hover:bg-[#4da3ff]/30 disabled:opacity-40 transition-colors"
            >
              {adding ? '...' : 'Adicionar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Card ──────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onToggleStatus,
  onManageItems,
  onViewOrders,
  toggling,
}: {
  campaign: Campaign;
  onToggleStatus: (id: string, currentStatus: CampaignStatus) => void;
  onManageItems: (campaign: Campaign) => void;
  onViewOrders: (id: string) => void;
  toggling: boolean;
}) {
  const budgetPct =
    campaign.budget && campaign.budget > 0
      ? Math.min(100, (campaign.totalSpent / campaign.budget) * 100)
      : null;

  const budgetWarning = budgetPct !== null && budgetPct >= 90;

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] flex flex-col overflow-hidden hover:border-[#2a4060] transition-colors">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_COLORS[campaign.type] ?? TYPE_COLORS.custom}`}
              >
                {TYPE_LABELS[campaign.type] ?? campaign.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[campaign.status] ?? STATUS_COLORS.draft}`}
              >
                {STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white truncate">{campaign.name}</h3>
            <p className="text-xs text-[#4d6a87] mt-0.5 truncate">
              {campaign.company?.name ?? campaign.companyId.slice(0, 12) + '...'}
            </p>
          </div>
        </div>

        {/* Dates */}
        {(campaign.startDate || campaign.endDate) && (
          <p className="text-[11px] text-[#4d6a87] mb-3">
            {campaign.startDate ? formatDate(campaign.startDate) : '—'}
            {' → '}
            {campaign.endDate ? formatDate(campaign.endDate) : '—'}
          </p>
        )}

        {/* Budget progress */}
        {campaign.budget != null && campaign.budget > 0 ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#4d6a87] font-medium">BUDGET</span>
              <span className={`text-[10px] font-semibold tabular-nums ${budgetWarning ? 'text-[#f87171]' : 'text-[#8ba8c7]'}`}>
                {formatCurrency(campaign.totalSpent)} / {formatCurrency(campaign.budget)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#102131] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budgetWarning ? 'bg-[#f87171]' : 'bg-[#4da3ff]'}`}
                style={{ width: `${budgetPct ?? 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <span className="text-[10px] text-[#4d6a87]">
              Gasto: <span className="text-[#8ba8c7] font-semibold">{formatCurrency(campaign.totalSpent)}</span>
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] text-[#4d6a87]">
          <span>
            <span className="text-white font-semibold">{campaign._count?.orders ?? campaign.totalOrders}</span> encomendas
          </span>
          <span>
            <span className="text-white font-semibold">{campaign.items.length}</span> items
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 mt-auto">
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => onManageItems(campaign)}
            className="flex-1 py-2 rounded-lg bg-[#102131] text-[#8ba8c7] text-xs font-semibold border border-[#1a2f48] hover:border-[#4da3ff]/30 hover:text-[#4da3ff] transition-all"
          >
            Gerir Items
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus(campaign.id, campaign.status)}
            disabled={toggling || campaign.status === 'completed'}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${
              campaign.status === 'active'
                ? 'bg-[#2a1f00]/60 text-[#fbbf24] border-[#fbbf24]/20 hover:bg-[#2a1f00]'
                : campaign.status === 'paused'
                ? 'bg-[#062515]/60 text-[#63e6be] border-[#63e6be]/20 hover:bg-[#062515]'
                : campaign.status === 'draft'
                ? 'bg-[#062515]/60 text-[#63e6be] border-[#63e6be]/20 hover:bg-[#062515]'
                : 'bg-[#102131] text-[#4d6a87] border-[#1a2f48] cursor-not-allowed'
            }`}
          >
            {campaign.status === 'active' ? 'Pausar' : campaign.status === 'paused' ? 'Ativar' : campaign.status === 'draft' ? 'Ativar' : 'Concluído'}
          </button>
          <button
            type="button"
            onClick={() => onViewOrders(campaign.id)}
            className="px-3 py-2 rounded-lg bg-[#102131] text-[#4d6a87] text-xs font-semibold border border-[#1a2f48] hover:border-[#4da3ff]/30 hover:text-[#4da3ff] transition-all"
            title="Ver encomendas"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1.5" y="2" width="10" height="9.5" rx="1.5" />
              <path d="M4 5h5M4 7.5h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [itemsModal, setItemsModal] = useState<Campaign | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/v1/campaigns`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as Campaign[];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: campaigns.length, draft: 0, active: 0, paused: 0, completed: 0 };
    campaigns.forEach((c2) => {
      const s = c2.status as CampaignStatus;
      if (s in c) c[s]++;
    });
    return c;
  }, [campaigns]);

  const filtered = useMemo(
    () => (tab === 'all' ? campaigns : campaigns.filter((c) => c.status === tab)),
    [campaigns, tab],
  );

  const totalBudget = useMemo(() => campaigns.reduce((s, c) => s + (c.budget ?? 0), 0), [campaigns]);
  const totalSpent = useMemo(() => campaigns.reduce((s, c) => s + c.totalSpent, 0), [campaigns]);
  const activeCount = useMemo(() => campaigns.filter((c) => c.status === 'active').length, [campaigns]);

  async function handleToggleStatus(id: string, currentStatus: CampaignStatus) {
    const nextStatus =
      currentStatus === 'active'
        ? 'paused'
        : currentStatus === 'paused'
        ? 'active'
        : currentStatus === 'draft'
        ? 'active'
        : null;
    if (!nextStatus) return;

    setToggling(id);
    try {
      const token = getAdminToken();
      await fetch(`${API_BASE}/api/v1/campaigns/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  }

  function handleViewOrders(campaignId: string) {
    window.open(`/orders?campaignId=${campaignId}`, '_blank');
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'draft', label: 'Rascunho' },
    { key: 'active', label: 'Ativas' },
    { key: 'paused', label: 'Pausadas' },
    { key: 'completed', label: 'Concluídas' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Campanhas</h1>
          <p className="text-sm text-[#4d6a87] mt-1">Gestão de campanhas de gifting corporativo</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Nova Campanha
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Campanhas', value: loading ? '—' : String(campaigns.length), sub: `${activeCount} ativas` },
          { label: 'Ativas', value: loading ? '—' : String(activeCount), sub: `${counts.paused} pausadas` },
          { label: 'Budget Gasto', value: loading ? '—' : formatCurrency(totalSpent), sub: totalBudget > 0 ? `de ${formatCurrency(totalBudget)}` : 'sem budget definido' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#1a2f48] bg-[#0b1526] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-white tabular-nums">{stat.value}</p>
            <p className="text-xs text-[#4d6a87] mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-[#0b1526] rounded-xl border border-[#1a2f48] mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-[#102131] text-white border border-[#1a2f48]'
                : 'text-[#4d6a87] hover:text-[#8ba8c7]'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${tab === t.key ? 'text-[#4da3ff]' : 'text-[#4d6a87]'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton rounded-xl h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1a2f48] py-20 text-center">
          <p className="text-3xl mb-3 text-[#4d6a87]">🚀</p>
          <p className="text-sm text-[#4d6a87]">Nenhuma campanha encontrada</p>
          {tab === 'all' && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-[#4da3ff]/10 text-[#4da3ff] text-sm font-semibold border border-[#4da3ff]/20 hover:bg-[#4da3ff]/20 transition-colors"
            >
              Criar primeira campanha
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onToggleStatus={handleToggleStatus}
              onManageItems={(c) => setItemsModal(c)}
              onViewOrders={handleViewOrders}
              toggling={toggling === campaign.id}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {itemsModal && (
        <ItemsModal
          campaign={itemsModal}
          onClose={() => setItemsModal(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
