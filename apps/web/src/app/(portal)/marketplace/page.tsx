'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  seller_name: string;
  title: string;
  category: string;
  product_type: string;
  unit_price: number | null;
  currency: string;
  min_quantity: number | null;
  lead_time_days: number | null;
  tags: string[];
  status: string;
  views_count: number;
  inquiries_count: number;
  created_at: string;
}

interface Inquiry {
  id: string;
  listing_id: string;
  buyer_email: string;
  message: string | null;
  quantity: number | null;
  target_price: number | null;
  status: string;
  ai_match_score: number | null;
  created_at: string;
}

interface ListingDetail extends Listing {
  description: string | null;
  samples_available: boolean;
  certifications: string[];
  images: string[];
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-white/10 text-white/40',
  draft:    'bg-amber-500/15 text-amber-400',
  open:     'bg-blue-500/15 text-blue-400',
  replied:  'bg-violet-500/15 text-violet-400',
  closed:   'bg-white/10 text-white/40',
  converted:'bg-emerald-500/15 text-emerald-400',
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <span className={`text-xs font-bold ${color}`}>AI {score}%</span>
  );
}

function fmt(price: number | null, currency = 'EUR') {
  if (price == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency, minimumFractionDigits: 2 }).format(price);
}

// ── Inquiry Modal ─────────────────────────────────────────────────────────────

