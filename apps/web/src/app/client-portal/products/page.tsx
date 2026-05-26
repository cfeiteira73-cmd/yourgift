'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  min_qty: number | null;
  unit_price: number | null;
  image_url: string | null;
  tags: string[] | null;
}

const CATEGORIES = ['Todos', 'Vestuário', 'Tecnologia', 'Escritório', 'Alimentação', 'Brindes', 'Embalagem'];

const SAMPLE_PRODUCTS: Product[] = [
  { id: '1', name: 'T-Shirt Premium Algodão', description: 'T-shirt 100% algodão com bordado ou serigrafia. Disponível em todas as cores e tamanhos.', category: 'Vestuário', min_qty: 50, unit_price: 8.50, image_url: null, tags: ['bordado', 'serigrafia', 'personalizado'] },
  { id: '2', name: 'Caneta Metal Slim', description: 'Caneta esferográfica em metal com gravação laser. Elegante e duradoura, ideal para eventos corporativos.', category: 'Escritório', min_qty: 100, unit_price: 2.80, image_url: null, tags: ['gravação laser', 'metal', 'corporativo'] },
  { id: '3', name: 'Powerbank 10000mAh', description: 'Powerbank compacto com logótipo em relevo. Inclui cabo USB-C e indicador LED de bateria.', category: 'Tecnologia', min_qty: 25, unit_price: 18.90, image_url: null, tags: ['tech', 'carregamento', 'USB-C'] },
  { id: '4', name: 'Saco Tote Canvas', description: 'Saco de algodão canvas 350g/m² com impressão a 1 ou 4 cores. Sustentável e reutilizável.', category: 'Brindes', min_qty: 100, unit_price: 4.20, image_url: null, tags: ['eco', 'canvas', 'impressão'] },
  { id: '5', name: 'Caneca Cerâmica 350ml', description: 'Caneca em cerâmica com sublimação full-wrap. Ideal para campanhas internas ou ofertas a clientes.', category: 'Brindes', min_qty: 50, unit_price: 5.60, image_url: null, tags: ['cerâmica', 'sublimação', 'caneca'] },
  { id: '6', name: 'Moleskine Personalizado', description: 'Caderno tipo Moleskine A5 com capa gravada a laser ou impressa. 120 folhas pautadas.', category: 'Escritório', min_qty: 50, unit_price: 9.90, image_url: null, tags: ['caderno', 'gravação', 'A5'] },
  { id: '7', name: 'Polo Piqué Corporate', description: 'Polo em piqué 220g/m² com bordado até 10.000 pontos. Corte regular fit em 12 cores disponíveis.', category: 'Vestuário', min_qty: 24, unit_price: 14.50, image_url: null, tags: ['polo', 'bordado', 'corporate'] },
  { id: '8', name: 'Caixa Gift Premium', description: 'Caixa de oferta premium com fita e papel de seda personalizados. Ideal para kits corporativos.', category: 'Embalagem', min_qty: 25, unit_price: 6.80, image_url: null, tags: ['caixa', 'gift', 'premium'] },
  { id: '9', name: 'Kit Wellness Office', description: 'Kit com garrafa de água, bloco de notas e caneta. Embalagem premium com personalização completa.', category: 'Brindes', min_qty: 20, unit_price: 24.90, image_url: null, tags: ['kit', 'wellness', 'garrafa'] },
  { id: '10', name: 'Pen Drive USB 3.0 32GB', description: 'Pen drive metálico USB 3.0 com gravação laser do logótipo. Transferência rápida e design premium.', category: 'Tecnologia', min_qty: 50, unit_price: 7.40, image_url: null, tags: ['USB', 'gravação', '32GB'] },
  { id: '11', name: 'Cesto Gourmet Natal', description: 'Cesto de Natal personalizado com produtos gourmet portugueses. Composição ajustável ao orçamento.', category: 'Alimentação', min_qty: 10, unit_price: 45.00, image_url: null, tags: ['natal', 'gourmet', 'cesto'] },
  { id: '12', name: 'Sweatshirt Hoodie', description: 'Sweatshirt com capuz em fleece 300g/m². Bordado ou serigrafia até 30×30cm. Unissex.', category: 'Vestuário', min_qty: 30, unit_price: 22.00, image_url: null, tags: ['hoodie', 'fleece', 'unissex'] },
];

const CATEGORY_ICONS: Record<string, string> = {
  'Vestuário': '👕', 'Tecnologia': '💻', 'Escritório': '✏️',
  'Alimentação': '🍷', 'Brindes': '🎁', 'Embalagem': '📦', 'Todos': '🛍️',
};

