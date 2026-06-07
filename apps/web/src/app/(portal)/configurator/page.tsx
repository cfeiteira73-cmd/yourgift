'use client';

// ── OMEGA PROTOCOL — S3: Visual Product Builder ───────────────────────────────
//
// 3-step interactive product configurator with live pricing engine.
// Step 1: Catalog browser — search, filter by category, select product
// Step 2: Configuration — technique, quantity, variant/color, branding
// Step 3: Summary — pricing breakdown, estimated ETA, launch order CTA
//
// Uses CSS classes from globals.css (S1 Visual OS) + lib/motion.ts spring presets.
//
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { springSnappy, springGentle, fadeUp, tapScale } from '@/lib/motion';
import { CATEGORY_GROUP_LABELS } from '@/lib/catalog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id: string; sku: string; color?: string; colorGroup?: string;
  colorCode?: string; price: number; stock: number; images: string[];
}

interface Product {
  id: string; supplierRef: string; title: string; description: string;
  category: string; supplier: string; basePrice: number;
  images: string[]; variants: Variant[];
}

interface ClientProfile { id: string; name: string | null; company: string | null; tier: string | null; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TECHNIQUES = [
  { id: 'dtf',        label: 'DTF Full Color',   emoji: '🎨', baseCost: 2.50, min: 1,   desc: 'Full-color transfer, any design, low MOQ' },
  { id: 'embroidery', label: 'Bordado',           emoji: '🧵', baseCost: 4.00, min: 12,  desc: 'Premium embroidered logo, durable finish' },
  { id: 'laser',      label: 'Laser Engraving',  emoji: '⚡', baseCost: 3.00, min: 1,   desc: 'Permanent engraving on metal & wood' },
  { id: 'pad',        label: 'Pad Printing',     emoji: '🔵', baseCost: 0.80, min: 50,  desc: 'Spot-color, high-volume, cost-efficient' },
  { id: 'screen',     label: 'Serigrafia',       emoji: '🖨️', baseCost: 1.20, min: 24,  desc: 'Classic screen print, vivid flat colours' },
  { id: 'uv',         label: 'UV Direct',        emoji: '☀️', baseCost: 3.50, min: 1,   desc: 'Photorealistic UV print, glossy or matte' },
];

const QTY_PRESETS = [10, 25, 50, 100, 250, 500, 1000];

const SHIPPING_RATES: Record<string, number> = {
  PT: 8, ES: 12, FR: 14, DE: 16, GB: 18, NL: 15, IT: 15, OTHER: 20,
};

const DELIVERY_DAYS: Record<string, number> = {
  dtf: 7, embroidery: 12, laser: 8, pad: 14, screen: 10, uv: 7,
};

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  ...Object.entries(CATEGORY_GROUP_LABELS).map(([id, label]) => ({ id, label })),
];

function fmtEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtEurCompact(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ─── Animated Price Counter ────────────────────────────────────────────────────

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const steps = 18;
    let i = 0;
    const tick = setInterval(() => {
      i++;
      const t = i / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * ease);
      if (i >= steps) { clearInterval(tick); setDisplayed(to); prevRef.current = to; }
    }, 16);
    return () => clearInterval(tick);
  }, [value]);

  return <span className={className}>{fmtEur(displayed)}</span>;
}