function InquiryModal({
  listing,
  onClose,
  onSent,
}: {
  listing: ListingDetail;
  onClose: () => void;
  onSent: (score: number) => void;
}) {
  const [form, setForm] = useState({ buyer_email: '', message: '', quantity: '', target_price: '' });
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.buyer_email) { setError('Email obrigatório'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'inquire',
          listing_id: listing.id,
          buyer_email: form.buyer_email,
          message: form.message || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          target_price: form.target_price ? Number(form.target_price) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      setScore(d.ai_match_score);
      onSent(d.ai_match_score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-[#0e1015] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 className="text-white font-semibold text-sm">Enviar Inquérito</h3>
          <p className="text-white/40 text-xs mt-0.5 truncate">{listing.title} · {listing.seller_name}</p>
        </div>

        {score != null ? (
          <div className="text-center py-6 space-y-3">
            <div className={`text-5xl font-black ${score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {score}%
            </div>
            <p className="text-white/50 text-sm">Match Score AI</p>
            <p className="text-white/70 text-xs">
              {score >= 70 ? 'Excelente match — alta probabilidade de negócio' :
               score >= 40 ? 'Match moderado — pode requerer negociação' :
               'Match baixo — verificar alinhamento com fornecedor'}
            </p>
            <button type="button"
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-white/50 text-xs block mb-1">Email comprador *</label>
                <input
                  type="email" required
                  value={form.buyer_email}
                  onChange={e => setForm(f => ({ ...f, buyer_email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                  placeholder="buyer@empresa.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs block mb-1">Quantidade</label>
                  <input
                    type="number" min="1"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                    placeholder={listing.min_quantity ? `Mín. ${listing.min_quantity}` : 'Qtd'}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs block mb-1">Preço alvo (€)</label>
                  <input
                    type="number" step="0.01"
                    value={form.target_price}
                    onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs block mb-1">Mensagem</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 resize-none"
                  placeholder="Descreva as suas necessidades..."
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button"
                type="button" onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button type="button"
                type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {loading ? 'A calcular match…' : 'Enviar Inquérito'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Publish Modal ──────────────────────────────────────────────────────────────

function PublishModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [form, setForm] = useState({
    seller_name: '', title: '', description: '', category: '', product_type: '',
    min_quantity: '', unit_price: '', currency: 'EUR', lead_time_days: '', tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          seller_name: form.seller_name,
          title: form.title,
          description: form.description || null,
          category: form.category || null,
          product_type: form.product_type || null,
          min_quantity: form.min_quantity ? Number(form.min_quantity) : null,
          unit_price: form.unit_price ? Number(form.unit_price) : null,
          currency: form.currency,
          lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-xl bg-[#0e1015] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-sm">Publicar Listing</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-white/50 text-xs block mb-1">Fornecedor *</label>
              <input required value={form.seller_name} onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="Nome do fornecedor" />
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs block mb-1">Título *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="Nome do produto / serviço" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Categoria</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="ex: Brinde, Embalagem" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Tipo de produto</label>
              <input value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="ex: Caneta, Mug, Saco" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Preço unitário (€)</label>
              <input type="number" step="0.001" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="0.000" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Quantidade mínima</label>
              <input type="number" min="1" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="100" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Lead time (dias)</label>
              <input type="number" min="1" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="15" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Moeda</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs block mb-1">Tags (separadas por vírgula)</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20"
                placeholder="eco, personalizável, premium" />
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs block mb-1">Descrição</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 resize-none"
                placeholder="Descreva o produto ou serviço..." />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {loading ? 'A publicar…' : 'Publicar Listing'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'archived'>('active');
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(null);
  const [listingInquiries, setListingInquiries] = useState<Inquiry[]>([]);
  const [showPublish, setShowPublish] = useState(false);
  const [showInquiry, setShowInquiry] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const url = search.length >= 2
        ? `/api/marketplace?mode=search&q=${encodeURIComponent(search)}`
        : `/api/marketplace?mode=listings&status=${statusFilter}`;
      const res = await fetch(url);
      const d = await res.json();
      setListings(d.listings ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(loadListings, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadListings, search]);

  async function openListing(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/marketplace?mode=listing&id=${id}`);
      const d = await res.json();
      setSelectedListing(d.listing);
      setListingInquiries(d.inquiries ?? []);
    } finally {
      setDetailLoading(false);
    }
  }

  async function archiveListing(id: string) {
    await fetch('/api/marketplace', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id }),
    });
    setSelectedListing(null);
    loadListings();
  }

  async function closeInquiry(id: string, converted = false) {
    await fetch('/api/marketplace', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'close', id, converted }),
    });
    if (selectedListing) openListing(selectedListing.id);
  }

  const inquiryStats = {
    open: listingInquiries.filter(i => i.status === 'open').length,
    replied: listingInquiries.filter(i => i.status === 'replied').length,
    converted: listingInquiries.filter(i => i.status === 'converted').length,
  };

  return (
    <div className="p-6 space-y-5 min-h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-white text-base font-semibold">Marketplace B2B</h1>
          <p className="text-white/40 text-xs mt-0.5">Listings de fornecedores verificados · matching IA</p>
        </div>
        <div className="flex items-center gap-2">
          {(['active', 'all', 'archived'] as const).map(s => (
            <button type="button"
              key={s} type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >{s === 'active' ? 'Ativos' : s === 'all' ? 'Todos' : 'Arquivados'}</button>
          ))}
          <button type="button"
            type="button"
            onClick={() => setShowPublish(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span> Publicar Listing
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text" value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Pesquisar listings por nome, categoria, descrição…"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/25"
      />

      <div className="grid grid-cols-3 gap-5">
        {/* Listings grid */}
        <div className="col-span-2 space-y-3">
          {loading ? (
            <div className="text-white/30 text-xs text-center py-12">A carregar listings…</div>
          ) : listings.length === 0 ? (
            <div className="text-white/30 text-xs text-center py-12">
              {search ? 'Nenhum resultado encontrado' : 'Sem listings disponíveis'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {listings.map(listing => (
                <motion.button
                  key={listing.id}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => openListing(listing.id)}
                  className={`text-left rounded-2xl border p-4 space-y-3 transition-colors ${
                    selectedListing?.id === listing.id
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-white/5 bg-white/3 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                      {listing.category ?? 'Produto'}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[listing.status] ?? 'bg-white/10 text-white/40'}`}>
                      {listing.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-xs font-medium leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{listing.seller_name}</p>
                  </div>
                  {listing.tags && listing.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {listing.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-white text-sm font-semibold">{fmt(listing.unit_price, listing.currency)}</p>
                      {listing.min_quantity && (
                        <p className="text-white/30 text-[10px]">mín. {listing.min_quantity}u</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-[10px]">{listing.inquiries_count} inquéritos</p>
                      {listing.lead_time_days && (
                        <p className="text-white/30 text-[10px]">{listing.lead_time_days}d lead time</p>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {detailLoading ? (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-6 flex items-center justify-center h-48">
                <p className="text-white/30 text-xs">A carregar…</p>
              </motion.div>
            ) : selectedListing ? (
              <motion.div key={selectedListing.id}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-5">
                {/* Detail header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold leading-snug">{selectedListing.title}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{selectedListing.seller_name}</p>
                  </div>
                  <span className={`text-[10px] shrink-0 font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedListing.status] ?? 'bg-white/10 text-white/40'}`}>
                    {selectedListing.status}
                  </span>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-white/40 text-[10px]">Preço unitário</p>
                    <p className="text-white text-sm font-bold mt-0.5">{fmt(selectedListing.unit_price, selectedListing.currency)}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-white/40 text-[10px]">Qtd. mínima</p>
                    <p className="text-white text-sm font-bold mt-0.5">{selectedListing.min_quantity ?? '—'}u</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="space-y-1.5 text-xs">
                  {selectedListing.lead_time_days && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Lead time</span>
                      <span className="text-white/70">{selectedListing.lead_time_days} dias</span>
                    </div>
                  )}
                  {selectedListing.category && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Categoria</span>
                      <span className="text-white/70">{selectedListing.category}</span>
                    </div>
                  )}
                  {selectedListing.samples_available && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Amostras</span>
                      <span className="text-emerald-400 text-[10px]">Disponíveis</span>
                    </div>
                  )}
                </div>

                {selectedListing.description && (
                  <p className="text-white/50 text-xs leading-relaxed border-t border-white/5 pt-3">
                    {selectedListing.description}
                  </p>
                )}

                {/* Certifications */}
                {selectedListing.certifications && selectedListing.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedListing.certifications.map(c => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">{c}</span>
                    ))}
                  </div>
                )}

                {/* Inquiry stats */}
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Inquéritos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Abertos', val: inquiryStats.open, color: 'text-blue-400' },
                      { label: 'Respondidos', val: inquiryStats.replied, color: 'text-violet-400' },
                      { label: 'Convertidos', val: inquiryStats.converted, color: 'text-emerald-400' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-xl bg-white/5 p-2 text-center">
                        <p className={`text-base font-bold ${color}`}>{val}</p>
                        <p className="text-white/30 text-[9px]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inquiries list */}
                {listingInquiries.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {listingInquiries.map(inq => (
                      <div key={inq.id} className="rounded-xl bg-white/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60 text-[10px]">{inq.buyer_email}</span>
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={inq.ai_match_score} />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[inq.status] ?? 'bg-white/10 text-white/40'}`}>
                              {inq.status}
                            </span>
                          </div>
                        </div>
                        {inq.message && (
                          <p className="text-white/40 text-[10px] leading-snug line-clamp-2">{inq.message}</p>
                        )}
                        {inq.status === 'open' && (
                          <div className="flex gap-1.5 pt-0.5">
                            <button type="button"
                              onClick={() => closeInquiry(inq.id, true)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                              Convertido
                            </button>
                            <button type="button"
                              onClick={() => closeInquiry(inq.id, false)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 hover:bg-white/10 transition-colors">
                              Fechar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-white/5 pt-3">
                  <button type="button"
                    type="button"
                    onClick={() => setShowInquiry(true)}
                    className="flex-1 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Enviar Inquérito
                  </button>
                  {selectedListing.status === 'active' && (
                    <button type="button"
                      type="button"
                      onClick={() => archiveListing(selectedListing.id)}
                      className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/40 text-xs transition-colors"
                    >
                      Arquivar
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/5 bg-white/3 p-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-white/30 text-xs">Seleciona um listing para ver detalhes</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPublish && (
          <PublishModal
            onClose={() => setShowPublish(false)}
            onPublished={() => { setShowPublish(false); loadListings(); }}
          />
        )}
        {showInquiry && selectedListing && (
          <InquiryModal
            listing={selectedListing}
            onClose={() => setShowInquiry(false)}
            onSent={() => {
              setShowInquiry(false);
              openListing(selectedListing.id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
