import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Corporate Gifts, Branded Merch & Company Stores — 20.000+ Produtos | yourgift.pt',
  description:
    'Plataforma premium B2B de corporate gifts, branded merchandise, packaging personalizado e company stores para empresas em Portugal. 20.000+ produtos, 312 clientes activos, resposta em 48h garantida.',
};

// ─── Cinematic Luxury Gifting — Stitch Visual Design ────────────────────────
// Design system: #0d0d0d bg · #c5a059 gold · #161616 surface · #a5a5a5 secondary
// Fonts: Playfair Display (display) · Source Serif 4 (body) · Montserrat (label)

export default function HomePage() {
  return (
    <div className="bg-[#0d0d0d] text-[#f2f0f0]" style={{ fontFamily: 'var(--font-source-serif), serif' }}>

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative h-[85vh] flex items-center overflow-hidden">
        <img
          alt="Premium Corporate Gifts"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.55)' }}
          src="https://lh3.googleusercontent.com/aida/AP1WRLv4DB1qwl6EmiXugehn0RAPSqhUbq1yehWauaSifQMGz63qoLzpMjq_YLlMo_qSK7o5OEtGV9fHprutGU5bPnyrHJsDeC_oOdFGSblDrrJJ4vjPQ036T0mVMVvsela2WwSrPOV5h42TwhYeVlI4t6Xw7aFz4Sm_GerCV-Ntx-iorMiacHbAepV6XmOR36deNC-WXLSaxQKf2OwDZNtVRO_6iN8EXdZQV9s3LD-TEVVDjrlh5OkZMyvaGg"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.2) 50%, transparent 100%)' }} />
        <div className="relative z-10 px-6 w-full mt-20">
          <p className="text-[#c5a059] uppercase text-[10px] tracking-[0.4em] mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
            Plataforma B2B premium · Portugal
          </p>
          <h2 className="text-4xl leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>
            Merch que a tua equipa vai querer usar. Branding que os clientes vão lembrar.
          </h2>
          <p className="text-[#a5a5a5] text-sm leading-relaxed mb-8 max-w-sm">
            Transformamos pedidos complexos em produtos que as empresas se orgulham de oferecer. Da proposta ao fulfillment — com mockup gratuito em 24h e gestor dedicado.
          </p>
          <div className="flex flex-col gap-4">
            <Link
              href="/rfq"
              className="block text-center py-5 text-[#131313] text-[10px] uppercase tracking-[0.2em]"
              style={{ background: 'linear-gradient(135deg, #c5a059 0%, #e9c176 100%)', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}
            >
              Pedir Proposta Gratuita
            </Link>
            <p className="text-[10px] text-[#a5a5a5] uppercase tracking-widest text-center" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
              Mockup gratuito incluído · Resposta em 48h garantida
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust Banner ────────────────────────────────────────────────── */}
      <section className="py-8 bg-[#161616] border-y border-[#3a3a3a]/30 px-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2 text-[#c5a059] text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
            <span className="material-symbols-outlined text-sm">notification_important</span>
            6 propostas disponíveis esta semana — restam 2
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 opacity-60">
            <span className="text-[8px] uppercase tracking-tighter" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>Equipa certificada ISO 9001</span>
            <span className="text-[8px] uppercase tracking-tighter" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>Parceiros internacionais verificados</span>
            <span className="text-[8px] uppercase tracking-tighter" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>Mockup gratuito em 24h</span>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <section className="py-16 grid grid-cols-2 gap-y-12 px-6 bg-[#0d0d0d]">
        {[
          { value: '312+', label: 'Clientes Activos' },
          { value: '20.000+', label: 'Produtos' },
          { value: '48h', label: 'Resposta Garantida' },
          { value: '98%', label: 'Satisfação' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl text-[#c5a059] mb-1" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>{stat.value}</p>
            <p className="text-[9px] text-[#a5a5a5] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>{stat.label}</p>
          </div>
        ))}
      </section>

      {/* ── Categories Nav ──────────────────────────────────────────────── */}
      <section className="py-12 bg-[#161616]">
        <div className="px-6 mb-8">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Categorias</span>
          <h3 className="text-2xl mt-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Explora o Catálogo</h3>
        </div>
        <div className="flex overflow-x-auto gap-6 px-6 pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { icon: 'checkroom', label: 'Apparel', href: '/branded-merch' },
            { icon: 'menu_book', label: 'Notebooks', href: '/catalog?cat=notebooks' },
            { icon: 'local_cafe', label: 'Drinkware', href: '/catalog?cat=drinkware' },
            { icon: 'devices', label: 'Tech', href: '/catalog?cat=tech' },
            { icon: 'featured_seasonal_and_gifts', label: 'Gift Boxes', href: '/corporate-gifts' },
          ].map((cat) => (
            <Link key={cat.label} href={cat.href} className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-[#0d0d0d] border border-[#3a3a3a]/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#c5a059]">{cat.icon}</span>
              </div>
              <span className="text-[9px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────────────────── */}
      <section className="py-12 bg-[#0d0d0d] overflow-hidden border-y border-[#3a3a3a]/20">
        <p className="text-center text-[9px] text-[#a5a5a5] uppercase tracking-[0.3em] mb-8" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
          Confiado por 312+ empresas em Portugal
        </p>
        <div className="relative flex overflow-x-hidden">
          <div
            className="whitespace-nowrap flex items-center gap-12"
            style={{
              opacity: 0.4,
              filter: 'grayscale(1) invert(1) brightness(2)',
              animation: 'marquee 30s linear infinite',
            }}
          >
            {['GALP', 'EDP', 'SONAE', 'NOS', 'KPMG', 'TAP', 'MILLENNIUM BCP', 'SANTANDER',
              'GALP', 'EDP', 'SONAE', 'NOS', 'KPMG', 'TAP', 'MILLENNIUM BCP', 'SANTANDER'].map((name, i) => (
              <span key={i} className="text-xl" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>{name}</span>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </section>

      {/* ── Product Catalog ──────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Curadoria Premium</span>
            <h3 className="text-3xl mt-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Coleção Curada</h3>
          </div>
          <Link href="/catalog" className="text-[10px] text-[#a5a5a5] border-b border-[#a5a5a5] pb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>TODOS</Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12">
          {[
            {
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1LWyLx_46zTju3zvNIKrtVtvScaaYiHmgI4qT_Jcwk2oiNvYwK8Bn5-4c8jfUcwU_vfXl8VQ96eMo076IRj5h7ThjnC6HMrcM80XsOZGFHHlXLUMOa_qD3v5zOBHt4aePd4jv0g2pfTFaXHzAUY_01nDCcEIZDg1yX-xtu7AYO9Pm9Fib08v_hmjxrNAsUqIN86b_KXCKV1TPx2UZAEmiVlx67Icxma5PCJuZyL9KR6Ndv7FLekX1yQ_KHVZQfX-TwV8xVy8JKdc',
              badge: 'POPULAR', badgeClass: 'bg-[#c5a059]/90 text-[#131313]',
              name: 'Premium Leather Journal', price: 'A partir de €12 /un · MOQ 50'
            },
            {
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmvGbg1eVQuAaNiJRlh5pjtKp3L4EarB7Ki6YS645HrU5sBNI_m_xhMwG4h-Axyld1jjpKL0JjU68ufRDPzpAjGq7GtcFGSaxPQL0VQ6liCyg4xH1BwhWuR2wkpsSHIACQFaugjKZLOaHal5rO3xDlnZ3U5h3ok167hJ7K3JpHWzv78j6m6rr14slcWMIZoB5jdatJTaIdNl5yMUFLmJuJZoya8gr91ZZCsKW8z-6WpKrj3QzyLEhYxBIhyGvZYl-vXeqnHvGXa9g',
              badge: 'ECO', badgeClass: 'bg-green-900/90 text-white',
              name: 'Insulated Tumbler 500ml', price: 'A partir de €18 /un · MOQ 100'
            },
            {
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBVP4GSNIkg3Kr9Tg1srFxoXbB9qoIvxn068agY1_HSzHN0gQ1Vx1WFA_SC-IN9snen_64rJlhjPT4jI8fra8RwlK-iBhfHiPIb0Y_yIIrSx-ivYn451Tkcr2Ex4CZ5CBO-F35T8v_7u6bsmP0gMCgK081AolDPpxBt1qrF_OiWksZh8M6mTfOc5Cea9E_Q1snjpJ-WXJWzOx-eWcQnKxq-IS8y7LaH93vR9P02p1yXWqzRTwcjC8XXdo3EO4ZNEkcx0cc_-nEJcQ',
              badge: 'TECH', badgeClass: 'bg-[#c5a059]/90 text-[#131313]',
              name: 'Bamboo Tech Organizer', price: 'A partir de €22 /un · MOQ 25'
            },
            {
              img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCdSn6DwUiO_y2nDr5ydh1zASo9m9bsfgicJz-_c-UpFkssTYCI5Eeuo5H0gsmnnkf5VrHPW7cxOA9rFWKD-ftMuCkrZxmU5heGinSSIFfeySIvrs93yw3Bn-VLALi1H2DxjNJtJNosG0tlKfiSNazXZPgAFfVew0bYsaJvRWGZDZbECP7RbZjJpLJRhdYSCSPcdsA-kQKTKc2JiIpsuTrju0OeV6K08cKZMrs8PZJjAyRdtXnI9smpWGB8niPZn3NMebBydrucNO0',
              badge: 'ORGANIC', badgeClass: 'bg-green-900/90 text-white',
              name: 'Organic Cotton Tee', price: 'A partir de €9 /un · MOQ 50'
            },
          ].map((product) => (
            <div key={product.name}>
              <div className="relative mb-4 overflow-hidden border border-[#3a3a3a]/20" style={{ aspectRatio: '4/5', background: '#161616' }}>
                <img className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" src={product.img} alt={product.name} />
                <div className={`absolute top-2 left-2 ${product.badgeClass} px-2 py-1 text-[8px] tracking-widest`} style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
                  {product.badge}
                </div>
              </div>
              <h4 className="text-sm mb-1" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>{product.name}</h4>
              <p className="text-[10px] text-[#a5a5a5]">{product.price}</p>
            </div>
          ))}
        </div>
        <Link href="/catalog" className="block w-full mt-12 py-5 border border-[#c5a059] text-[#c5a059] text-center text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
          Ver Catálogo Completo
        </Link>
      </section>

      {/* ── Comparison ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#161616] px-6">
        <div className="text-center mb-16">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.4em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>A Mudança</span>
          <h3 className="text-3xl mt-4" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Deixa de perder tempo com fornecedores genéricos.</h3>
        </div>
        <div className="space-y-6">
          {/* Generic */}
          <div className="p-8 border border-[#ffb4ab]/20 bg-[#0d0d0d]/50">
            <div className="flex items-center gap-3 text-[#ffb4ab] mb-6">
              <span className="material-symbols-outlined">close</span>
              <h4 className="text-lg" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>Fornecedor genérico</h4>
            </div>
            <ul className="space-y-4 text-[#a5a5a5] text-xs leading-relaxed">
              {['Meses de emails para encontrar um fornecedor de confiança',
                'Mockups que não representam o produto real',
                'Preços opacos com taxas escondidas no final',
                'Prazos que se prolongam sem explicação',
                'Cada reorder começa do zero, sem histórico',
                'Sem visibilidade sobre o estado da produção',
                'Qualidade inconsistente lote a lote'].map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
          {/* yourgift.pt */}
          <div className="p-8 border border-[#c5a059]/30" style={{ background: 'rgba(197,160,89,0.05)' }}>
            <div className="flex items-center gap-3 text-[#c5a059] mb-6">
              <span className="material-symbols-outlined">check_circle</span>
              <h4 className="text-lg" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>yourgift.pt</h4>
            </div>
            <ul className="space-y-4 text-[#f2f0f0] text-xs leading-relaxed">
              {['Proposta em 48h, gestor dedicado que conhece a tua marca',
                'Mockup fotorrealista em 24h antes de qualquer produção',
                'Preços transparentes, sem surpresas — confirmados por escrito',
                'Prazos cumpridos com tracking em tempo real',
                'Reorder em 1 clique com todos os ficheiros guardados',
                'Dashboard com estado da produção em tempo real',
                'QC rigoroso em cada lote — consistência garantida'].map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#0d0d0d] overflow-hidden">
        <div className="px-6 mb-12">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Resultados Reais</span>
          <h3 className="text-3xl mt-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Histórias de Sucesso</h3>
        </div>
        <div className="flex overflow-x-auto gap-6 px-6 pb-8" style={{ scrollbarWidth: 'none' }}>
          {[
            { quote: '"Recebemos 500 onboarding kits personalizados em 12 dias úteis. Qualidade impecável, packaging premium e o nosso logo perfeito. A equipa reage sempre com entusiasmo quando recebe."', name: 'Ana Silva', role: 'Head of HR · Galp Energia' },
            { quote: '"Encomendar 1.200 t-shirts para o nosso evento anual foi surpreendentemente simples. Mockup aprovado em 24h, produção em 10 dias. Nunca mais trabalhámos com outra empresa."', name: 'Pedro Costa', role: 'Marketing Director · EDP' },
            { quote: '"O gestor dedicado foi um diferencial enorme. Acompanhou todo o processo, antecipou problemas e entregou antes do prazo. Os nossos clientes ficaram impressionados com os gift boxes."', name: 'Mariana Ferreira', role: 'Brand Manager · Sonae MC' },
            { quote: '"Já fizemos 3 encomendas este ano. O reorder system é fantástico — em 2 cliques repetimos a encomenda anterior com ajustes mínimos."', name: 'João Nunes', role: 'Procurement Manager · NOS' },
            { quote: '"Os nossos kits de boas-vindas elevaram completamente a experiência de onboarding. Feedback 100% positivo — \'é a empresa mais premium em que já trabalhei\'."', name: 'Sofia Rodrigues', role: 'People & Culture Lead · KPMG' },
            { quote: '"Para o nosso evento de fim de ano com 800 convidados, a yourgift.pt entregou 800 gift boxes premium dentro do prazo. Logística impecável."', name: 'Rui Alves', role: 'Events & Sponsorship · Millennium BCP' },
          ].map((t) => (
            <div key={t.name} className="flex-shrink-0 w-80 p-8 bg-[#161616] border border-[#3a3a3a]/30">
              <span className="material-symbols-outlined text-[#c5a059] text-4xl mb-6 block">format_quote</span>
              <p className="text-sm italic mb-8 leading-relaxed">{t.quote}</p>
              <div>
                <p className="text-[#c5a059]" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>{t.name}</p>
                <p className="text-[9px] text-[#a5a5a5] uppercase tracking-widest mt-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Solutions / Pillars ──────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#161616]">
        <div className="mb-16">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Ecossistema</span>
          <h3 className="text-3xl mt-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Tudo o que a sua marca precisa</h3>
        </div>
        <div className="space-y-12">
          {[
            { title: 'Corporate Gifts', desc: 'Presentes premium para clientes, parceiros e equipas. Curated selections que comunicam a sua marca com sofisticação.', href: '/corporate-gifts' },
            { title: 'Branded Merchandise', desc: 'Merch de marca com qualidade internacional. Desde apparel a acessórios tech, com branding de precisão.', href: '/branded-merch' },
            { title: 'Packaging Premium', desc: 'Embalagens personalizadas que elevam a experiência de unboxing e reforçam a identidade visual da marca.', href: '/packaging' },
            { title: 'Company Stores', desc: 'Lojas privadas para equipas e departamentos — catálogo próprio, preços personalizados, branding dedicado.', href: '/company-stores' },
            { title: 'Fulfillment', desc: 'Gestão completa de produção, armazenagem e envio — unitário ou em lote, nacional ou internacional.', href: '/fulfillment' },
          ].map((item) => (
            <Link key={item.title} href={item.href} className="block border-b border-[#3a3a3a]/30 pb-10 group">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xl" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>{item.title}</h4>
                <span className="material-symbols-outlined text-[#c5a059] transition-transform group-hover:translate-x-2">arrow_forward</span>
              </div>
              <p className="text-[#a5a5a5] text-xs leading-relaxed">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Company Stores Detail ────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0d0d0d]">
        <div className="bg-[#161616] p-10 border border-[#3a3a3a]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <span className="material-symbols-outlined" style={{ fontSize: '6rem' }}>store</span>
          </div>
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Inovação B2B</span>
          <h3 className="text-2xl mt-4 mb-8" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>A loja privada da tua empresa.</h3>
          <ul className="space-y-6 text-xs leading-relaxed text-[#a5a5a5]">
            {[
              { strong: 'Catálogo personalizado:', text: 'Apenas os produtos aprovados pela tua empresa, com preços negociados.' },
              { strong: 'Controlo por departamento:', text: 'Permissões, centros de custo e limites de orçamento por equipa.' },
              { strong: 'Integração SSO:', text: 'Login com Google Workspace, Microsoft 365 ou qualquer IdP SAML.' },
            ].map((item) => (
              <li key={item.strong} className="flex gap-4">
                <span className="material-symbols-outlined text-[#c5a059] text-sm flex-shrink-0">check_circle</span>
                <span><strong className="text-[#f2f0f0]">{item.strong}</strong> {item.text}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/company-stores"
            className="block w-full mt-10 py-5 text-center text-[#131313] text-[10px] uppercase tracking-widest"
            style={{ background: '#c5a059', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}
          >
            Criar a Minha Loja
          </Link>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#161616]">
        <div className="text-center mb-16">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.4em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Investimento</span>
          <h3 className="text-3xl mt-4" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Preços que fazem sentido para empresas</h3>
        </div>
        <div className="space-y-12">
          {/* Starter */}
          <div className="p-8 border border-[#3a3a3a]/30 bg-[#0d0d0d]/50">
            <p className="text-[9px] text-[#c5a059] tracking-[0.2em] mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>STARTER</p>
            <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>€500 – €2.500</p>
            <p className="text-[#a5a5a5] text-[10px] mb-8">Ideal para Startups, PMEs, primeiros projetos de branding</p>
            <ul className="space-y-4 mb-10 text-[11px] text-[#a5a5a5]">
              {['Até 50 unidades por projeto', 'Mockup digital incluído', 'Resposta em 48h garantida'].map((f) => (
                <li key={f} className="flex items-center gap-3"><span className="material-symbols-outlined text-[#c5a059] text-sm">check</span>{f}</li>
              ))}
            </ul>
            <Link href="/rfq" className="block w-full py-4 border border-[#c5a059] text-[#c5a059] text-center text-[9px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
              Pedir Estimativa
            </Link>
          </div>
          {/* Growth */}
          <div className="p-8 border-2 border-[#c5a059] bg-[#161616] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c5a059] text-[#131313] px-3 py-1 text-[8px] tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}>
              MAIS ESCOLHIDO
            </div>
            <p className="text-[9px] text-[#c5a059] tracking-[0.2em] mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>GROWTH</p>
            <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>€2.500 – €10.000</p>
            <p className="text-[#a5a5a5] text-[10px] mb-8">Empresas de 50–500 colaboradores com projetos recorrentes</p>
            <ul className="space-y-4 mb-10 text-[11px]">
              {['Múltiplos produtos por projeto', 'Gestor dedicado incluído', 'Store privada opcional'].map((f) => (
                <li key={f} className="flex items-center gap-3"><span className="material-symbols-outlined text-[#c5a059] text-sm">check</span>{f}</li>
              ))}
            </ul>
            <Link
              href="/rfq"
              className="block w-full py-4 text-center text-[#131313] text-[9px] uppercase tracking-widest"
              style={{ background: 'linear-gradient(135deg, #c5a059 0%, #e9c176 100%)', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}
            >
              Pedir Estimativa
            </Link>
          </div>
          {/* Enterprise */}
          <div className="p-8 border border-[#3a3a3a]/30 bg-[#0d0d0d]/50">
            <p className="text-[9px] text-[#c5a059] tracking-[0.2em] mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>ENTERPRISE</p>
            <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>€10.000+</p>
            <p className="text-[#a5a5a5] text-[10px] mb-8">Grandes empresas, grupos e multinacionais em Portugal</p>
            <ul className="space-y-4 mb-10 text-[11px] text-[#a5a5a5]">
              {['Fulfillment e gestão de stock', 'Integrações API/ERP', 'Account manager sénior'].map((f) => (
                <li key={f} className="flex items-center gap-3"><span className="material-symbols-outlined text-[#c5a059] text-sm">check</span>{f}</li>
              ))}
            </ul>
            <Link href="/rfq" className="block w-full py-4 border border-[#c5a059] text-[#c5a059] text-center text-[9px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>
              Pedir Estimativa
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0d0d0d]">
        <div className="mb-16">
          <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.3em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Dúvidas</span>
          <h3 className="text-3xl mt-4" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>Perguntas Frequentes</h3>
        </div>
        <div className="space-y-6">
          {[
            { q: 'Qual é o prazo médio de produção?', a: 'Depende do produto e da quantidade. A maioria dos projetos fica entre 10 e 20 dias úteis após aprovação do mockup. Projetos urgentes podem ser acelerados — fale connosco.' },
            { q: 'Qual é o pedido mínimo (MOQ)?', a: 'O MOQ varia consoante a categoria, começando geralmente nas 20-50 unidades para produtos premium de secretária ou apparel.' },
            { q: 'Fazem envio internacional?', a: 'Sim, entregamos em mais de 15 países na Europa e mercados globais como os EUA, com gestão completa de alfândega se necessário.' },
            { q: 'Como funciona a personalização?', a: 'Trabalhamos com serigrafia, bordado, laser e impressão UV. O nosso gestor sugere a técnica ideal para o produto e o teu logótipo.' },
          ].map((item) => (
            <details key={item.q} className="group border-b border-[#3a3a3a]/20 pb-6">
              <summary className="flex justify-between items-center cursor-pointer list-none">
                <span className="text-sm" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 600 }}>{item.q}</span>
                <span className="material-symbols-outlined text-[#c5a059] transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <p className="mt-4 text-xs text-[#a5a5a5] leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[#161616] text-center border-t border-[#3a3a3a]/30">
        <span className="text-[10px] text-[#c5a059] uppercase tracking-[0.4em]" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>Prontos para começar?</span>
        <h3 className="text-3xl mt-6 mb-12" style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}>A tua marca merece mais do que merch genérico.</h3>
        <Link
          href="/rfq"
          className="block w-full py-6 text-center text-[#131313] text-[11px] uppercase tracking-[0.2em] shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #c5a059 0%, #e9c176 100%)', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}
        >
          Pedir Proposta Agora
        </Link>
        <div className="mt-12 flex flex-col gap-6">
          <div className="flex items-center justify-center gap-3 text-[9px] text-[#a5a5a5] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span className="material-symbols-outlined text-[#c5a059] text-sm">verified_user</span>
            30 Dias de Satisfação Garantida
          </div>
          <div className="flex items-center justify-center gap-3 text-[9px] text-[#a5a5a5] uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span className="material-symbols-outlined text-[#c5a059] text-sm">history_edu</span>
            Resposta em 48h por Contrato
          </div>
        </div>
      </section>

      {/* ── Mobile Bottom Nav (marketing only) ──────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] rounded-full z-50 border border-[#3a3a3a]/30" style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(13,13,13,0.85)' }}>
        <div className="flex justify-around items-center py-4">
          {[
            { icon: 'home', label: 'Início', href: '/' },
            { icon: 'grid_view', label: 'Catálogo', href: '/catalog' },
            { icon: 'cases', label: 'Soluções', href: '/corporate-gifts' },
            { icon: 'person', label: 'Conta', href: '/auth/login' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 text-[#a5a5a5] first:text-[#c5a059]">
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[8px] tracking-wider uppercase" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
