import type { Metadata } from 'next';
import Link from 'next/link';
import './home-v2.css';
import { HeroVideo } from '@/components/marketing/HeroVideo';

export const metadata: Metadata = {
  title: 'Corporate Gifts, Branded Merch & Company Stores — 20.000+ Produtos | yourgift.pt',
  description:
    'Plataforma premium B2B de corporate gifts, branded merchandise, packaging personalizado e company stores para empresas em Portugal. 20.000+ produtos, 312 clientes activos, resposta em 48h garantida.',
};

// ─── yourgift v2 — Design Editorial Premium ──────────────────────────────────
// Paleta: Paper #f7f5f0 · Bronze #9a7c4a · Tinta #1a1a17
// Fontes: Libre Baskerville (display) · Montserrat (UI) · DM Mono (dados)

export default function HomePage() {
  return (
    <div className="yg-body">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="yg-hero">
        {/* Cinematic video hero — replaces static image */}
        <HeroVideo
          src="/videos/hero.mp4"
          ariaLabel="YourGift — Cinematic Master Brand Film"
        />
        <div className="yg-hero-content">
          <div className="yg-hero-eyebrow">Plataforma B2B Premium · Portugal</div>
          <h1 className="yg-hero-h1">
            Merch que a tua<br />equipa vai querer<br /><em>usar.</em>
          </h1>
          <p className="yg-hero-sub">
            Transformamos pedidos complexos em produtos que as empresas se orgulham de oferecer. Da proposta ao fulfillment — com mockup gratuito em 24h e gestor dedicado.
          </p>
          <div className="yg-hero-actions">
            <Link href="/rfq" className="yg-btn-gold">Pedir Proposta Gratuita &nbsp;→</Link>
            <Link href="/catalog" className="yg-btn-outline-white">Ver Catálogo</Link>
          </div>
          <p className="yg-hero-note">Mockup gratuito incluído &nbsp;·&nbsp; Resposta em 48h garantida</p>
        </div>
        <div className="yg-hero-badge">
          <div className="yg-badge-num">312<span>+</span></div>
          <div className="yg-badge-label">Clientes Activos</div>
        </div>
        <div className="yg-hero-trust">
          {[
            'Equipa certificada ISO 9001',
            'Parceiros internacionais verificados',
            'Mockup gratuito em 24h',
          ].map((label) => (
            <div key={label} className="yg-trust-item">
              <span className="yg-trust-mark">✦</span>
              <span className="yg-trust-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────────────────── */}
      <div className="yg-ticker" aria-hidden="true">
        <div className="yg-ticker-inner">
          {[
            <><strong>Galp</strong></>, <><strong>EDP</strong></>, <><strong>Sonae</strong></>,
            <><strong>NOS</strong></>, <><strong>KPMG</strong></>, <><strong>TAP</strong></>,
            <><strong>Millennium BCP</strong></>, <><strong>Santander</strong></>,
            <>Mockup em <strong>24h</strong></>, <>Resposta em <strong>48h</strong> Garantida</>,
            <>Entrega EU <strong>5–10 dias</strong></>, <><strong>20.000+</strong> Produtos</>,
            <>Bordado · DTF · <strong>Laser</strong></>, <><strong>98%</strong> Satisfação</>,
            <><strong>Galp</strong></>, <><strong>EDP</strong></>, <><strong>Sonae</strong></>,
            <><strong>NOS</strong></>, <><strong>KPMG</strong></>, <><strong>TAP</strong></>,
            <><strong>Millennium BCP</strong></>, <><strong>Santander</strong></>,
            <>Mockup em <strong>24h</strong></>, <>Resposta em <strong>48h</strong> Garantida</>,
            <>Entrega EU <strong>5–10 dias</strong></>, <><strong>20.000+</strong> Produtos</>,
            <>Bordado · DTF · <strong>Laser</strong></>, <><strong>98%</strong> Satisfação</>,
          ].map((item, i) => (
            <span key={i} className="yg-ticker-item">{item}</span>
          ))}
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="yg-stats">
        {[
          { num: '312', sup: '+', label: 'Clientes Activos' },
          { num: '20', sup: 'k+', label: 'Produtos' },
          { num: '48', sup: 'h', label: 'Resposta Garantida' },
          { num: '98', sup: '%', label: 'Satisfação' },
        ].map((s) => (
          <div key={s.label} className="yg-stat">
            <div className="yg-stat-num">{s.num}<span>{s.sup}</span></div>
            <div className="yg-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Catalog ──────────────────────────────────────────────────────── */}
      <section className="yg-catalog">
        <div className="yg-catalog-header">
          <div>
            <div className="yg-ey">Curadoria Premium</div>
            <h2 className="yg-sec-title">Coleção<br /><em>Curada</em></h2>
          </div>
          <p className="yg-catalog-desc">
            Cada produto seleccionado por qualidade, impacto visual e performance de branding. Técnicas de personalização de precisão: bordado, DTF, laser, serigrafia e impressão UV.
          </p>
        </div>
        <div className="yg-cats">
          {[
            { label: 'Apparel', href: '/branded-merch', active: true },
            { label: 'Notebooks', href: '/catalog?cat=notebooks' },
            { label: 'Drinkware', href: '/catalog?cat=drinkware' },
            { label: 'Tech', href: '/catalog?cat=tech' },
            { label: 'Gift Boxes', href: '/corporate-gifts' },
          ].map((cat) => (
            <Link key={cat.label} href={cat.href} className={`yg-cat${cat.active ? ' active' : ''}`}>
              {cat.label}
            </Link>
          ))}
        </div>
        <div className="yg-product-grid">
          {[
            {
              img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=95&fit=crop&crop=center',
              alt: 'Premium Watch Gift', tag: '● Popular',
              name: 'Premium Leather Journal', price: 'A partir de €12 /un · MOQ 50'
            },
            {
              img: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=95&fit=crop&crop=center',
              alt: 'Insulated Tumbler', tag: '● Eco',
              name: 'Insulated Tumbler 500ml', price: 'A partir de €18 /un · MOQ 100'
            },
            {
              img: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=95&fit=crop&crop=center',
              alt: 'Premium Hoodie', tag: '● Organic',
              name: 'Organic Cotton Tee', price: 'A partir de €9 /un · MOQ 50'
            },
            {
              img: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=95&fit=crop&crop=center',
              alt: 'Premium Gift Box', tag: '● Tech',
              name: 'Bamboo Tech Organizer', price: 'A partir de €22 /un · MOQ 25'
            },
          ].map((p) => (
            <div key={p.name} className="yg-product-card">
              <img src={p.img} alt={p.alt} loading="lazy" />
              <div className="yg-product-overlay" />
              <div className="yg-product-info">
                <div className="yg-product-tag">{p.tag}</div>
                <div className="yg-product-name">{p.name}</div>
                <div className="yg-product-price">{p.price}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="yg-catalog-footer">
          <Link href="/catalog" className="yg-btn-outline">Ver Catálogo Completo &nbsp;→</Link>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <section className="yg-comparison">
        <div className="yg-comparison-inner">
          <div className="yg-comp-header">
            <div className="yg-ey yg-ey-light">A Mudança</div>
            <h2 className="yg-sec-title yg-sec-title-light">
              Deixa de perder tempo<br />com fornecedores <em>genéricos.</em>
            </h2>
          </div>
          <div className="yg-comp-col yg-comp-col-bad">
            <span className="yg-comp-col-label">Fornecedor Genérico</span>
            {[
              'Meses de emails para encontrar um fornecedor de confiança',
              'Mockups que não representam o produto real',
              'Preços opacos com taxas escondidas no final',
              'Prazos que se prolongam sem explicação',
              'Cada reorder começa do zero, sem histórico',
              'Sem visibilidade sobre o estado da produção',
              'Qualidade inconsistente lote a lote',
            ].map((item) => (
              <div key={item} className="yg-comp-item">
                <span className="yg-ci-mark">✕</span>
                <span className="yg-comp-text">{item}</span>
              </div>
            ))}
          </div>
          <div className="yg-comp-col yg-comp-col-good">
            <span className="yg-comp-col-label">yourgift.pt</span>
            {[
              'Proposta em 48h, gestor dedicado que conhece a tua marca',
              'Mockup fotorrealista em 24h antes de qualquer produção',
              'Preços transparentes, sem surpresas — confirmados por escrito',
              'Prazos cumpridos com tracking em tempo real',
              'Reorder em 1 clique com todos os ficheiros guardados',
              'Dashboard com estado da produção em tempo real',
              'QC rigoroso em cada lote — consistência garantida',
            ].map((item) => (
              <div key={item} className="yg-comp-item">
                <span className="yg-ci-mark">✦</span>
                <span className="yg-comp-text">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="yg-testimonials">
        <div className="yg-test-header">
          <div className="yg-ey">Resultados Reais</div>
          <h2 className="yg-sec-title">Histórias de<br /><em>Sucesso</em></h2>
        </div>
        <div className="yg-test-grid">
          {[
            { q: 'Recebemos 500 onboarding kits personalizados em 12 dias úteis. Qualidade impecável, packaging premium e o nosso logo perfeito.', name: 'Ana Silva', role: 'Head of HR · Galp Energia' },
            { q: 'Encomendar 1.200 t-shirts para o nosso evento anual foi surpreendentemente simples. Mockup aprovado em 24h, produção em 10 dias.', name: 'Pedro Costa', role: 'Marketing Director · EDP' },
            { q: 'O gestor dedicado foi um diferencial enorme. Acompanhou todo o processo, antecipou problemas e entregou antes do prazo.', name: 'Mariana Ferreira', role: 'Brand Manager · Sonae MC' },
            { q: 'Já fizemos 3 encomendas este ano. O reorder system é fantástico — em 2 cliques repetimos a encomenda anterior.', name: 'João Nunes', role: 'Procurement Manager · NOS' },
            { q: 'Os nossos kits de boas-vindas elevaram completamente a experiência de onboarding. Feedback 100% positivo.', name: 'Sofia Rodrigues', role: 'People & Culture Lead · KPMG' },
            { q: 'Para o nosso evento com 800 convidados, a yourgift.pt entregou 800 gift boxes premium dentro do prazo. Impecável.', name: 'Rui Alves', role: 'Events & Sponsorship · Millennium BCP' },
          ].map((t) => (
            <div key={t.name} className="yg-test-card">
              <div className="yg-test-pull">&ldquo;</div>
              <p className="yg-test-text">{t.q}</p>
              <div className="yg-test-divider" />
              <div className="yg-test-name">{t.name}</div>
              <div className="yg-test-role">{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Solutions ────────────────────────────────────────────────────── */}
      <section className="yg-solutions">
        <div className="yg-sol-header">
          <div className="yg-ey">Ecossistema</div>
          <h2 className="yg-sec-title">Tudo o que a sua<br />marca <em>precisa</em></h2>
        </div>
        <div className="yg-sol-grid">
          {[
            { num: '01', title: 'Corporate Gifts', desc: 'Presentes premium para clientes, parceiros e equipas. Curated selections que comunicam a sua marca com sofisticação.', href: '/corporate-gifts' },
            { num: '02', title: 'Branded Merchandise', desc: 'Merch de marca com qualidade internacional. Desde apparel a acessórios tech, com branding de precisão.', href: '/branded-merch' },
            { num: '03', title: 'Packaging Premium', desc: 'Embalagens personalizadas que elevam a experiência de unboxing e reforçam a identidade visual da marca.', href: '/packaging' },
            { num: '04', title: 'Company Stores', desc: 'Lojas privadas para equipas e departamentos — catálogo próprio, preços personalizados, branding dedicado.', href: '/company-stores' },
            { num: '05', title: 'Fulfillment', desc: 'Gestão completa de produção, armazenagem e envio — unitário ou em lote, nacional ou internacional.', href: '/fulfillment' },
          ].map((s) => (
            <Link key={s.num} href={s.href} className="yg-sol-card">
              <span className="yg-sol-num">{s.num}</span>
              <div className="yg-sol-title">{s.title}</div>
              <div className="yg-sol-desc">{s.desc}</div>
              <div className="yg-sol-arrow">→</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Company Store Highlight ──────────────────────────────────────── */}
      <section className="yg-store">
        <div className="yg-store-visual">
          <img
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=95&fit=crop&crop=center"
            alt="Company Store"
          />
        </div>
        <div className="yg-store-content">
          <div className="yg-ey yg-ey-light">Inovação B2B</div>
          <h2 className="yg-sec-title yg-sec-title-light" style={{ marginBottom: 40 }}>
            A loja privada<br />da tua <em>empresa.</em>
          </h2>
          {[
            { strong: 'Catálogo personalizado:', text: 'Apenas os produtos aprovados pela tua empresa, com preços negociados.' },
            { strong: 'Controlo por departamento:', text: 'Permissões, centros de custo e limites de orçamento por equipa.' },
            { strong: 'Integração SSO:', text: 'Login com Google Workspace, Microsoft 365 ou qualquer IdP SAML.' },
          ].map((f) => (
            <div key={f.strong} className="yg-store-feat">
              <div className="yg-store-feat-mark">✦</div>
              <p className="yg-store-feat-text"><strong>{f.strong}</strong> {f.text}</p>
            </div>
          ))}
          <div style={{ marginTop: 48 }}>
            <Link href="/company-stores" className="yg-btn-gold">Criar a Minha Loja &nbsp;→</Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="yg-pricing">
        <div className="yg-pricing-header">
          <div className="yg-ey yg-ey-light">Investimento</div>
          <h2 className="yg-sec-title yg-sec-title-light">
            Preços que fazem<br /><em>sentido</em> para empresas
          </h2>
        </div>
        <div className="yg-pricing-grid">
          {/* Starter */}
          <div className="yg-price-card">
            <span className="yg-price-tier-label">Starter</span>
            <div className="yg-price-tier">Starter</div>
            <div className="yg-price-range">€500 – €2.500</div>
            <p className="yg-price-desc">Ideal para Startups, PMEs e primeiros projetos de branding corporativo.</p>
            {['Até 50 unidades por projeto', 'Mockup digital incluído', 'Resposta em 48h garantida'].map((f) => (
              <div key={f} className="yg-price-feat"><span className="yg-price-feat-mark">✦</span><span className="yg-price-feat-text">{f}</span></div>
            ))}
            <Link href="/rfq" className="yg-price-cta yg-price-cta-ghost">Pedir Estimativa</Link>
          </div>
          {/* Growth — featured */}
          <div className="yg-price-card yg-price-card-feat">
            <span className="yg-price-tier-label">Mais Escolhido</span>
            <div className="yg-price-tier">Growth</div>
            <div className="yg-price-range">€2.500 – €10.000</div>
            <p className="yg-price-desc">Empresas de 50–500 colaboradores com projetos recorrentes e necessidades de branding contínuas.</p>
            {['Múltiplos produtos por projeto', 'Gestor dedicado incluído', 'Store privada opcional'].map((f) => (
              <div key={f} className="yg-price-feat"><span className="yg-price-feat-mark">✦</span><span className="yg-price-feat-text">{f}</span></div>
            ))}
            <Link href="/rfq" className="yg-price-cta yg-price-cta-solid">Pedir Estimativa</Link>
          </div>
          {/* Enterprise */}
          <div className="yg-price-card">
            <span className="yg-price-tier-label">Enterprise</span>
            <div className="yg-price-tier">Enterprise</div>
            <div className="yg-price-range">€10.000+</div>
            <p className="yg-price-desc">Grandes empresas, grupos e multinacionais com operações em Portugal e Europa.</p>
            {['Fulfillment e gestão de stock', 'Integrações API/ERP', 'Account manager sénior'].map((f) => (
              <div key={f} className="yg-price-feat"><span className="yg-price-feat-mark">✦</span><span className="yg-price-feat-text">{f}</span></div>
            ))}
            <Link href="/rfq" className="yg-price-cta yg-price-cta-ghost">Pedir Estimativa</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="yg-faq">
        <div className="yg-faq-sticky">
          <div className="yg-ey">Dúvidas</div>
          <h2 className="yg-sec-title">Perguntas<br /><em>Frequentes</em></h2>
          <p className="yg-faq-desc">Não encontra resposta? O nosso gestor responde em menos de 2 horas.</p>
          <Link href="/rfq" className="yg-faq-link">Falar connosco &nbsp;→</Link>
        </div>
        <div>
          {[
            { q: 'Qual é o prazo médio de produção?', a: 'A maioria dos projetos fica entre 10 e 20 dias úteis após aprovação do mockup. Projetos urgentes podem ser acelerados mediante disponibilidade.' },
            { q: 'Qual é o pedido mínimo (MOQ)?', a: 'O MOQ começa geralmente nas 20–50 unidades para produtos premium de secretária ou apparel. Para alguns produtos tech, o MOQ pode ser menor.' },
            { q: 'Fazem envio internacional?', a: 'Sim, entregamos em mais de 15 países na Europa e mercados globais, com gestão completa de alfândega e documentação de exportação.' },
            { q: 'Como funciona a personalização?', a: 'Trabalhamos com serigrafia, bordado, laser e impressão UV. O nosso gestor avalia o produto e sugere a técnica ideal para o resultado mais premium possível.' },
          ].map((item, i) => (
            <details key={item.q} className="yg-faq-item" open={i === 0}>
              <summary>
                {item.q}
                <span className="yg-faq-icon">+</span>
              </summary>
              <div className="yg-faq-a">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="yg-final-cta">
        <img
          className="yg-final-img"
          src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&q=95&fit=crop&crop=center"
          alt="Premium gifts"
        />
        <div className="yg-final-content">
          <div className="yg-final-eyebrow">Prontos para Começar?</div>
          <h2 className="yg-final-title">
            A tua marca merece<br />mais do que merch <em>genérico.</em>
          </h2>
          <p className="yg-final-sub">
            Mockup fotorrealista em 24h. Gestor dedicado. Entrega garantida. Sem surpresas.
          </p>
          <div className="yg-final-actions">
            <Link href="/rfq" className="yg-btn-gold">Pedir Proposta Agora &nbsp;→</Link>
          </div>
          <div className="yg-final-guarantee">
            30 Dias de Satisfação Garantida &nbsp;·&nbsp; Resposta em 48h por Contrato
          </div>
        </div>
      </section>

      {/* ── Clients ──────────────────────────────────────────────────────── */}
      <div className="yg-clients">
        <div className="yg-clients-label">Confiado por 312+ empresas em Portugal</div>
        <div className="yg-clients-logos">
          {['Galp', 'EDP', 'Sonae', 'NOS', 'KPMG', 'TAP', 'Millennium BCP', 'Santander'].map((name) => (
            <span key={name} className="yg-client-logo">{name}</span>
          ))}
        </div>
      </div>

      {/* ── WhatsApp Float ───────────────────────────────────────────────── */}
      <a
        href="https://wa.me/351919948986?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20vossos%20servi%C3%A7os."
        className="yg-wa"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="yg-wa-dot" />
        Fala connosco
      </a>

    </div>
  );
}
