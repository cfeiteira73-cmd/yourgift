'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency, API_BASE, getAdminToken } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopProduct {
  productId: string;
  title: string;
  count: number;
}

interface BusinessInsights {
  totalRevenue: number;
  orderCount: number;
  topProducts: TopProduct[];
  growthRate: number;
  insights: string[];
}

interface Recommendation {
  productId: string;
  reason: string;
  confidence: number;
}

interface CampaignItem {
  productType: string;
  quantity: number;
  estimatedCost: number;
}

interface CampaignResult {
  campaignName: string;
  description: string;
  suggestedItems: CampaignItem[];
  totalEstimate: number;
}

interface SupplierScore {
  supplier: string;
  score: number;
  reliability: number;
  avgDelivery: number;
  issueRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171';
  return (
    <span
      className="inline-flex items-center justify-center w-12 h-7 rounded-full text-xs font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {score}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8" strokeLinecap="round" />
    </svg>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1a2f48] bg-[#0b1526] p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="text-[#4da3ff]">{icon}</span>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Section 1: Business Intelligence ────────────────────────────────────────

function BusinessIntelligenceSection() {
  const [data, setData] = useState<BusinessInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/insights`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard
      title="Business Intelligence"
      icon={
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="9" cy="7" r="4.5" />
          <path d="M6.5 7h.01M9 5.5v.01M11.5 7h.01M9 8.5c.83 0 1.5-.67 1.5-1.5" />
          <path d="M6 13c-.3.6-.5 1.3-.5 2h7c0-.7-.2-1.4-.5-2" />
        </svg>
      }
    >
      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-[#1a2f48] bg-[#07111f] p-4">
            <p className="text-xs text-[#4d6a87] mb-1 uppercase tracking-widest">Receita 30d</p>
            <p className="text-xl font-black text-white tabular-nums">{formatCurrency(data.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-[#1a2f48] bg-[#07111f] p-4">
            <p className="text-xs text-[#4d6a87] mb-1 uppercase tracking-widest">Encomendas</p>
            <p className="text-xl font-black text-white tabular-nums">{data.orderCount}</p>
          </div>
          <div className="rounded-xl border border-[#1a2f48] bg-[#07111f] p-4">
            <p className="text-xs text-[#4d6a87] mb-1 uppercase tracking-widest">Crescimento</p>
            <p
              className="text-xl font-black tabular-nums"
              style={{ color: data.growthRate >= 0 ? '#4ade80' : '#f87171' }}
            >
              {data.growthRate >= 0 ? '+' : ''}{data.growthRate.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Insights */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-[#4d6a87]">
          <Spinner />
          <span className="ml-2 text-sm">A gerar insights com IA...</span>
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-[#f87171] py-4">Erro ao carregar insights.</p>
      )}
      {data && !loading && (
        <div className="space-y-3">
          {data.insights.map((insight, i) => (
            <div
              key={i}
              className="flex gap-3 items-start rounded-xl border border-[#1a2f48] bg-[#07111f] px-4 py-3"
            >
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#4da3ff]/10 border border-[#4da3ff]/30 flex items-center justify-center text-[#4da3ff] text-[10px] font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-[#f0f6ff] leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all disabled:opacity-50"
        >
          {loading ? <Spinner /> : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
            </svg>
          )}
          Atualizar
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Section 2: Campaign Generator ───────────────────────────────────────────

function CampaignGeneratorSection() {
  const [form, setForm] = useState({
    companyName: '',
    occasion: 'onboarding',
    budget: '',
    employeeCount: '',
    preferences: '',
  });
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/campaign-generator`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          companyName: form.companyName,
          occasion: form.occasion,
          budget: Number(form.budget),
          employeeCount: Number(form.employeeCount),
          preferences: form.preferences,
        }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors';

  return (
    <SectionCard
      title="Gerador de Campanhas"
      icon={
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9 1l2 5h5l-4 3 1.5 5.5L9 11.5 4.5 14.5 6 9 2 6h5z" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8ba8c7] mb-1.5 font-medium">Nome da Empresa</label>
            <input
              type="text"
              required
              placeholder="ex: Acme Lda"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8ba8c7] mb-1.5 font-medium">Ocasião</label>
            <select
              value={form.occasion}
              onChange={(e) => setForm((f) => ({ ...f, occasion: e.target.value }))}
              className={inputCls + ' appearance-none cursor-pointer'}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%234d6a87' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              <option value="onboarding">Onboarding</option>
              <option value="event">Evento</option>
              <option value="holiday">Época festiva</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8ba8c7] mb-1.5 font-medium">Orçamento (€)</label>
            <input
              type="number"
              required
              min="1"
              placeholder="ex: 2500"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8ba8c7] mb-1.5 font-medium">N.º de Colaboradores</label>
            <input
              type="number"
              required
              min="1"
              placeholder="ex: 50"
              value={form.employeeCount}
              onChange={(e) => setForm((f) => ({ ...f, employeeCount: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#8ba8c7] mb-1.5 font-medium">Preferências / Notas</label>
          <textarea
            rows={2}
            placeholder="ex: produtos eco-friendly, cores da marca, sem plástico..."
            value={form.preferences}
            onChange={(e) => setForm((f) => ({ ...f, preferences: e.target.value }))}
            className={inputCls + ' resize-none'}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-colors disabled:opacity-50"
        >
          {loading ? <Spinner /> : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 1l1.8 4.5H13l-3.6 2.6 1.4 4.4L7 10 3.2 12.5l1.4-4.4L1 5.5h4.2z" />
            </svg>
          )}
          Gerar Campanha com IA
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-[#f87171]">Erro ao gerar campanha. Tente novamente.</p>}

      {result && (
        <div className="mt-6 rounded-xl border border-[#4da3ff]/20 bg-[#0d1f3a] p-5">
          <p className="text-xs text-[#4da3ff] uppercase tracking-widest font-semibold mb-1">Campanha Gerada</p>
          <h3 className="text-lg font-black text-white mb-2">{result.campaignName}</h3>
          <p className="text-sm text-[#8ba8c7] mb-5 leading-relaxed">{result.description}</p>

          <div className="space-y-2 mb-4">
            {result.suggestedItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#07111f] border border-[#1a2f48]">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#4da3ff]/10 border border-[#4da3ff]/30 text-[#4da3ff] text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white font-medium">{item.productType}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#8ba8c7] tabular-nums">
                  <span>×{item.quantity}</span>
                  <span className="text-white font-semibold">{formatCurrency(item.estimatedCost)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#1a2f48]">
            <span className="text-sm text-[#8ba8c7] font-medium">Total Estimado</span>
            <span className="text-lg font-black text-[#4da3ff] tabular-nums">{formatCurrency(result.totalEstimate)}</span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 3: Supplier Intelligence ────────────────────────────────────────

function SupplierIntelligenceSection() {
  const [data, setData] = useState<SupplierScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/supplier-scores`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard
      title="Inteligência de Fornecedores"
      icon={
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="9" width="4" height="7" rx="1" />
          <rect x="7" y="5" width="4" height="11" rx="1" />
          <rect x="12" y="2" width="4" height="14" rx="1" />
        </svg>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-12 text-[#4d6a87]">
          <Spinner />
          <span className="ml-2 text-sm">A calcular scores...</span>
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-[#f87171] py-4">Erro ao carregar scores.</p>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-[#4d6a87] py-4">Sem dados de fornecedores disponíveis.</p>
      )}
      {!loading && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2f48]">
                <th className="text-left text-xs text-[#4d6a87] font-semibold uppercase tracking-widest pb-3">Fornecedor</th>
                <th className="text-center text-xs text-[#4d6a87] font-semibold uppercase tracking-widest pb-3">Score</th>
                <th className="text-right text-xs text-[#4d6a87] font-semibold uppercase tracking-widest pb-3">Fiabilidade</th>
                <th className="text-right text-xs text-[#4d6a87] font-semibold uppercase tracking-widest pb-3">Entrega Média</th>
                <th className="text-right text-xs text-[#4d6a87] font-semibold uppercase tracking-widest pb-3">Taxa Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2f48]">
              {data
                .sort((a, b) => b.score - a.score)
                .map((row) => (
                  <tr key={row.supplier} className="hover:bg-[#07111f] transition-colors">
                    <td className="py-3 text-white font-semibold capitalize">{row.supplier}</td>
                    <td className="py-3 text-center">
                      <ScoreBadge score={row.score} />
                    </td>
                    <td className="py-3 text-right text-[#8ba8c7] tabular-nums">{row.reliability.toFixed(1)}%</td>
                    <td className="py-3 text-right text-[#8ba8c7] tabular-nums">
                      {row.avgDelivery > 0 ? `${row.avgDelivery}d` : '—'}
                    </td>
                    <td className="py-3 text-right tabular-nums" style={{ color: row.issueRate > 10 ? '#f87171' : '#4ade80' }}>
                      {row.issueRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a2f48] text-[#8ba8c7] text-sm hover:bg-[#102131] hover:text-white transition-all disabled:opacity-50"
        >
          {loading ? <Spinner /> : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 7A5 5 0 1 1 7 2c1.5 0 2.9.6 3.9 1.6L13 1v4H9" />
            </svg>
          )}
          Atualizar Scores
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Section 4: Product Recommendations ──────────────────────────────────────

function RecommendationsSection() {
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim()) return;
    setLoading(true);
    setError(false);
    setFetched(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/ai/recommendations/${encodeURIComponent(clientId.trim())}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error();
      const json = await res.json() as { recommendations: Recommendation[] };
      setData(json.recommendations ?? []);
      setFetched(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard
      title="Recomendações de Produtos"
      icon={
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 2h2l1.5 7h7l1.5-5H5" />
          <circle cx="7.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="M14 6l2 2-2 2" />
          <path d="M16 8h-4" />
        </svg>
      }
    >
      <form onSubmit={load} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="ID do cliente..."
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#07111f] border border-[#1a2f48] rounded-lg text-sm text-white placeholder-[#4d6a87] focus:outline-none focus:border-[#4da3ff]/50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !clientId.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#07111f] text-sm font-bold hover:bg-[#74e7ff] transition-colors disabled:opacity-50"
        >
          {loading ? <Spinner /> : 'Recomendar'}
        </button>
      </form>

      {error && <p className="text-sm text-[#f87171]">Erro ao carregar recomendações.</p>}

      {fetched && !loading && data.length === 0 && (
        <p className="text-sm text-[#4d6a87]">Sem recomendações disponíveis para este cliente.</p>
      )}

      {fetched && !loading && data.length > 0 && (
        <div className="space-y-3">
          {data.map((rec, i) => (
            <div key={i} className="rounded-xl border border-[#1a2f48] bg-[#07111f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#4d6a87] font-mono mb-1 truncate">{rec.productId}</p>
                  <p className="text-sm text-[#8ba8c7]">{rec.reason}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] text-[#4d6a87] uppercase tracking-widest mb-1">Confiança</p>
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{ color: rec.confidence >= 0.7 ? '#4ade80' : rec.confidence >= 0.5 ? '#facc15' : '#f87171' }}
                  >
                    {Math.round(rec.confidence * 100)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4da3ff] to-[#a78bfa] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 1l1.6 4H14l-3.2 2.3L12 12 8 9.5 4 12l1.2-4.7L2 5h4.4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">AI Control Center</h1>
          </div>
          <p className="text-sm text-[#4d6a87]">
            Insights automáticos, geração de campanhas e inteligência de fornecedores via IA
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#4da3ff]/30 bg-[#4da3ff]/5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4da3ff] animate-pulse" />
          <span className="text-xs text-[#4da3ff] font-semibold">Claude claude-haiku-4-5 Activo</span>
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BusinessIntelligenceSection />
        <CampaignGeneratorSection />
        <SupplierIntelligenceSection />
        <RecommendationsSection />
      </div>
    </div>
  );
}