// ─── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product, selected, onSelect }: { product: Product; selected: boolean; onSelect: () => void }) {
  const img = product.images?.[0] ?? product.variants?.[0]?.images?.[0] ?? null;
  const variantCount = product.variants?.length ?? 0;

  return (
    <motion.div
      layout
      {...fadeUp(0)}
      whileHover={{ y: -2, scale: 1.01, transition: springSnappy }}
      whileTap={tapScale}
      onClick={onSelect}
      style={{
        borderRadius: '16px',
        border: selected ? '1.5px solid #d4b47a' : '1px solid rgba(240,236,228,0.06)',
        background: selected
          ? 'linear-gradient(135deg,rgba(154,124,74,0.12) 0%,rgba(116,231,255,0.06) 100%)'
          : 'linear-gradient(135deg,rgba(240,236,228,0.04) 0%,rgba(255,255,255,0.01) 100%)',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 200ms, background 200ms',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 2,
          width: '22px', height: '22px', borderRadius: '50%',
          background: '#d4b47a', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 700, color: '#fff',
        }}>✓</div>
      )}
      {/* Image */}
      <div style={{
        height: '140px', background: 'rgba(240,236,228,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', borderBottom: '1px solid rgba(240,236,228,0.06)',
      }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontSize: '2.5rem', opacity: 0.3 }}>📦</span>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(200,215,235)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {product.title}
        </div>
        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)', fontWeight: 600 }}>{product.supplierRef}</span>
          {variantCount > 0 && (
            <span style={{ fontSize: '0.55rem', background: 'rgba(154,124,74,0.12)', color: '#d4b47a', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
              {variantCount} cor{variantCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfiguratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('productId');

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [offset, setOffset] = useState(0);
  const LIMIT = 24;

  // Step 2 state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [technique, setTechnique] = useState('dtf');
  const [quantity, setQuantity] = useState(50);
  const [country, setCountry] = useState('PT');
  const [brandingNotes, setBrandingNotes] = useState('');

  // Search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Fetch catalog ──────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (q: string, cat: string, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (q) params.set('search', q);
      if (cat !== 'all') params.set('category', cat);
      const res = await fetch(`/api/catalog?${params}`);
      if (res.ok) {
        const d = await res.json();
        setProducts(d.products ?? []);
        setTotal(d.total ?? 0);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/configurator'); return; }
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      setClient(c as ClientProfile | null);
      await fetchProducts('', 'all', 0);

      // Pre-select product from URL param
      if (preselectedId) {
        const res = await fetch(`/api/catalog?id=${preselectedId}`);
        if (res.ok) {
          const d = await res.json();
          if (d.product) {
            setSelectedProduct(d.product);
            const firstVariant = d.product.variants?.[0] ?? null;
            setSelectedVariant(firstVariant);
            setSelectedImage(d.product.images?.[0] ?? firstVariant?.images?.[0] ?? null);
            setStep(2);
          }
        }
      }
    }
    init();
  }, [router, fetchProducts, preselectedId]);

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      fetchProducts(val, category, 0);
    }, 350);
  }

  function handleCategoryChange(cat: string) {
    setCategory(cat);
    setOffset(0);
    fetchProducts(search, cat, 0);
  }

  function handlePageChange(newOffset: number) {
    setOffset(newOffset);
    fetchProducts(search, category, newOffset);
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    const firstVariant = p.variants?.find(v => v.stock > 0) ?? p.variants?.[0] ?? null;
    setSelectedVariant(firstVariant);
    setSelectedImage(p.images?.[0] ?? firstVariant?.images?.[0] ?? null);
  }

  function proceedToStep2() {
    if (!selectedProduct) return;
    // Ensure min quantity for technique
    const tech = TECHNIQUES.find(t => t.id === technique)!;
    if (quantity < tech.min) setQuantity(tech.min);
    setStep(2);
  }

  // ── Pricing ────────────────────────────────────────────────────────────────

  const tech = TECHNIQUES.find(t => t.id === technique)!;
  const printUnitCost = tech?.baseCost ?? 2.5;
  const variantBasePrice = selectedVariant?.price ?? selectedProduct?.basePrice ?? 0;
  const productUnitCost = variantBasePrice > 0 ? variantBasePrice : 5.0; // fallback for RFQ model
  const unitCost = productUnitCost + printUnitCost;
  const subtotal = unitCost * quantity;
  const shipping = SHIPPING_RATES[country] ?? SHIPPING_RATES.OTHER;
  const total_ = subtotal + shipping;
  const unitFinal = total_ / quantity;
  const deliveryDays = DELIVERY_DAYS[technique] ?? 10;
  const deliveryDate = new Date(Date.now() + deliveryDays * 86400000).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });

  // Quantity tier discount
  const qtyDiscount = quantity >= 500 ? 0.12 : quantity >= 250 ? 0.08 : quantity >= 100 ? 0.05 : quantity >= 50 ? 0.02 : 0;
  const discountAmount = subtotal * qtyDiscount;
  const finalTotal = total_ - discountAmount;

  // ── Order launch URL ────────────────────────────────────────────────────────

  const orderUrl = selectedProduct
    ? `/orders/new?productId=${selectedProduct.id}&technique=${technique}&qty=${quantity}&country=${country}${selectedVariant ? `&variantId=${selectedVariant.id}` : ''}`
    : '/orders/new';

  // ── Gallery images ─────────────────────────────────────────────────────────

  const galleryImages: string[] = [
    ...(selectedProduct?.images ?? []),
    ...(selectedVariant?.images ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 6);

  const displayImage = selectedImage ?? galleryImages[0] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PortalLayout
      userName={client?.name ?? undefined}
      companyName={client?.company ?? undefined}
      tier={client?.tier ?? undefined}
    >
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px' }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <Link href="/orders" style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.24)', textDecoration: 'none' }}>Encomendas</Link>
            <span style={{ color: 'rgba(240,236,228,0.24)', fontSize: '0.7rem' }}>›</span>
            <span style={{ fontSize: '0.7rem', color: '#d4b47a', fontWeight: 600 }}>Configurador</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>
            Visual Product Builder
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.24)' }}>
            Configura produto, técnica e quantidade — pricing em tempo real.
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div {...fadeUp(0.05)} style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2rem' }}>
          {(['1', '2', '3'] as const).map((s, i) => {
            const labels = ['Seleccionar', 'Configurar', 'Resumo'];
            const active = step === i + 1;
            const done = step > i + 1;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <button type="button"
                  onClick={() => {
                    if (done) setStep((i + 1) as 1 | 2 | 3);
                    if (i === 0) setStep(1);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'none', border: 'none', cursor: done ? 'pointer' : 'default',
                    padding: '0',
                  }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: active ? '#d4b47a' : done ? 'rgba(154,124,74,0.22)' : 'rgba(240,236,228,0.06)',
                    border: active ? 'none' : done ? '1.5px solid rgba(154,124,74,0.45)' : '1.5px solid rgba(240,236,228,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 800,
                    color: active ? '#fff' : done ? '#d4b47a' : 'rgba(240,236,228,0.24)',
                    flexShrink: 0,
                    transition: 'all 300ms',
                  }}>
                    {done ? '✓' : s}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: active ? 'rgb(200,215,235)' : 'rgba(240,236,228,0.24)', transition: 'color 300ms' }}>
                    {labels[i]}
                  </span>
                </button>
                {i < 2 && (
                  <div style={{
                    flex: 1, height: '1px', margin: '0 0.75rem',
                    background: done ? 'rgba(154,124,74,0.35)' : 'rgba(240,236,228,0.06)',
                    transition: 'background 300ms',
                  }} />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* ── STEP 1: Product Selection ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={springGentle}
            >
              {/* Search + Category filter */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
                  <input
                    value={search}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Pesquisar produtos…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)',
                      borderRadius: '10px', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                      color: 'rgb(200,215,235)', fontSize: '0.78rem', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {CATEGORIES.slice(0, 8).map(cat => (
                    <button type="button"
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      style={{
                        background: category === cat.id ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.04)',
                        border: category === cat.id ? '1px solid rgba(154,124,74,0.45)' : '1px solid rgba(240,236,228,0.06)',
                        borderRadius: '8px', padding: '0.4rem 0.75rem',
                        color: category === cat.id ? '#d4b47a' : 'rgb(120,135,155)',
                        fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results info */}
              <div style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.75rem' }}>
                {loading ? 'A carregar…' : `${total.toLocaleString('pt-PT')} produtos`}
                {selectedProduct && (
                  <span style={{ marginLeft: '0.75rem', color: '#d4b47a', fontWeight: 600 }}>
                    ✓ {selectedProduct.title.slice(0, 40)}
                  </span>
                )}
              </div>

              {/* Product grid */}
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.75rem' }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '16px' }} />
                  ))}
                </div>
              ) : (
                <motion.div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0.75rem' }}
                >
                  {products.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      selected={selectedProduct?.id === p.id}
                      onSelect={() => selectProduct(p)}
                    />
                  ))}
                  {products.length === 0 && (
                    <div style={{ gridColumn: '1/-1', padding: '3rem', textAlign: 'center', color: 'rgba(240,236,228,0.24)', fontSize: '0.8rem' }}>
                      Nenhum produto encontrado. Tenta outra pesquisa.
                    </div>
                  )}
                </motion.div>
              )}

              {/* Pagination */}
              {total > LIMIT && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                  {Array.from({ length: Math.min(Math.ceil(total / LIMIT), 8) }).map((_, i) => {
                    const pageOffset = i * LIMIT;
                    const active = pageOffset === offset;
                    return (
                      <button type="button" key={i} onClick={() => handlePageChange(pageOffset)} style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: active ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.04)',
                        border: active ? '1px solid rgba(154,124,74,0.45)' : '1px solid rgba(240,236,228,0.06)',
                        color: active ? '#d4b47a' : 'rgb(120,135,155)',
                        fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                      }}>
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* CTA */}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <motion.button
                  whileTap={tapScale}
                  onClick={proceedToStep2}
                  disabled={!selectedProduct}
                  style={{
                    background: selectedProduct ? 'linear-gradient(135deg,#d4b47a,#b8975e)' : 'rgba(240,236,228,0.06)',
                    border: 'none', borderRadius: '12px', padding: '0.75rem 2rem',
                    color: selectedProduct ? '#fff' : 'rgba(240,236,228,0.24)',
                    fontSize: '0.82rem', fontWeight: 700, cursor: selectedProduct ? 'pointer' : 'not-allowed',
                    transition: 'all 250ms',
                  }}
                >
                  {selectedProduct ? `Configurar "${selectedProduct.title.slice(0, 30)}"  →` : 'Selecciona um produto para continuar'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Configuration ──────────────────────────────────────── */}
          {step === 2 && selectedProduct && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={springGentle}
              style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}
            >
              {/* Left — Configuration panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Product image gallery */}
                <div className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Main image */}
                    <div style={{
                      flex: 1, aspectRatio: '1', background: 'rgba(240,236,228,0.04)',
                      borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', minHeight: '200px',
                    }}>
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayImage} alt={selectedProduct.title}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '1rem' }}
                          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '4rem', opacity: 0.2 }}>📦</span>
                      )}
                    </div>
                    {/* Thumbnails */}
                    {galleryImages.length > 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {galleryImages.map((img, i) => (
                          <motion.div key={i} whileTap={tapScale} onClick={() => setSelectedImage(img)}
                            style={{
                              width: '52px', height: '52px', borderRadius: '8px',
                              background: 'rgba(240,236,228,0.04)', overflow: 'hidden',
                              border: selectedImage === img ? '1.5px solid #d4b47a' : '1px solid rgba(240,236,228,0.06)',
                              cursor: 'pointer',
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                              onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {/* Title + info */}
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(220,232,248)', lineHeight: 1.3, marginBottom: '0.4rem' }}>
                        {selectedProduct.title}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.75rem' }}>
                        {selectedProduct.supplierRef} · {selectedProduct.supplier}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(240,236,228,0.42)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {selectedProduct.description}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variant / Colour picker */}
                {selectedProduct.variants.length > 0 && (
                  <div className="yg-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                      Cor / Variante
                      {selectedVariant && <span style={{ marginLeft: '0.5rem', color: 'rgb(200,215,235)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>— {selectedVariant.color ?? selectedVariant.sku}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {selectedProduct.variants.slice(0, 32).map(v => {
                        const isSelected = selectedVariant?.id === v.id;
                        const bg = v.colorCode ? `#${v.colorCode.replace('#', '')}` : null;
                        return (
                          <motion.button
                            key={v.id}
                            whileTap={tapScale}
                            onClick={() => {
                              setSelectedVariant(v);
                              if (v.images?.[0]) setSelectedImage(v.images[0]);
                            }}
                            title={v.color ?? v.sku}
                            style={{
                              width: bg ? '28px' : 'auto', height: '28px',
                              minWidth: bg ? '28px' : '60px',
                              borderRadius: bg ? '50%' : '8px',
                              background: bg ?? 'rgba(240,236,228,0.06)',
                              border: isSelected ? '2.5px solid #d4b47a' : '1.5px solid rgba(240,236,228,0.10)',
                              cursor: 'pointer', padding: bg ? 0 : '0 0.5rem',
                              fontSize: '0.6rem', fontWeight: 700,
                              color: bg ? 'transparent' : isSelected ? '#d4b47a' : 'rgba(240,236,228,0.42)',
                              boxShadow: isSelected ? '0 0 0 3px rgba(154,124,74,0.22)' : 'none',
                              transition: 'border-color 200ms, box-shadow 200ms',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {!bg && (v.color ?? v.sku).slice(0, 8)}
                          </motion.button>
                        );
                      })}
                      {selectedProduct.variants.length > 32 && (
                        <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', alignSelf: 'center', fontStyle: 'italic' }}>
                          +{selectedProduct.variants.length - 32} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Technique selector */}
                <div className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                    Técnica de Personalização
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.5rem' }}>
                    {TECHNIQUES.map(t => {
                      const active = technique === t.id;
                      return (
                        <motion.button
                          key={t.id}
                          whileTap={tapScale}
                          onClick={() => {
                            setTechnique(t.id);
                            if (quantity < t.min) setQuantity(t.min);
                          }}
                          style={{
                            background: active ? 'rgba(154,124,74,0.12)' : 'rgba(240,236,228,0.04)',
                            border: active ? '1.5px solid rgba(154,124,74,0.45)' : '1px solid rgba(240,236,228,0.06)',
                            borderRadius: '12px', padding: '0.75rem',
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'all 200ms',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1rem' }}>{t.emoji}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? '#d4b47a' : 'rgb(200,215,235)' }}>{t.label}</span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'rgba(240,236,228,0.24)', lineHeight: 1.4 }}>{t.desc}</div>
                          <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', color: '#b8975e', fontWeight: 700 }}>+{fmtEur(t.baseCost)}/un</span>
                            <span style={{ fontSize: '0.58rem', color: 'rgba(240,236,228,0.24)' }}>min {t.min}un</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Quantity selector */}
                <div className="yg-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
                    Quantidade
                    <span style={{ marginLeft: '0.5rem', color: 'rgb(200,215,235)', fontWeight: 700, textTransform: 'none', letterSpacing: 0, fontSize: '0.82rem' }}>
                      {quantity.toLocaleString('pt-PT')} unidades
                    </span>
                  </div>
                  {/* Preset buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                    {QTY_PRESETS.map(q => (
                      <motion.button
                        key={q}
                        whileTap={tapScale}
                        onClick={() => setQuantity(Math.max(tech.min, q))}
                        style={{
                          background: quantity === q ? 'rgba(154,124,74,0.18)' : 'rgba(240,236,228,0.04)',
                          border: quantity === q ? '1px solid rgba(154,124,74,0.45)' : '1px solid rgba(240,236,228,0.06)',
                          borderRadius: '8px', padding: '0.35rem 0.75rem',
                          color: quantity === q ? '#d4b47a' : 'rgb(120,135,155)',
                          fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {q >= 1000 ? `${q / 1000}k` : q}
                      </motion.button>
                    ))}
                  </div>
                  {/* Custom input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="range" min={tech.min} max={1000} step={tech.min < 10 ? 1 : 10}
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      style={{ flex: 1, accentColor: '#d4b47a' }}
                    />
                    <input
                      type="number" min={tech.min} max={10000}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(tech.min, Number(e.target.value)))}
                      style={{
                        width: '80px', background: 'rgba(240,236,228,0.06)',
                        border: '1px solid rgba(240,236,228,0.10)', borderRadius: '8px',
                        padding: '0.4rem 0.5rem', color: 'rgb(200,215,235)', fontSize: '0.78rem', textAlign: 'center',
                      }}
                    />
                  </div>
                  {qtyDiscount > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: '#b8975e', fontWeight: 700 }}>
                      🎉 Desconto de volume: {(qtyDiscount * 100).toFixed(0)}% aplicado ({fmtEur(discountAmount)} de poupança)
                    </div>
                  )}
                  {quantity < tech.min && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'rgb(245,158,11)', fontWeight: 700 }}>
                      ⚠️ Mínimo para {tech.label}: {tech.min} unidades
                    </div>
                  )}
                </div>

                {/* Delivery country + branding notes */}
                <div className="yg-card" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      País de Entrega
                    </div>
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      style={{
                        width: '100%', background: 'rgba(240,236,228,0.06)',
                        border: '1px solid rgba(240,236,228,0.06)', borderRadius: '8px',
                        padding: '0.5rem', color: 'rgb(200,215,235)', fontSize: '0.78rem',
                      }}
                    >
                      {Object.keys(SHIPPING_RATES).filter(k => k !== 'OTHER').map(k => (
                        <option key={k} value={k} style={{ background: 'rgb(14,22,36)' }}>{k}</option>
                      ))}
                      <option value="OTHER" style={{ background: 'rgb(14,22,36)' }}>Outro</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Notas de Personalização
                    </div>
                    <textarea
                      value={brandingNotes}
                      onChange={e => setBrandingNotes(e.target.value)}
                      placeholder="Ex: Logo branco em fundo azul, posição frente-centro, ficheiro enviado por email…"
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box', background: 'rgba(240,236,228,0.04)',
                        border: '1px solid rgba(240,236,228,0.06)', borderRadius: '8px',
                        padding: '0.5rem 0.75rem', color: 'rgb(200,215,235)', fontSize: '0.75rem',
                        resize: 'vertical', lineHeight: 1.5,
                      }}
                    />
                  </div>
                </div>

              </div>

              {/* Right — Live Pricing Panel */}
              <div style={{ position: 'sticky', top: '1.5rem' }}>
                <div className="yg-card" style={{ padding: '1.5rem', borderColor: 'rgba(154,124,74,0.14)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b8975e', boxShadow: '0 0 6px rgba(99,230,190,0.7)' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b8975e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Pricing em Tempo Real
                    </span>
                  </div>

                  {/* Selected product summary */}
                  <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(240,236,228,0.04)', borderRadius: '10px', border: '1px solid rgba(240,236,228,0.06)' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(200,215,235)', lineHeight: 1.3 }}>
                      {selectedProduct.title.slice(0, 50)}
                    </div>
                    {selectedVariant?.color && (
                      <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.2rem' }}>Cor: {selectedVariant.color}</div>
                    )}
                    <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)' }}>Técnica: {tech?.label}</div>
                  </div>

                  {/* Price breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Produto base / un', value: fmtEur(productUnitCost), note: variantBasePrice > 0 ? undefined : '(estimativa RFQ)' },
                      { label: 'Personalização / un', value: `+${fmtEur(printUnitCost)}`, note: tech?.label },
                      { label: 'Custo unitário', value: fmtEur(unitCost), bold: true },
                      { label: `Subtotal (${quantity.toLocaleString('pt-PT')} un)`, value: fmtEurCompact(subtotal) },
                      { label: `Envio (${country})`, value: `+${fmtEur(shipping)}` },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', color: row.bold ? 'rgb(170,185,205)' : 'rgba(240,236,228,0.24)', fontWeight: row.bold ? 700 : 400 }}>
                          {row.label}
                          {row.note && <span style={{ marginLeft: '0.25rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.58rem' }}>({row.note})</span>}
                        </span>
                        <span style={{ fontSize: row.bold ? '0.82rem' : '0.72rem', color: row.bold ? 'rgb(200,215,235)' : 'rgba(240,236,228,0.42)', fontWeight: row.bold ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                    {qtyDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.68rem', color: '#b8975e' }}>Desconto {(qtyDiscount * 100).toFixed(0)}%</span>
                        <span style={{ fontSize: '0.72rem', color: '#b8975e', fontWeight: 700 }}>-{fmtEur(discountAmount)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ height: '1px', background: 'rgba(240,236,228,0.06)', margin: '0.875rem 0' }} />

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(170,185,205)' }}>Total Estimado</span>
                    <AnimatedPrice value={finalTotal} className="text-kpi" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Custo por unidade</span>
                    <span style={{ fontSize: '0.78rem', color: '#d4b47a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtEur(unitFinal)} /un
                    </span>
                  </div>

                  {/* Delivery estimate */}
                  <div style={{ padding: '0.75rem', background: 'rgba(99,230,190,0.06)', borderRadius: '10px', border: '1px solid rgba(184,151,94,0.14)', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)', marginBottom: '0.2rem' }}>🚚 Entrega estimada</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b8975e' }}>{deliveryDate}</div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(240,236,228,0.24)', marginTop: '0.1rem' }}>{deliveryDays} dias úteis após aprovação de arte</div>
                  </div>

                  {/* CTA */}
                  <motion.button
                    whileTap={tapScale}
                    onClick={() => setStep(3)}
                    style={{
                      width: '100%', background: 'linear-gradient(135deg,#d4b47a,#b8975e)',
                      border: 'none', borderRadius: '12px', padding: '0.875rem',
                      color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Ver Resumo Final →
                  </motion.button>
                  <button type="button"
                    onClick={() => setStep(1)}
                    style={{ width: '100%', background: 'none', border: 'none', marginTop: '0.625rem', color: 'rgba(240,236,228,0.24)', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    ← Mudar produto
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Order Summary ─────────────────────────────────────── */}
          {step === 3 && selectedProduct && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={springGentle}
              style={{ maxWidth: '680px', margin: '0 auto' }}
            >
              {/* Success badge */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...springSnappy, delay: 0.1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}
              >
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg,rgba(154,124,74,0.18),rgba(184,151,94,0.18))',
                  border: '1.5px solid rgba(154,124,74,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.75rem', marginBottom: '0.875rem',
                  boxShadow: '0 0 32px rgba(154,124,74,0.18)',
                }}>✨</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f0ece4', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                  Configuração Pronta!
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'rgba(240,236,228,0.24)', textAlign: 'center' }}>
                  Revê o resumo e lança a encomenda em segundos.
                </p>
              </motion.div>

              {/* Summary card */}
              <div className="yg-card" style={{ padding: '1.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Produto', value: selectedProduct.title.slice(0, 40) },
                    { label: 'Variante', value: selectedVariant?.color ?? selectedVariant?.sku ?? 'N/A' },
                    { label: 'Técnica', value: tech?.label ?? '—' },
                    { label: 'Quantidade', value: `${quantity.toLocaleString('pt-PT')} unidades` },
                    { label: 'País de Entrega', value: country },
                    { label: 'Entrega Estimada', value: deliveryDate },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgb(200,215,235)', lineHeight: 1.3 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {brandingNotes && (
                  <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(77,163,255,0.05)', borderRadius: '10px', border: '1px solid rgba(154,124,74,0.12)' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(240,236,228,0.24)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Notas de Arte</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgb(170,185,205)', lineHeight: 1.5 }}>{brandingNotes}</div>
                  </div>
                )}

                <div style={{ height: '1px', background: 'rgba(240,236,228,0.06)', marginBottom: '1.25rem' }} />

                {/* Final pricing */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'rgb(120,135,155)' }}>Subtotal produtos</span>
                  <span style={{ fontSize: '0.82rem', color: 'rgb(170,185,205)', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(subtotal)}</span>
                </div>
                {qtyDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#b8975e' }}>Desconto volume ({(qtyDiscount * 100).toFixed(0)}%)</span>
                    <span style={{ fontSize: '0.78rem', color: '#b8975e', fontWeight: 700 }}>-{fmtEur(discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'rgb(120,135,155)' }}>Envio</span>
                  <span style={{ fontSize: '0.78rem', color: 'rgb(170,185,205)', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(shipping)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(154,124,74,0.08)', borderRadius: '12px', border: '1px solid rgba(154,124,74,0.18)' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'rgb(120,135,155)', marginBottom: '0.15rem' }}>Total Estimado (IVA excl.)</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>Sujeito a confirmação de arte e stock</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-kpi" style={{ color: '#d4b47a' }}>{fmtEur(finalTotal)}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(240,236,228,0.24)' }}>{fmtEur(unitFinal)}/un</div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link href={orderUrl} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileTap={tapScale}
                    style={{
                      background: 'linear-gradient(135deg,#d4b47a,#b8975e)',
                      borderRadius: '14px', padding: '1rem',
                      textAlign: 'center', color: '#fff',
                      fontSize: '0.88rem', fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '-0.01em',
                      boxShadow: '0 8px 24px rgba(154,124,74,0.28)',
                    }}
                  >
                    🚀 Lançar Encomenda
                  </motion.div>
                </Link>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <motion.button
                    whileTap={tapScale}
                    onClick={() => setStep(2)}
                    style={{
                      background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.06)',
                      borderRadius: '12px', padding: '0.75rem',
                      color: 'rgba(240,236,228,0.42)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ← Editar Configuração
                  </motion.button>
                  <Link href="/quotes/new" style={{ textDecoration: 'none' }}>
                    <motion.div
                      whileTap={tapScale}
                      style={{
                        background: 'rgba(116,231,255,0.08)', border: '1px solid rgba(184,151,94,0.18)',
                        borderRadius: '12px', padding: '0.75rem',
                        color: '#b8975e', fontSize: '0.78rem', fontWeight: 600,
                        cursor: 'pointer', textAlign: 'center',
                      }}
                    >
                      📋 Pedir Orçamento
                    </motion.div>
                  </Link>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </PortalLayout>
  );
}
