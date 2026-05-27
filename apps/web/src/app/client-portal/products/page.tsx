'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
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
  images: string[] | null;
  tags: string[] | null;
  supplier: string | null;
}

// Midocean CDN images are real — use first image in array
function productImage(p: Product): string | null {
  return p.images && p.images.length > 0 ? p.images[0] : null;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Vestuário': '👕',
  'Tecnologia': '💻',
  'Escritório': '✏️',
  'Alimentação & Bebidas': '🍷',
  'Sacos & Embalagem': '🛍️',
  'Casa & Lifestyle': '🏠',
  'Natal & Datas Especiais': '🎁',
  'Desporto & Outdoor': '⚽',
  'Bem-estar': '🧘',
  'Sustentável': '🌿',
  'Brindes & Merchandising': '🎀',
  'Todos': '✨',
};

export default function ClientProductsPage() {
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [quoteProduct, setQuoteProduct] = useState<Product | null>(null);
  const [quoteQty, setQuoteQty] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sentQuote, setSentQuote] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 24;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/client-portal/products'); return; }
      setUserEmail(user.email ?? '');
      const { data: c } = await supabase.from('clients').select('id,name,company,tier').eq('auth_user_id', user.id).single();
      if (c) {
        setClient(c);
        // Load from products_catalog view (has human-readable categories + correct column names)
        const { data: prods } = await supabase
          .from('products_catalog')
          .select('id,name,description,category,unit_price,min_qty,images,tags,supplier')
          .order('name')
          .limit(500);
        if (prods && prods.length > 0) {
          setProducts(prods as Product[]);
          // Extract unique categories
          const cats = ['Todos', ...Array.from(new Set(prods.map((p: any) => p.category).filter(Boolean))).sort()];
          setCategories(cats as string[]);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchCat = filter === 'Todos' || p.category === filter;
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, filter, search]);

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Reset page when filter/search changes
  useEffect(() => { setPage(0); }, [filter, search]);

  async function handleQuoteRequest() {
    if (!quoteProduct || !client) return;
    setSendingQuote(true);
    const supabase = createClient();
    const ref = `#YGQ-${Date.now().toString().slice(-6)}`;
    await supabase.from('quotes').insert({
      client_id: client.id,
      ref,
      status: 'submitted',
      notes: `Produto: ${quoteProduct.name} | Fornecedor: ${quoteProduct.supplier ?? 'n/a'} | Qtd: ${quoteQty || 'a definir'} | Notas: ${quoteNotes || 'sem observações'}`,
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
      <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1100px' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'rgb(245,247,251)', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>Catálogo de Produtos</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgb(80,92,110)' }}>
            {loading ? 'A carregar catálogo...' : `${products.length.toLocaleString('pt-PT')} produtos disponíveis · pede orçamento para qualquer artigo`}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={{ marginBottom: '1rem' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Pesquisar produtos, categorias..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.625rem 1rem', fontSize: '0.82rem', color: 'rgb(220,230,245)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </motion.div>

        {/* Category filters */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => setFilter(cat)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: filter === cat ? 600 : 400, cursor: 'pointer', background: filter === cat ? 'rgba(77,163,255,0.14)' : 'rgba(255,255,255,0.04)', color: filter === cat ? 'rgb(77,163,255)' : 'rgb(120,130,150)', border: filter === cat ? '1px solid rgba(77,163,255,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem' }}>{CATEGORY_ICONS[cat] ?? '📦'}</span> {cat}
            </button>
          ))}
        </div>

        {/* Results info */}
        {(search || filter !== 'Todos') && (
          <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', marginBottom: '0.875rem' }}>
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''} {search && `para "${search}"`} {filter !== 'Todos' && `em ${filter}`}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.75rem' }}>
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} style={{ height: '280px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(80,92,110)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
            <div style={{ fontSize: '0.85rem' }}>Nenhum produto encontrado</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.75rem' }}>
              {paginated.map((p, i) => {
                const imgUrl = productImage(p);
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 200ms' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}>
                    {/* Image */}
                    <div style={{ height: '130px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }} loading="lazy" />
                      ) : (
                        <span style={{ fontSize: '2.5rem' }}>{CATEGORY_ICONS[p.category ?? ''] ?? '📦'}</span>
                      )}
                    </div>
                    <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgb(215,225,245)', lineHeight: 1.3 }}>{p.name}</div>
                        <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'rgb(77,163,255)', background: 'rgba(77,163,255,0.1)', borderRadius: '4px', padding: '0.1rem 0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.category}</span>
                      </div>
                      {p.description && (
                        <div style={{ fontSize: '0.62rem', color: 'rgb(100,112,130)', lineHeight: 1.4, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' as const }}>{p.description}</div>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                          {p.tags.slice(0, 3).map(tag => (
                            <span key={tag} style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', padding: '0.1rem 0.3rem' }}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.375rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          {p.unit_price && p.unit_price > 0 ? (
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgb(99,230,190)' }}>€{p.unit_price.toFixed(2)}/un</div>
                          ) : (
                            <div style={{ fontSize: '0.65rem', color: 'rgb(80,92,110)', fontStyle: 'italic' }}>Preço sob consulta</div>
                          )}
                          {p.min_qty && p.min_qty > 1 && (
                            <div style={{ fontSize: '0.55rem', color: 'rgb(80,92,110)' }}>Mín. {p.min_qty} un.</div>
                          )}
                        </div>
                        <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setQuoteProduct(p)}
                          style={{ background: 'linear-gradient(135deg,rgb(77,163,255),rgb(116,100,255))', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.35rem 0.625rem', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Orçamento
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(140,155,175)', fontSize: '0.75rem', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)' }}>
                  Página {page + 1} de {totalPages} · {filtered.length} produtos
                </span>
                <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '0.4rem 0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgb(140,155,175)', fontSize: '0.75rem', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}

        {/* Quote modal */}
        <AnimatePresence>
          {quoteProduct && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
              onClick={e => { if (e.target === e.currentTarget) setQuoteProduct(null); }}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                style={{ background: 'rgb(10,20,38)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '460px' }}>
                {sentQuote ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgb(99,230,190)', marginBottom: '0.375rem' }}>Pedido enviado!</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgb(100,112,130)' }}>Referência: <span style={{ color: 'rgb(77,163,255)', fontWeight: 600 }}>{sentQuote}</span></div>
                    <div style={{ fontSize: '0.72rem', color: 'rgb(80,92,110)', marginTop: '0.375rem' }}>A nossa equipa contacta-te brevemente com uma proposta.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.125rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgb(225,235,250)' }}>Pedir Orçamento</h3>
                      <button type="button" onClick={() => setQuoteProduct(null)} style={{ background: 'none', border: 'none', color: 'rgb(80,92,110)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>

                    {/* Product preview */}
                    <div style={{ background: 'rgba(77,163,255,0.06)', border: '1px solid rgba(77,163,255,0.15)', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '52px', height: '52px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {productImage(quoteProduct) ? (
                          <img src={productImage(quoteProduct)!} alt={quoteProduct.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '1.5rem' }}>{CATEGORY_ICONS[quoteProduct.category ?? ''] ?? '📦'}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgb(200,215,235)' }}>{quoteProduct.name}</div>
                        <div style={{ fontSize: '0.62rem', color: 'rgb(77,163,255)', marginTop: '0.15rem' }}>{quoteProduct.category}</div>
                        {quoteProduct.unit_price && quoteProduct.unit_price > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'rgb(99,230,190)', marginTop: '0.1rem' }}>a partir de €{quoteProduct.unit_price.toFixed(2)}/un</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                      {[
                        { label: 'Quantidade desejada', key: 'qty', value: quoteQty, onChange: setQuoteQty, placeholder: 'Ex: 200 unidades', type: 'text' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                          <input value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'rgb(220,230,245)', outline: 'none', boxSizing: 'border-box' }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(77,163,255,0.4)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                        </div>
                      ))}
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgb(100,112,130)', display: 'block', marginBottom: '0.3rem' }}>Observações (cores, logótipo, prazo...)</label>
                        <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} placeholder="Ex: Cor pantone 2728C, bordado frente, prazo urgente..." rows={3}
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
