'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatPrice, buildPricingBreakdown } from '@yourgift/shared';

const TECHNIQUES = [
  { id: 'dtf', label: 'DTF — Full Color', min: 1 },
  { id: 'embroidery', label: 'Bordado', min: 12 },
  { id: 'laser', label: 'Laser', min: 1 },
  { id: 'pad', label: 'Pad Printing', min: 50 },
  { id: 'screen', label: 'Serigrafia', min: 24 },
];

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') ?? '';

  const [product, setProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [technique, setTechnique] = useState('dtf');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [address, setAddress] = useState({ name: '', street: '', city: '', postalCode: '', country: 'PT' });
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    if (!productId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${productId}`)
      .then((r) => r.json())
      .then((p) => {
        setProduct(p);
        if (p.variants?.[0]) setSelectedVariant(p.variants[0].id);
      });
  }, [productId, router, token]);

  const calculatePrice = useCallback(async () => {
    if (!selectedVariant || !productId) return;
    setPricingLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pricing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, variantId: selectedVariant, quantity, technique, destinationCountry: address.country || 'PT' }),
      });
      if (res.ok) setPricing(await res.json());
    } finally {
      setPricingLoading(false);
    }
  }, [productId, selectedVariant, quantity, technique, address.country, token]);

  useEffect(() => {
    if (step >= 2) calculatePrice();
  }, [step, calculatePrice]);

  async function handleArtworkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/artwork/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: file.name, mimeType: file.type }),
    });
    if (!res.ok) return;
    const { uploadUrl, cdnUrl } = await res.json();
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    setArtworkUrl(cdnUrl);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: [{ productId, variantId: selectedVariant, quantity, unitPrice: pricing?.total / quantity ?? 0 }],
          shippingAddress: address,
        }),
      });
      if (!res.ok) throw new Error('Erro ao criar encomenda');
      const order = await res.json();
      router.push(`/dashboard?order=${order.ref}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const variant = product?.variants?.find((v: any) => v.id === selectedVariant);
  const minQty = TECHNIQUES.find((t) => t.id === technique)?.min ?? 1;

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">A carregar produto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900">your<span className="text-brand-600">gift</span></Link>
          <nav className="flex items-center gap-2 text-sm">
            {['Produto', 'Personalização', 'Entrega', 'Confirmar'].map((s, i) => (
              <span key={s} className={`flex items-center gap-2 ${i > 0 ? 'before:content-["→"] before:text-gray-300 before:mr-2' : ''}`}>
                <span className={`font-medium ${step === i + 1 ? 'text-brand-600' : step > i + 1 ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{s}</span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* STEP 1 — Produto */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-4">
                {product.images?.[0]
                  ? <img src={product.images[0]} alt={product.title} className="w-full h-full object-contain" />
                  : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">🎁</div>
                }
              </div>
            </div>
            <div>
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-2">{product.supplierRef}</p>
              <h1 className="text-2xl font-black text-gray-900 mb-3">{product.title}</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{product.description}</p>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Variante / Cor</label>
                <div className="flex flex-wrap gap-2">
                  {product.variants?.map((v: any) => (
                    <button key={v.id} type="button" onClick={() => setSelectedVariant(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedVariant === v.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {v.color ?? v.sku}
                      {v.stock > 0 && <span className="ml-1 text-green-500">●</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Quantidade</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setQuantity(Math.max(minQty, quantity - 5))}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 font-bold">−</button>
                  <input type="number" value={quantity} min={minQty}
                    onChange={(e) => setQuantity(Math.max(minQty, parseInt(e.target.value) || minQty))}
                    className="w-20 text-center border border-gray-200 rounded-lg py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button type="button" onClick={() => setQuantity(quantity + 5)}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 font-bold">+</button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Mínimo {minQty} unidades para {TECHNIQUES.find(t => t.id === technique)?.label}</p>
              </div>

              <button type="button" onClick={() => setStep(2)} disabled={!selectedVariant}
                className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40">
                Continuar → Personalização
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Personalização */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Personalização</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-3">Técnica de impressão</label>
              <div className="grid grid-cols-1 gap-2">
                {TECHNIQUES.map((t) => (
                  <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${technique === t.id ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="radio" name="technique" value={t.id} checked={technique === t.id} onChange={() => setTechnique(t.id)} className="accent-brand-600" />
                    <span className="text-sm font-medium text-gray-900">{t.label}</span>
                    <span className="ml-auto text-xs text-gray-400">Mín. {t.min} un.</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-3">Upload da arte</label>
              {artworkUrl ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <span className="text-green-600 text-lg">✓</span>
                  <span className="text-sm text-green-700 font-medium">Arte carregada com sucesso</span>
                  <button type="button" onClick={() => setArtworkUrl('')} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Remover</button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 transition-colors">
                  <input type="file" accept=".pdf,.ai,.png,.jpg,.svg,.eps" onChange={handleArtworkUpload} className="hidden" />
                  <div className="text-3xl mb-2">🎨</div>
                  <p className="text-sm font-medium text-gray-700">Clica para fazer upload</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, AI, PNG, SVG, EPS — max 50MB</p>
                </label>
              )}
            </div>

            {pricing && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Estimativa de preço</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Produto ({quantity} un.)</span><span>{formatPrice(pricing.subtotal)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Impressão</span><span>{formatPrice(pricing.printCost)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Envio</span><span>{formatPrice(pricing.shippingCost)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>IVA (23%)</span><span>{formatPrice(pricing.tax)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
                    <span>Total</span><span className="text-brand-700">{formatPrice(pricing.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400 text-right">{formatPrice(pricing.total / quantity)}/unidade</p>
                </div>
              </div>
            )}

            {pricingLoading && <div className="text-center py-4 text-sm text-gray-400">A calcular preço...</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                ← Voltar
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors">
                Continuar → Entrega
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Entrega */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Morada de entrega</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome / Empresa *</label>
                <input type="text" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Morada *</label>
                <input type="text" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade *</label>
                  <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Código Postal *</label>
                  <input type="text" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">País *</label>
                <select value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="PT">Portugal</option>
                  <option value="ES">Espanha</option>
                  <option value="FR">França</option>
                  <option value="DE">Alemanha</option>
                  <option value="GB">Reino Unido</option>
                  <option value="NL">Holanda</option>
                  <option value="IT">Itália</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                ← Voltar
              </button>
              <button type="button" onClick={() => setStep(4)} disabled={!address.name || !address.street || !address.city || !address.postalCode}
                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40">
                Continuar → Confirmar
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Confirmar */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Confirmar encomenda</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 space-y-4">
              <div className="flex gap-4">
                {product.images?.[0] && <img src={product.images[0]} alt={product.title} className="w-20 h-20 rounded-xl object-cover bg-gray-50" />}
                <div>
                  <p className="font-semibold text-gray-900">{product.title}</p>
                  <p className="text-sm text-gray-500">{variant?.color} · {quantity} unidades</p>
                  <p className="text-sm text-gray-500">{TECHNIQUES.find(t => t.id === technique)?.label}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1 font-semibold">Entrega</p>
                <p className="text-sm text-gray-700">{address.name}</p>
                <p className="text-sm text-gray-700">{address.street}, {address.city} {address.postalCode}</p>
              </div>
              {pricing && (
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-black text-brand-700">{formatPrice(pricing.total)}</span>
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                ← Voltar
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50">
                {submitting ? 'A processar...' : `Encomendar — ${pricing ? formatPrice(pricing.total) : '...'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
