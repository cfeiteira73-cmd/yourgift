'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';

// ── types ─────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: string;
  title: string;
  images: string[];
  base_price?: number;
  supplier_ref?: string;
  category?: string;
}

interface SelectedItem {
  product: CatalogProduct;
  quantity: number;
  technique: string;
}

// ── constants ──────────────────────────────────────────────────────────────

const TECHNIQUES = [
  { id: 'embroidery', label: 'Bordado' },
  { id: 'dtf',        label: 'DTF — Full Color' },
  { id: 'laser',      label: 'Laser' },
  { id: 'pad',        label: 'Pad Printing' },
  { id: 'screen',     label: 'Serigrafia' },
];

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'application/pdf', 'application/postscript'];
const ACCEPTED_EXT = '.png,.jpg,.jpeg,.pdf,.ai,.eps';
const MAX_FILE_MB = 50;

// ── helpers ────────────────────────────────────────────────────────────────

function estimateRange(items: SelectedItem[]): [number, number] {
  if (items.length === 0) return [0, 0];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const low = totalQty * 2.5 * 1.35 * 1.23;
  const high = totalQty * 6.0 * 1.35 * 1.23;
  return [Math.round(low * 100) / 100, Math.round(high * 100) / 100];
}

// ── step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ['Produtos', 'Detalhes', 'Confirmação'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem' }}>
      {steps.map((label, idx) => {
        const n = idx + 1;
        const isCompleted = n < current;
        const isCurrent = n === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  transition: 'all 200ms ease',
                  ...(isCompleted
                    ? { background: 'rgb(99,230,190)', color: 'rgb(7,17,31)' }
                    : isCurrent
                    ? { background: 'rgb(77,163,255)', color: 'rgb(7,17,31)', boxShadow: '0 0 0 4px rgba(77,163,255,0.2)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'rgb(120,130,150)', border: '1px solid rgba(255,255,255,0.08)' }),
                }}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : n}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'rgb(77,163,255)' : isCompleted ? 'rgb(99,230,190)' : 'rgb(120,130,150)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', margin: '0 0.75rem', marginTop: '-1rem', background: isCompleted ? 'rgb(99,230,190)' : 'rgba(255,255,255,0.06)', transition: 'background 300ms ease' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 state
  const [eventDate, setEventDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [artworkFiles, setArtworkFiles] = useState<{ name: string; url: string }[]>([]);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Step 3 state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── product search ─────────────────────────────────────────────────────

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        setSearching(true);
        const supabase = createClient();
        const { data } = await supabase
          .from('products')
          .select('id, title, images, base_price, supplier_ref, category')
          .ilike('title', `%${query}%`)
          .limit(12);
        setSearchResults((data as CatalogProduct[]) ?? []);
        setSearching(false);
      }, 300);
    },
    []
  );

  function addProduct(product: CatalogProduct) {
    if (selectedItems.some((i) => i.product.id === product.id)) return;
    setSelectedItems((prev) => [...prev, { product, quantity: 50, technique: 'dtf' }]);
  }

  function removeProduct(productId: string) {
    setSelectedItems((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function updateItem(productId: string, patch: Partial<Omit<SelectedItem, 'product'>>) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, ...patch } : i))
    );
  }

  // ── artwork upload ─────────────────────────────────────────────────────

  async function handleArtworkUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setArtworkUploading(true);
    setError('');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login?next=/quotes/new');
      return;
    }

    const uploaded: { name: string; url: string }[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Ficheiro ${file.name} excede ${MAX_FILE_MB}MB.`);
        continue;
      }
      const path = `artwork/${user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadErr, data } = await supabase.storage
        .from('artwork')
        .upload(path, file, { upsert: false });
      if (uploadErr) {
        setError(`Erro ao carregar ${file.name}: ${uploadErr.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from('artwork').getPublicUrl(data.path);
      uploaded.push({ name: file.name, url: urlData.publicUrl });
    }

    setArtworkFiles((prev) => [...prev, ...uploaded]);
    setArtworkUploading(false);
  }

  // ── submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!termsAccepted) return;
    setSubmitting(true);
    setError('');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login?next=/quotes/new');
      return;
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!client) {
      setError('Conta de cliente não encontrada. Contacta o suporte.');
      setSubmitting(false);
      return;
    }

    const ref = `YGQ-${Date.now().toString(36).toUpperCase()}`;

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        ref,
        client_id: (client as { id: string }).id,
        status: 'submitted',
        event_date: eventDate || null,
        delivery_date: deliveryDate || null,
        notes: notes || null,
        artwork_urls: artworkFiles.map((a) => a.url),
        items: selectedItems.map((i) => ({
          product_id: i.product.id,
          product_title: i.product.title,
          quantity: i.quantity,
          technique: i.technique,
        })),
      })
      .select('id, ref')
      .single();

    if (quoteError || !quote) {
      setError('Erro ao submeter orçamento: ' + (quoteError?.message ?? 'desconhecido'));
      setSubmitting(false);
      return;
    }

    router.push(`/quotes/${(quote as { id: string }).id}`);
  }

  const [low, high] = estimateRange(selectedItems);

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <PortalLayout>
      <div style={{ padding: '2rem 2rem 3rem', maxWidth: '860px' }}>

        <div style={{ marginBottom: '1.75rem' }}>
          <Link
            href="/dashboard"
            style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Dashboard
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em' }}>
            Pedir Orçamento
          </h1>
        </div>

        <StepIndicator current={step} />

        {/* ── STEP 1 — Produtos ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '1.25rem' }}>
              Seleciona os produtos
            </h2>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,130,150)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input
                type="text"
                placeholder="Pesquisar produto (ex: caneta, mochila, t-shirt...)"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  fontSize: '0.875rem',
                  color: 'rgb(245,247,251)',
                  outline: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              {searching && (
                <div style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(77,163,255,0.3)', borderTopColor: 'rgb(77,163,255)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.5rem',
                }}
              >
                {searchResults.map((product) => {
                  const already = selectedItems.some((i) => i.product.id === product.id);
                  const thumb = product.images?.[0];
                  return (
                    <div
                      key={product.id}
                      className="yg-card"
                      style={{
                        padding: '0.875rem',
                        opacity: already ? 0.5 : 1,
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.05)',
                          marginBottom: '0.625rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={product.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '2rem' }}>🎁</span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(245,247,251)', marginBottom: '0.25rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.title}
                      </p>
                      {product.base_price != null && product.base_price > 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'rgb(99,230,190)', marginBottom: '0.5rem' }}>
                          A partir de {formatPrice(product.base_price)}
                        </p>
                      )}
                      <button type="button"
                        type="button"
                        onClick={() => addProduct(product)}
                        disabled={already}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          borderRadius: '7px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: already ? 'not-allowed' : 'pointer',
                          background: already ? 'rgba(99,230,190,0.1)' : 'rgba(77,163,255,0.15)',
                          color: already ? 'rgb(99,230,190)' : 'rgb(77,163,255)',
                          border: already ? '1px solid rgba(99,230,190,0.2)' : '1px solid rgba(77,163,255,0.2)',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {already ? '✓ Adicionado' : 'Adicionar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected items */}
            {selectedItems.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.75rem' }}>
                  Produtos selecionados ({selectedItems.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {selectedItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="yg-card"
                      style={{ padding: '0.875rem', display: 'flex', gap: '0.875rem', alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.product.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.product.images[0]} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '1.1rem' }}>🎁</span>
                        )}
                      </div>
                      <p style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'rgb(245,247,251)', minWidth: '120px' }}>
                        {item.product.title}
                      </p>
                      {/* Quantity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <button type="button"
                          type="button"
                          onClick={() => updateItem(item.product.id, { quantity: Math.max(1, item.quantity - 10) })}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(170,180,198)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.product.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          style={{ width: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.3rem', fontSize: '0.875rem', color: 'rgb(245,247,251)', outline: 'none' }}
                        />
                        <button type="button"
                          type="button"
                          onClick={() => updateItem(item.product.id, { quantity: item.quantity + 10 })}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(170,180,198)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          +
                        </button>
                      </div>
                      {/* Technique */}
                      <select
                        value={item.technique}
                        onChange={(e) => updateItem(item.product.id, { technique: e.target.value })}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'rgb(170,180,198)', outline: 'none', cursor: 'pointer' }}
                      >
                        {TECHNIQUES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                      {/* Remove */}
                      <button type="button"
                        type="button"
                        onClick={() => removeProduct(item.product.id)}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItems.length === 0 && !searchQuery && (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgb(120,130,150)', fontSize: '0.875rem' }}>
                Pesquisa um produto para começar
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button"
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedItems.length === 0}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                  background: selectedItems.length === 0 ? 'rgba(77,163,255,0.3)' : 'rgb(77,163,255)',
                  color: 'rgb(7,17,31)',
                  border: 'none',
                  opacity: selectedItems.length === 0 ? 0.5 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 — Detalhes ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '1.5rem' }}>
              Detalhes do pedido
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
                    Data do evento
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.875rem', color: 'rgb(245,247,251)', outline: 'none', colorScheme: 'dark' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
                    Data de entrega pretendida
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.875rem', color: 'rgb(245,247,251)', outline: 'none', colorScheme: 'dark' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
                  Notas adicionais
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações relevantes: cores da empresa, tamanhos, prazo urgente, etc."
                  rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem 0.875rem', fontSize: '0.875rem', color: 'rgb(245,247,251)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>

              {/* Artwork upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '0.5rem' }}>
                  Arte / Ficheiros
                </label>

                {/* Drop zone */}
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleArtworkUpload(e.dataTransfer.files); }}
                  style={{
                    display: 'block',
                    border: `2px dashed ${dragOver ? 'rgb(77,163,255)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 150ms ease',
                  }}
                >
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_EXT}
                    onChange={(e) => handleArtworkUpload(e.target.files)}
                    style={{ display: 'none' }}
                    disabled={artworkUploading}
                  />
                  {artworkUploading ? (
                    <>
                      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(77,163,255,0.3)', borderTopColor: 'rgb(77,163,255)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 0.625rem' }} />
                      <p style={{ fontSize: '0.875rem', color: 'rgb(77,163,255)' }}>A carregar...</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨</div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(170,180,198)', marginBottom: '0.25rem' }}>
                        Arrasta ou clica para carregar artes
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>
                        PNG, JPG, PDF, AI, EPS — máx. {MAX_FILE_MB}MB por ficheiro
                      </p>
                    </>
                  )}
                </label>

                {/* Uploaded files list */}
                {artworkFiles.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {artworkFiles.map((file, idx) => (
                      <div
                        key={idx}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(99,230,190,0.06)', border: '1px solid rgba(99,230,190,0.15)', borderRadius: '8px' }}
                      >
                        <svg style={{ color: 'rgb(99,230,190)', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                        <span style={{ flex: 1, fontSize: '0.8rem', color: 'rgb(99,230,190)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <button type="button"
                          type="button"
                          onClick={() => setArtworkFiles((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(120,130,150)', padding: '0' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: 'rgb(239,68,68)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button"
                type="button"
                onClick={() => setStep(1)}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(170,180,198)' }}
              >
                ← Anterior
              </button>
              <button type="button"
                type="button"
                onClick={() => { setError(''); setStep(3); }}
                style={{ padding: '0.625rem 1.5rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', background: 'rgb(77,163,255)', color: 'rgb(7,17,31)', border: 'none' }}
              >
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Confirmação ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(245,247,251)', marginBottom: '1.5rem' }}>
              Confirmação
            </h2>

            {/* Summary */}
            <div className="yg-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(120,130,150)', marginBottom: '1rem' }}>
                Produtos selecionados
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {selectedItems.map((item) => {
                  const tech = TECHNIQUES.find((t) => t.id === item.technique);
                  return (
                    <div
                      key={item.product.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: '0.5rem' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgb(245,247,251)', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product.title}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>
                          {tech?.label} · {item.quantity} un.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Estimate */}
              {low > 0 && (
                <div style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', background: 'rgba(99,230,190,0.06)', border: '1px solid rgba(99,230,190,0.15)', borderRadius: '10px' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgb(99,230,190)', marginBottom: '0.25rem' }}>
                    Estimativa de preço
                  </p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgb(99,230,190)' }}>
                    {formatPrice(low)} – {formatPrice(high)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)', marginTop: '0.2rem' }}>
                    Preço final calculado após análise da equipa YourGift.
                  </p>
                </div>
              )}

              {/* Dates & notes recap */}
              {(eventDate || deliveryDate || notes) && (
                <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  {eventDate && (
                    <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)' }}>
                      <span style={{ color: 'rgb(170,180,198)', fontWeight: 500 }}>Evento:</span>{' '}
                      {new Date(eventDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  {deliveryDate && (
                    <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', marginTop: '0.25rem' }}>
                      <span style={{ color: 'rgb(170,180,198)', fontWeight: 500 }}>Entrega:</span>{' '}
                      {new Date(deliveryDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  {notes && (
                    <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', marginTop: '0.25rem' }}>
                      <span style={{ color: 'rgb(170,180,198)', fontWeight: 500 }}>Notas:</span>{' '}
                      {notes.length > 100 ? notes.slice(0, 100) + '...' : notes}
                    </p>
                  )}
                  {artworkFiles.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'rgb(120,130,150)', marginTop: '0.25rem' }}>
                      <span style={{ color: 'rgb(170,180,198)', fontWeight: 500 }}>Artes:</span>{' '}
                      {artworkFiles.length} ficheiro{artworkFiles.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Terms */}
            <label
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: '2px', accentColor: 'rgb(77,163,255)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'rgb(170,180,198)', lineHeight: 1.5 }}>
                Concordo com os{' '}
                <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: 'rgb(77,163,255)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  termos e condições
                </a>
                {' '}da YourGift, incluindo a política de cancelamento e prazo mínimo de produção.
              </span>
            </label>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: 'rgb(239,68,68)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button"
                type="button"
                onClick={() => setStep(2)}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(170,180,198)' }}
              >
                ← Anterior
              </button>
              <button type="button"
                type="button"
                onClick={handleSubmit}
                disabled={!termsAccepted || submitting}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: !termsAccepted || submitting ? 'not-allowed' : 'pointer',
                  background: !termsAccepted || submitting ? 'rgba(99,230,190,0.3)' : 'rgb(99,230,190)',
                  color: 'rgb(7,17,31)',
                  border: 'none',
                  opacity: !termsAccepted || submitting ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                {submitting ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(7,17,31,0.3)', borderTopColor: 'rgb(7,17,31)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    A submeter...
                  </>
                ) : (
                  'Submeter Orçamento ✓'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
      `}</style>
    </PortalLayout>
  );
}
