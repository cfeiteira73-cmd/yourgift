import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';

async function getFeaturedProducts() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/featured`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getCategories() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/categories`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const STATS = [
  { value: '2.428+', label: 'Produtos em catálogo' },
  { value: '5–10', label: 'Dias úteis entrega EU' },
  { value: '€0', label: 'Setup para DTF e laser' },
  { value: '100%', label: 'Rastreio em tempo real' },
];

const TECHNIQUES = [
  { name: 'Bordado', desc: 'Alta durabilidade. Ideal para fatos e bonés.', min: '12 un.', icon: '🪡' },
  { name: 'DTF', desc: 'Full color sem mínimo. Perfeito para t-shirts.', min: '1 un.', icon: '🖨️' },
  { name: 'Laser', desc: 'Gravação permanente em metal e couro.', min: '1 un.', icon: '⚡' },
  { name: 'Pad Printing', desc: 'Económico em grandes volumes.', min: '50 un.', icon: '🔵' },
];

export default async function HomePage() {
  const [featured, categories] = await Promise.all([getFeaturedProducts(), getCategories()]);

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-gray-900">
            your<span className="text-brand-600">gift</span>
          </span>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/products" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Catálogo</Link>
            <Link href="#techniques" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Técnicas</Link>
            <Link href="#how" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Como funciona</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">Entrar</Link>
            <Link href="/auth/register" className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium">
              Criar conta
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-24 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-brand-100">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
          2.428 produtos Midocean em stock real
        </div>
        <h1 className="text-6xl md:text-7xl font-black text-gray-900 leading-[1.05] mb-6">
          Merchandising B2B<br />
          <span className="text-brand-600">sem compromisso.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload da arte → escolhe o produto → paga → entregamos em toda a Europa.
          Bordado, DTF, laser — tudo numa plataforma.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/products" className="bg-brand-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-200">
            Ver catálogo completo →
          </Link>
          <Link href="/auth/register" className="border border-gray-200 text-gray-700 px-8 py-4 rounded-xl text-base font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors">
            Criar conta grátis
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-gray-900 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="py-20 px-6 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">Catálogo Midocean live</p>
              <h2 className="text-3xl font-black text-gray-900">Produtos em destaque</h2>
            </div>
            <Link href="/products" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {featured.slice(0, 8).map((product: any) => {
              const minPrice = product.variants?.[0]?.price ?? product.basePrice;
              const image = product.images?.[0];
              return (
                <Link key={product.id} href={`/products/${product.id}`} className="group bg-gray-50 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {image
                      ? <img src={image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🎁</div>
                    }
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-400 mb-1 truncate">{product.category}</p>
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-2 line-clamp-2">{product.title}</h3>
                    <p className="text-brand-700 font-bold text-sm">
                      {minPrice > 0 ? `A partir de ${formatPrice(minPrice)}` : 'Consultar preço'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section className="py-12 px-6 max-w-7xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Navegar por categoria</h2>
          <div className="flex flex-wrap gap-3">
            {categories.slice(0, 24).map((cat: string) => (
              <Link key={cat} href={`/products?category=${encodeURIComponent(cat)}`}
                className="px-4 py-2 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 text-sm rounded-lg font-medium transition-colors">
                {cat}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TECHNIQUES */}
      <section id="techniques" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">Personalização</p>
            <h2 className="text-3xl font-black text-gray-900">Técnicas de impressão</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TECHNIQUES.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-brand-200 transition-colors">
                <div className="text-3xl mb-4">{t.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t.name}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t.desc}</p>
                <span className="inline-block bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full">Mín. {t.min}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">Processo</p>
          <h2 className="text-3xl font-black text-gray-900">Como funciona</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Escolhe o produto', desc: '2.428+ artigos Midocean com stock em tempo real.' },
            { step: '02', title: 'Faz upload da arte', desc: 'PDF, AI ou PNG. Geramos o mockup instantaneamente.' },
            { step: '03', title: 'Confirma e paga', desc: 'Stripe seguro. Fatura automática em EUR.' },
            { step: '04', title: 'Produzimos e enviamos', desc: 'Midocean produz e envia. Rastreio em tempo real.' },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="text-5xl font-black text-brand-100 mb-3">{s.step}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-brand-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">Pronto para começar?</h2>
          <p className="text-brand-100 text-lg mb-8">Cria a tua conta grátis e faz a primeira encomenda hoje.</p>
          <Link href="/auth/register" className="inline-block bg-white text-brand-700 px-8 py-4 rounded-xl text-base font-bold hover:bg-brand-50 transition-colors">
            Criar conta grátis →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-lg font-black text-gray-900">your<span className="text-brand-600">gift</span></span>
          <p className="text-sm text-gray-400">© {new Date().getFullYear()} YourGift. Merchandising B2B Premium.</p>
          <div className="flex gap-6">
            <Link href="/products" className="text-sm text-gray-500 hover:text-gray-900">Catálogo</Link>
            <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
