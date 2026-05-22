'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, API_BASE, getAdminToken } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingRule {
  id: string;
  name: string;
  ruleType: string;
  targetId?: string;
  minQuantity: number;
  maxQuantity?: number;
  discountType: string;
  discountValue: number;
  marginMin?: number;
  clientTier?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface SimulateResult {
  unitPrice: number;
  unitCost: number;
  margin: number;
  marginPct: number;
  discountsApplied: Array<{ name: string; type: string; value: number }>;
  finalPricePerUnit: number;
  totalPrice: number;
  breakdown: {
    basePrice: number;
    volumeDiscount: number;
    tierDiscount: number;
    finalPrice: number;
  };
}

interface RuleFormData {
  name: string;
  ruleType: string;
  targetId: string;
  minQuantity: string;
  maxQuantity: string;
  discountType: string;
  discountValue: string;
  marginMin: string;
  clientTier: string;
  priority: string;
}

const EMPTY_FORM: RuleFormData = {
  name: '',
  ruleType: 'volume',
  targetId: '',
  minQuantity: '1',
  maxQuantity: '',
  discountType: 'percentage',
  discountValue: '',
  marginMin: '',
  clientTier: '',
  priority: '0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const RULE_TYPE_LABELS: Record<string, string> = {
  volume: 'Volume',
  tier: 'Tier',
  product: 'Produto',
  category: 'Categoria',
  supplier: 'Fornecedor',
  client: 'Cliente',
};

const RULE_TYPE_COLORS: Record<string, string> = {
  volume: 'text-[#4da3ff] bg-[#0d1f3a] border-[#4da3ff]/30',
  tier: 'text-[#a78bfa] bg-[#1a0d3a] border-[#a78bfa]/30',
  product: 'text-[#34d399] bg-[#0d2a1f] border-[#34d399]/30',
  category: 'text-[#fbbf24] bg-[#2a1a0d] border-[#fbbf24]/30',
  supplier: 'text-[#f87171] bg-[#2a0d0d] border-[#f87171]/30',
  client: 'text-[#74e7ff] bg-[#0d2a2a] border-[#74e7ff]/30',
};

const DISCOUNT_LABEL: Record<string, (v: number) => string> = {
  percentage: (v) => `${v}% off`,
  fixed: (v) => `${formatCurrency(v)} off`,
  multiplier: (v) => `×${v}`,
};

