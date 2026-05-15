import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <span className="text-xl font-bold text-brand-700">YourGift</span>
        <div className="flex gap-4">
          <Link href="/products" className="text-gray-600 hover:text-brand-600 transition-colors">
            Produtos
          </Link>
          <Link
            href="/auth/login"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-8 py-24 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
          Merchandising B2B{' '}
          <span className="text-brand-600">Premium</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Artigos personalizados com a sua marca. Bordado, DTF, laser — entregues em toda a Europa.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/products"
            className="bg-brand-600 text-white px-8 py-3 rounded-xl text-lg font-semibold hover:bg-brand-700 transition-colors"
          >
            Ver Catalogo
          </Link>
          <Link
            href="/auth/register"
            className="border border-brand-600 text-brand-600 px-8 py-3 rounded-xl text-lg font-semibold hover:bg-brand-50 transition-colors"
          >
            Criar Conta
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-24 grid grid-cols-3 gap-8">
        {[
          { icon: '🎨', title: 'Personalizacao Total', desc: 'Upload da arte, escolha a tecnica e visualize o mockup em segundos.' },
          { icon: '⚡', title: 'Producao Rapida', desc: 'Ligacao direta a Midocean e PF Concept para prazos de 5-10 dias uteis.' },
          { icon: '💳', title: 'Pagamento Seguro', desc: 'Stripe integrado com faturas automaticas em EUR.' },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
