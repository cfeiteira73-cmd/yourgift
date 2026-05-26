'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatPrice, buildPricingBreakdown, generateOrderRef } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/client';
import { getProductById } from '@/lib/catalog';

const TECHNIQUES = [
  { id: 'dtf',       label: 'DTF — Full Color',  min: 1,  baseCost: 2.50 },
  { id: 'embroidery',label: 'Bordado',            min: 12, baseCost: 4.00 },
  { id: 'laser',     label: 'Laser',              min: 1,  baseCost: 3.00 },
  { id: 'pad',       label: 'Pad Printing',       min: 50, baseCost: 0.80 },
  { id: 'screen',    label: 'Serigrafia',         min: 24, baseCost: 1.20 },
];

const SHIPPING_RATES: Record<string, number> = {
  PT: 8, ES: 12, FR: 14, DE: 16, GB: 18, NL: 15, IT: 15,
};

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') ?? '';

  const [product, setProduct] = useState<Awaited<ReturnType<typeof getProductById>>>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [technique, setTechnique] = useState('dtf');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [address, setAddress] = useState({ name: '', street: '', city: '', postalCode: '', country: 'PT' });
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load product from Supabase
  useEffect(() => {
    if (!productId) return;
    getProductById(productId).then((p) => {
      setProduct(p);
      const first = p?.variants?.find((v) => v.stock > 0) ?? p?.variants?.[0];
      if (first) setSelectedVariant(first.id);
    });
  }, [productId]);

  // Compute pricing client-side (no API call needed)
  const pricing = useCallback(() => {
    const tech = TECHNIQUES.find((t) => t.id === technique)!;
    const shipping = SHIPPING_RATES[address.country] ?? 14;
    const base = 0; // prices are 0 (RFQ model) — keep consistent with catalog
    const printCost = tech.baseCost * quantity;
    return buildPricingBreakdown(base, printCost, shipping);
  }, [technique, quantity, address.country]);

  // Artwork upload to Supabase Storage
  async function handleArtworkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArtworkUploading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }

    const path = `artwork/${user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error: uploadError, data } = await supabase.storage
      .from('artwork')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setError('Erro ao fazer upload da arte: ' + uploadError.message);
      setArtworkUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('artwork').getPublicUrl(data.path);
    setArtworkUrl(urlData.publicUrl);
    setArtworkUploading(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    // Get client record
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!client) { setError('Conta de cliente não encontrada. Contacta o suporte.'); setSubmitting(false); return; }

    const ref = generateOrderRef();
    const p = pricing();
    const variant = product?.variants?.find((v) => v.id === selectedVariant);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        ref,
        client_id: client.id,
        status: 'pending',
        shipping_address: address,
        total_amount: p.total,
        supplier: 'midocean',
      })
      .select('id, ref')
      .single();

    if (orderError || !order) {
      setError('Erro ao criar encomenda: ' + (orderError?.message ?? 'unknown'));
      setSubmitting(false);
      return;
    }

    // Insert order item
    if (product && selectedVariant) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        variant_id: selectedVariant,
        quantity,
        unit_price: p.total / quantity,
      });
    }

    router.push(`/dashboard?order=${order.ref}`);
  }

  const tech = TECHNIQUES.find((t) => t.id === technique)!;
  const variant = product?.variants?.find((v) => v.id === selectedVariant);
  const p = pricing();

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

  const image = product.images?.[0] ?? product.variants?.[0]?.images?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900">your<span className="text-brand-600">gift</span></Link>
          <div className="hidden md:flex items-center gap-1 text-sm">
            {['Produto', 'Personalização', 'Entrega', 'Confirmar'].map((s, i) => (
              <span key={s} className="flex items-center">
                {i > 0 && <span className="text-gray-200 mx-2">→</span>}
                <span className={`font-medium ${step === i + 1 ? 'text-brand-600' : step > i + 1 ? 'text-green-500' : 'text-gray-300'}`}>
                  {step > i + 1 ? '✓' : s}
                </span>
              </span>
            ))}
          </div>
          <Link href={`/products/${productId}`} className="text-sm text-gray-400 hover:text-gray-600">← Produto</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* STEP 1 */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
              {image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={image} alt={product.title} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                : <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">🎁</div>
              }
            </div>
            <div>
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-2">{product.supplierRef}</p>
              <h1 className="text-2xl font-black text-gray-900 mb-3">{product.title}</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed line-clamp-3">{product.description}</p>

              {/* Variant picker */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Variante / Cor</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {product.variants?.map((v) => (
                    <button key={v.id} type="button" onClick={() => setSelectedVariant(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selectedVariant === v.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      } ${v.stock === 0 ? 'opacity-40' : ''}`}>
                      {v.color ?? v.sku}
                      {v.stock > 0 && <span className="ml-1 text-green-500 text-[10px]">●</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Quantidade</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setQuantity(Math.max(tech.min, quantity - 10))}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 hover:bg-gray-50 font-bold text-lg transition-colors">−</button>
                  <input type="number" value={quantity} min={tech.min}
                    onChange={(e) => setQuantity(Math.max(tech.min, parseInt(e.target.value) || tech.min))}
                    className="w-24 text-center border border-gray-200 rounded-xl py-2.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button type="button" onClick={() => setQuantity(quantity + 10)}
                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 hover:bg-gray-50 font-bold text-lg transition-colors">+</button>
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)} disabled={!selectedVariant}
                className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40 text-base">
                Continuar → Personalização
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Personalização</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <label className="block text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">Técnica de impressão</label>
              <div className="space-y-2">
                {TECHNIQUES.map((t) => (
                  <label key={t.id} className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border transition-all ${
                    technique === t.id ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="technique" value={t.id} checked={technique === t.id}
                      onChange={() => { setTechnique(t.id); setQuantity(Math.max(t.min, quantity)); }}
                      className="accent-brand-600" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Mín. {t.min} un.</span>
                      <span className="ml-3 text-xs font-medium text-brand-600">+{formatPrice(t.baseCost)}/un.</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <label className="block text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">Arte / Ficheiro</label>
              {artworkUrl ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <span className="text-green-600 text-xl">✓</span>
                  <div className="flex-1">
                    <p className="text-sm text-green-700 font-semibold">Arte carregada</p>
                    <p className="text-xs text-green-600 truncate">{artworkUrl.split('/').pop()}</p>
                  </div>
                  <button type="button" onClick={() => setArtworkUrl('')}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remover</button>
                </div>
              ) : (
                <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  artworkUploading ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
                }`}>
                  <input type="file" accept=".pdf,.ai,.png,.jpg,.jpeg,.svg,.eps" onChange={handleArtworkUpload} className="hidden" disabled={artworkUploading} />
                  {artworkUploading ? (
                    <><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-sm text-brand-600">A fazer upload...</p></>
                  ) : (
                    <><div className="text-3xl mb-2">🎨</div>
                    <p className="text-sm font-semibold text-gray-700">Clica para fazer upload da arte</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, AI, PNG, SVG, EPS — max 50MB</p></>
                  )}
                </label>
              )}
            </div>

            {/* Price estimate */}
            <div className="bg-brand-50 rounded-2xl border border-brand-100 p-5 mb-6">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-3">Estimativa ({quantity} un. · {tech.label})</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-brand-800"><span>Impressão</span><span>{formatPrice(p.printCost)}</span></div>
                <div className="flex justify-between text-brand-800"><span>Envio ({address.country})</span><span>{formatPrice(p.shippingCost)}</span></div>
                <div className="flex justify-between text-brand-800"><span>IVA (23%)</span><span>{formatPrice(p.tax)}</span></div>
                <div className="flex justify-between font-bold text-brand-900 text-base pt-2 border-t border-brand-200">
                  <span>Total estimado</span><span>{formatPrice(p.total)}</span>
                </div>
              </div>
              <p className="text-xs text-brand-500 mt-2">* Preço produto sob consulta. Total final calculado após confirmação de arte.</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">← Voltar</button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors">
                Continuar → Entrega
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Morada de entrega</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">Nome / Empresa *</label>
                <input type="text" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} required
                  placeholder="Empresa Lda."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">Morada *</label>
                <input type="text" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required
                  placeholder="Rua Exemplo, 123"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">Cidade *</label>
                  <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required
                    placeholder="Lisboa"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">Cód. Postal *</label>
                  <input type="text" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} required
                    placeholder="1000-001"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">País *</label>
                <select value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="ES">🇪🇸 Espanha</option>
                  <option value="FR">🇫🇷 França</option>
                  <option value="DE">🇩🇪 Alemanha</option>
                  <option value="GB">🇬🇧 Reino Unido</option>
                  <option value="NL">🇳🇱 Holanda</option>
                  <option value="IT">🇮🇹 Itália</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">← Voltar</button>
              <button type="button" onClick={() => setStep(4)} disabled={!address.name || !address.street || !address.city || !address.postalCode}
                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40">
                Continuar → Confirmar
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-gray-900 mb-8">Confirmar encomenda</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 space-y-5">
              <div className="flex gap-4">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={product.title} referrerPolicy="no-referrer" className="w-20 h-20 rounded-xl object-cover bg-gray-50 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{product.title}</p>
                  <p className="text-sm text-gray-500">{variant?.color && `${variant.color} · `}{quantity} unidades</p>
                  <p className="text-sm text-gray-500">{tech.label}</p>
                  {artworkUrl && <p className="text-xs text-green-600 mt-1">✓ Arte incluída</p>}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Entrega</p>
                <p className="text-sm text-gray-700">{address.name}</p>
                <p className="text-sm text-gray-700">{address.street}, {address.city} {address.postalCode}</p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between text-gray-500"><span>Impressão + portes + IVA</span><span>{formatPrice(p.printCost + p.shippingCost + p.tax)}</span></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total estimado</span>
                  <span className="text-2xl font-black text-brand-700">{formatPrice(p.total)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Preço produto sob consulta — fatura final após aprovação de arte.</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors">← Voltar</button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 text-base">
                {submitting ? 'A processar...' : 'Confirmar encomenda →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense>
      <NewOrderForm />
    </Suspense>
  );
}