function apiFetch(path: string, options?: RequestInit) {
  const token = getAdminToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cls = RULE_TYPE_COLORS[type] ?? 'text-[#8ba8c7] bg-[#0b1526] border-[#1a2f48]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {RULE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return <span className="text-[#4d6a87]">—</span>;
  const colors: Record<string, string> = {
    standard: 'text-[#8ba8c7]',
    premium: 'text-[#fbbf24]',
    enterprise: 'text-[#a78bfa]',
  };
  return <span className={`text-xs font-medium ${colors[tier] ?? 'text-[#8ba8c7]'}`}>{tier}</span>;
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526]/60 p-4">
      <p className="text-xs font-semibold text-[#8ba8c7] uppercase tracking-wider mb-1">{title}</p>
      <p className="text-xs text-[#4d6a87] leading-relaxed">{description}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Simulator state
  const [simForm, setSimForm] = useState({
    basePrice: '',
    unitCost: '',
    quantity: '',
    clientTier: 'standard',
    productId: '',
    categoryName: '',
  });
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch('/api/v1/pricing/rules');
      const data = await res.json() as PricingRule[];
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ── Rule form ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRule(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      ruleType: rule.ruleType,
      targetId: rule.targetId ?? '',
      minQuantity: String(rule.minQuantity),
      maxQuantity: rule.maxQuantity ? String(rule.maxQuantity) : '',
      discountType: rule.discountType,
      discountValue: String(rule.discountValue),
      marginMin: rule.marginMin ? String(rule.marginMin) : '',
      clientTier: rule.clientTier ?? '',
      priority: String(rule.priority),
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { setFormError('Nome é obrigatório'); return; }
    if (!formData.discountValue || isNaN(Number(formData.discountValue))) {
      setFormError('Valor de desconto inválido');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: formData.name.trim(),
        ruleType: formData.ruleType,
        targetId: formData.targetId.trim() || undefined,
        minQuantity: parseInt(formData.minQuantity, 10) || 1,
        maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity, 10) : undefined,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        marginMin: formData.marginMin ? parseFloat(formData.marginMin) : undefined,
        clientTier: formData.clientTier || undefined,
        priority: parseInt(formData.priority, 10) || 0,
      };

      const res = editingRule
        ? await apiFetch(`/api/v1/pricing/rules/${editingRule.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch('/api/v1/pricing/rules', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error('Erro ao guardar regra');
      setShowModal(false);
      await loadRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: PricingRule) => {
    try {
      await apiFetch(`/api/v1/pricing/rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch {
      // silently fail — UI reflects DB state on next load
    }
  };

  const deleteRule = async (rule: PricingRule) => {
    if (!window.confirm(`Eliminar regra "${rule.name}"?`)) return;
    try {
      await apiFetch(`/api/v1/pricing/rules/${rule.id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      alert('Erro ao eliminar regra');
    }
  };

  // ── Simulator ───────────────────────────────────────────────────────────────

  const simulate = async () => {
    if (!simForm.basePrice || !simForm.unitCost || !simForm.quantity) {
      setSimError('Preenche Preço Base, Custo e Quantidade');
      return;
    }
    setSimLoading(true);
    setSimError('');
    setSimResult(null);
    try {
      const res = await apiFetch('/api/v1/pricing/simulate', {
        method: 'POST',
        body: JSON.stringify({
          productId: simForm.productId || 'sim-product',
          quantity: parseInt(simForm.quantity, 10),
          basePrice: parseFloat(simForm.basePrice),
          unitCost: parseFloat(simForm.unitCost),
          clientTier: simForm.clientTier || 'standard',
          categoryName: simForm.categoryName || undefined,
        }),
      });
      if (!res.ok) throw new Error('Erro na simulação');
      const result = await res.json() as SimulateResult;
      setSimResult(result);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSimLoading(false);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter((r) => r.isActive).length,
    byType: Object.entries(RULE_TYPE_LABELS).map(([key, label]) => ({
      key,
      label,
      count: rules.filter((r) => r.ruleType === key).length,
    })),
  }), [rules]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const needsTarget = ['product', 'category', 'supplier'].includes(formData.ruleType);
  const needsTier = formData.ruleType === 'tier';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Motor de Preços</h1>
          <p className="text-sm text-[#4d6a87] mt-1">
            {loading ? '—' : `${stats.active} regras ativas · ${stats.total} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-semibold hover:bg-[#74e7ff] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Nova Regra
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#f87171]/20 bg-[#2a0a0a]/50 p-4 flex items-center gap-3">
          <span className="text-[#f87171]">⚠</span>
          <p className="text-sm text-[#f87171]">Erro ao carregar regras de preço.</p>
          <button
            type="button"
            onClick={loadRules}
            className="ml-auto text-xs text-[#f87171] border border-[#f87171]/30 px-2 py-1 rounded hover:bg-[#f87171]/10 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Rule type explanations */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <InfoCard title="Volume" description="Desconto automático por quantidade encomendada (ex: 50+ unidades = 10% off)" />
        <InfoCard title="Tier" description="Preço diferenciado por nível de cliente: standard, premium ou enterprise" />
        <InfoCard title="Produto" description="Override de preço num produto específico, por ID" />
        <InfoCard title="Categoria" description="Desconto aplicado a toda uma categoria de produtos" />
        <InfoCard title="Fornecedor" description="Ajuste de margem aplicado a produtos de um fornecedor" />
        <InfoCard title="Cliente" description="Regra global aplicada a todos os clientes sem filtro adicional" />
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-6">
          {stats.byType.filter((t) => t.count > 0).map((t) => (
            <span
              key={t.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${RULE_TYPE_COLORS[t.key] ?? 'text-[#8ba8c7] border-[#1a2f48]'}`}
            >
              {t.label}
              <span className="tabular-nums opacity-70">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Rules table */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-[#1a2f48] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a2f48] bg-[#07111f]">
                  {['Nome', 'Tipo', 'Alvo', 'Qtd', 'Desconto', 'Tier', 'Prior.', 'Ativo', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#4d6a87] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[#4d6a87] text-sm">
                      A carregar regras...
                    </td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[#4d6a87] text-sm">
                      Nenhuma regra criada ainda. Clica em &ldquo;Nova Regra&rdquo; para começar.
                    </td>
                  </tr>
                )}
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={`border-b border-[#1a2f48]/60 hover:bg-[#102131]/40 transition-colors ${!rule.isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-white font-medium text-sm">{rule.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={rule.ruleType} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#8ba8c7] font-mono">{rule.targetId ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-[#8ba8c7]">
                      {rule.minQuantity}
                      {rule.maxQuantity ? `–${rule.maxQuantity}` : '+'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-white">
                        {(DISCOUNT_LABEL[rule.discountType] ?? ((v: number) => String(v)))(rule.discountValue)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={rule.clientTier ?? undefined} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-[#8ba8c7]">
                      {rule.priority}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(rule)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.isActive ? 'bg-[#4da3ff]' : 'bg-[#1a2f48]'}`}
                        aria-label={rule.isActive ? 'Desativar' : 'Ativar'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${rule.isActive ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(rule)}
                          className="text-[#4d6a87] hover:text-[#4da3ff] transition-colors text-xs font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule)}
                          className="text-[#4d6a87] hover:text-[#f87171] transition-colors"
                          aria-label="Eliminar"
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 3h9M5 3V2h3v1M4 3l.5 7h4L9 3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price Simulator */}
        <div className="w-80 shrink-0">
          <div className="rounded-xl border border-[#1a2f48] bg-[#07111f] p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1" y="1" width="12" height="12" rx="2" />
                <path d="M4 7h6M4 4.5h3M4 9.5h4" />
              </svg>
              Simulador de Preço
            </h2>

            <div className="space-y-3">
              {[
                { key: 'basePrice', label: 'Preço Base (€)', placeholder: '10.00' },
                { key: 'unitCost', label: 'Custo Unitário (€)', placeholder: '5.00' },
                { key: 'quantity', label: 'Quantidade', placeholder: '100' },
                { key: 'productId', label: 'Product ID (opcional)', placeholder: 'uuid...' },
                { key: 'categoryName', label: 'Categoria (opcional)', placeholder: 'bags' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-[#4d6a87] mb-1">{label}</label>
                  <input
                    type="text"
                    value={simForm[key as keyof typeof simForm]}
                    onChange={(e) => setSimForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs text-[#4d6a87] mb-1">Tier do Cliente</label>
                <select
                  value={simForm.clientTier}
                  onChange={(e) => setSimForm((p) => ({ ...p, clientTier: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            {simError && (
              <p className="mt-3 text-xs text-[#f87171]">{simError}</p>
            )}

            <button
              type="button"
              onClick={simulate}
              disabled={simLoading}
              className="mt-4 w-full py-2.5 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {simLoading ? 'A calcular...' : 'Simular'}
            </button>

            {simResult && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#4d6a87]">Preço base</span>
                    <span className="text-white tabular-nums">{formatCurrency(simResult.breakdown.basePrice)}</span>
                  </div>
                  {simResult.breakdown.volumeDiscount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4d6a87]">Desconto volume</span>
                      <span className="text-[#34d399] tabular-nums">-{formatCurrency(simResult.breakdown.volumeDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-[#1a2f48] pt-2">
                    <span className="text-[#8ba8c7] font-semibold">Preço unitário</span>
                    <span className="text-white font-bold tabular-nums">{formatCurrency(simResult.finalPricePerUnit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-3 text-center">
                    <p className="text-xs text-[#4d6a87] mb-1">Margem</p>
                    <p className={`text-sm font-bold tabular-nums ${simResult.marginPct >= 20 ? 'text-[#34d399]' : simResult.marginPct >= 15 ? 'text-[#fbbf24]' : 'text-[#f87171]'}`}>
                      {simResult.marginPct}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-3 text-center">
                    <p className="text-xs text-[#4d6a87] mb-1">Total</p>
                    <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(simResult.totalPrice)}</p>
                  </div>
                </div>

                {simResult.discountsApplied.length > 0 && (
                  <div className="rounded-lg border border-[#1a2f48] bg-[#0b1526] p-3">
                    <p className="text-xs text-[#4d6a87] mb-2">Descontos aplicados</p>
                    {simResult.discountsApplied.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs mb-1 last:mb-0">
                        <span className="text-[#8ba8c7]">{d.name}</span>
                        <span className="text-[#34d399] tabular-nums">-{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#1a2f48] bg-[#07111f] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2f48]">
              <h2 id="modal-title" className="text-base font-bold text-white">
                {editingRule ? 'Editar Regra' : 'Nova Regra de Preço'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#4d6a87] hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-xs text-[#4d6a87] mb-1">Nome da Regra *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="ex: Volume 50+ unidades"
                  className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              {/* Rule type + Discount type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Tipo de Regra</label>
                  <select
                    value={formData.ruleType}
                    onChange={(e) => setFormData((p) => ({ ...p, ruleType: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  >
                    {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Tipo de Desconto</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData((p) => ({ ...p, discountType: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  >
                    <option value="percentage">Percentagem (%)</option>
                    <option value="fixed">Valor fixo (€)</option>
                    <option value="multiplier">Multiplicador</option>
                  </select>
                </div>
              </div>

              {/* Discount value */}
              <div>
                <label className="block text-xs text-[#4d6a87] mb-1">
                  Valor do Desconto *
                  <span className="ml-1 text-[#4d6a87]/60">
                    {formData.discountType === 'percentage' ? '(%)' : formData.discountType === 'fixed' ? '(€)' : '(ex: 0.85 = 15% off)'}
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData((p) => ({ ...p, discountValue: e.target.value }))}
                  placeholder={formData.discountType === 'percentage' ? '10' : formData.discountType === 'fixed' ? '5.00' : '0.85'}
                  className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                />
              </div>

              {/* Quantity range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Qtd Mínima</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData((p) => ({ ...p, minQuantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Qtd Máxima (opcional)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxQuantity}
                    onChange={(e) => setFormData((p) => ({ ...p, maxQuantity: e.target.value }))}
                    placeholder="sem limite"
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Conditional fields */}
              {needsTarget && (
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">
                    {formData.ruleType === 'product' ? 'Product ID' : formData.ruleType === 'category' ? 'Nome da Categoria' : 'Fornecedor'}
                  </label>
                  <input
                    type="text"
                    value={formData.targetId}
                    onChange={(e) => setFormData((p) => ({ ...p, targetId: e.target.value }))}
                    placeholder={formData.ruleType === 'product' ? 'uuid do produto' : formData.ruleType === 'category' ? 'ex: bags' : 'ex: midocean'}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              )}

              {(needsTier || formData.ruleType === 'volume') && (
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Tier do Cliente (opcional)</label>
                  <select
                    value={formData.clientTier}
                    onChange={(e) => setFormData((p) => ({ ...p, clientTier: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-[#8ba8c7] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  >
                    <option value="">Todos os tiers</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              )}

              {/* Priority + Margin min */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Prioridade</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                  <p className="text-xs text-[#4d6a87]/60 mt-1">Maior = aplicado primeiro</p>
                </div>
                <div>
                  <label className="block text-xs text-[#4d6a87] mb-1">Margem Mínima (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.marginMin}
                    onChange={(e) => setFormData((p) => ({ ...p, marginMin: e.target.value }))}
                    placeholder="15"
                    className="w-full px-3 py-2 bg-[#0b1526] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="mx-6 mb-2 text-xs text-[#f87171]">{formError}</div>
            )}

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1a2f48]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'A guardar...' : editingRule ? 'Guardar Alterações' : 'Criar Regra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