export default function ClientProductsPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>(SAMPLE_PRODUCTS);
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);
  const [quoteQty, setQuoteQty] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sentQuote, setSentQuote] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/products'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        // Try to load real products from DB, fall back to sample
        const { data: prods } = await supabase.from('products').select('id,name,description,category,min_qty,unit_price,image_url,tags').eq('active', true).order('name');
        if (prods && prods.length > 0) setProducts(prods as Product[]);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = products.filter(p => {
    const matchCat = filter === 'Todos' || p.category === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  async function handleQuoteRequest() {
    if (!quoteProduct || !client) return;
    setSendingQuote(true);
    const supabase = createClient();
    const ref = `#YGQ-${Date.now().toString().slice(-6)}`;
    await supabase.from('quotes').insert({
      client_id: client.id,
      ref,
      status: 'submitted',
      notes: `Produto: ${quoteProduct.name} | Qtd: ${quoteQty || 'a definir'} | Notas: ${quoteNotes || 'sem observações'}`,
    });
    setSentQuote(ref);
    setSendingQuote(false);
    setTimeout(() => {
      setQuoteProduct(null);
      setQuoteQty('');
      setQuoteNotes('');
      setSentQuote('');
    }, 2500);
  }

  return (
    <ClientPortalLayout userName={client?.name} userEmail={userEmail} companyName={client?.company}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '960px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Catálogo de Produtos</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>Explora o nosso catálogo e pede orçamento para qualquer artigo</p>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={{ marginBottom: '1rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Pesquisar produtos, categorias ou tags..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.625rem 1rem', fontSize: '0.82rem', color: 'rgb(220,230,245)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </motion.div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} type="button" onClick={() => setFilter(cat)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: filter === cat ? 600 : 400, cursor: 'pointer', background: filter === cat ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: filter === cat ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: filter === cat ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem' }}>{CATEGORY_ICONS[cat] ?? '📦'}</span> {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        {search && (
          <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', marginBottom: '0.875rem' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "<span style={{ color: 'rgb(77,163,255)' }}>{search}</span>"
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '0.75rem' }}>
            {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: '200px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(80,92,110)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
            <div style={{ fontSize: '0.85rem' }}>Nenhum produto encontrado</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '0.75rem' }}>
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Image placeholder */}
                <div style={{ height: '100px', background: 'rgba(77,163,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                  {CATEGORY_ICONS[p.category ?? ''] ?? '📦'}
                </div>
                <div style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgb(215,225,245)', lineHeight: 1.3 }}>{p.name}</div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.1)', borderRadius: '6px', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.category}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'rgb(100,112,130)', lineHeight: 1.45, flex: 1 }}>{p.description}</div>
                  {p.tags && p.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {p.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      {p.unit_price && <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'rgb(99,230,190)' }}>a partir de €{p.unit_price.toFixed(2)}/un</div>}
                      {p.min_qty && <div style={{ fontSize: '0.58rem', color: 'rgb(80,92,110)' }}>Mín. {p.min_qty} unidades</div>}
                    </div>
                    <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setQuoteProduct(p)}
                      style={{ background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Pedir Orçamento
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quote modal */}
        <AnimatePresence>
          {quoteProduct && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
              onClick={e => { if (e.target === e.currentTarget) setQuoteProduct(null); }}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                style={{ background: 'rgb(12,22,40)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '440px' }}>
                {sentQuote ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(99,230,190)', marginBottom: '0.375rem' }}>Pedido enviado!</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgb(100,112,130)' }}>Referência: <span style={{ color: 'rgb(77,163,255)', fontWeight: 600 }}>{sentQuote}</span></div>
                    <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', marginTop: '0.375rem' }}>A nossa equipa entrará em contacto brevemente.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.125rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgb(225,235,250)' }}>Pedir Orçamento</h3>
                      <button type="button" onClick={() => setQuoteProduct(null)} style={{ background: 'none', border: 'none', color: 'rgb(80,92,110)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ background: 'rgba(77,163,255,0.06)', border: '1px solid rgba(77,163,255,0.15)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{quoteProduct.name}</div>
                      {quoteProduct.unit_price && <div style={{ fontSize: '0.65rem', color: 'rgb(99,230,190)', marginTop: '0.2rem' }}>a partir de €{quoteProduct.unit_price.toFixed(2)}/un · mín. {quoteProduct.min_qty} un.</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>Quantidade desejada</label>
                        <input value={quoteQty} onChange={e => setQuoteQty(e.target.value)} placeholder="Ex: 200 unidades"
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'rgb(220,230,245)', outline: 'none', boxSizing: 'border-box' }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>Observações (cores, logótipo, prazo...)</label>
                        <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} placeholder="Ex: Cor azul pantone 2728, bordado frente, entrega urgente..." rows={3}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'rgb(220,230,245)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setQuoteProduct(null)} style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(140,155,175)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                      <button type="button" onClick={handleQuoteRequest} disabled={sendingQuote}
                        style={{ padding: '0.5rem 1.125rem', borderRadius: '8px', background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', border: 'none', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700, opacity: sendingQuote ? 0.7 : 1 }}>
                        {sendingQuote ? 'A enviar...' : 'Enviar Pedido'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ClientPortalLayout>
  );
}
