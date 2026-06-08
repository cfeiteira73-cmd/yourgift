'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WhatsAppFloat } from '@/components/ui/whatsapp-float';
import { Footer } from '@/components/layout/footer';
import './home-v2.css';
import './marketing-pages.css';

// ── v2 Nav with scroll behavior ───────────────────────────────────────────────
function NavV2() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`yg-nav${scrolled ? ' scrolled' : ''}`}>
      <Link href="/" className="yg-nav-logo">
        your<span>gift</span>.pt
      </Link>
      <ul className="yg-nav-links">
        <li><Link href="/catalog">Catálogo</Link></li>
        <li><Link href="/how-it-works">Como Funciona</Link></li>
        <li><Link href="/about">Sobre</Link></li>
        <li><Link href="/blog">Blog</Link></li>
      </ul>
      <div className="yg-nav-cta">
        <Link href="/auth/login" className="yg-nav-ghost">Entrar</Link>
        <Link href="/rfq" className="yg-nav-btn">Pedir Proposta</Link>
      </div>
    </nav>
  );
}

// ── v2 Footer ─────────────────────────────────────────────────────────────────
function FooterV2() {
  return (
    <footer className="yg-footer">
      <div className="yg-footer-top">
        <div>
          <div className="yg-footer-brand">your<span>gift</span>.pt</div>
          <p className="yg-footer-desc">
            Plataforma B2B premium de corporate gifts, branded merchandise e company stores para empresas em Portugal. 20.000+ produtos, resposta em 48h garantida.
          </p>
          <div className="yg-footer-contact">
            <a href="mailto:geral@yourgift.pt">geral@yourgift.pt</a>
            <a href="tel:+351210000000">+351 210 000 000</a>
            <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer">WhatsApp · Resposta imediata</a>
          </div>
          <span className="yg-footer-city">Lisboa, Portugal</span>
        </div>
        <div>
          <div className="yg-footer-col-title">Soluções</div>
          <ul className="yg-footer-links">
            {[
              ['Corporate Gifts', '/corporate-gifts'],
              ['Branded Merch', '/branded-merch'],
              ['Packaging', '/packaging'],
              ['Company Stores', '/company-stores'],
              ['Fulfillment', '/fulfillment'],
            ].map(([label, href]) => (
              <li key={label}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="yg-footer-col-title">Empresa</div>
          <ul className="yg-footer-links">
            {[
              ['Sobre nós', '/about'],
              ['Como Funciona', '/how-it-works'],
              ['Blog', '/blog'],
              ['Contacto', '/contact'],
              ['FAQ', '/faq'],
            ].map(([label, href]) => (
              <li key={label}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="yg-footer-col-title">Legal</div>
          <ul className="yg-footer-links">
            {[
              ['Política de Privacidade', '/privacy-policy'],
              ['Termos de Serviço', '/terms'],
            ].map(([label, href]) => (
              <li key={label}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="yg-footer-bottom">
        <span className="yg-footer-copy">© 2026 yourgift.pt — Todos os direitos reservados.</span>
        <div className="yg-footer-legal">
          <Link href="/privacy-policy">Privacidade</Link>
          <Link href="/terms">Termos</Link>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Urgency Bar */}
      <div className="yg-urgency">
        <span className="yg-urgency-text">
          ⬤ &nbsp;6 propostas disponíveis esta semana — <em>restam 2 vagas</em>
        </span>
        <Link href="/rfq" className="yg-urgency-cta">Garantir a minha &nbsp;→</Link>
      </div>

      {/* Nav */}
      <NavV2 />

      {/* Page content — padded top for fixed nav + urgency bar */}
      <main style={{ paddingTop: 0 }}>{children}</main>

      {/* Footer */}
      <FooterV2 />

      {/* WhatsApp float hidden (inside page) */}
    </>
  );
}
