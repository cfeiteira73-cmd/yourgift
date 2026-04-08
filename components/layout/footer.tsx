import Link from "next/link";
import { Sparkles, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { footerNav } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[rgb(7,17,31)]">
      {/* CTA Band */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(77,163,255,0.18), transparent)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-4">
            Prontos para começar?
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4">
            Transforme o seu próximo projeto em experiência de marca.
          </h2>
          <p className="text-white/60 max-w-xl mx-auto mb-8 text-lg">
            Corporate gifts, merch, stores privadas e fulfillment — tudo num só
            parceiro.
          </p>
          <Link
            href="/rfq"
            className="inline-flex items-center gap-2 bg-white text-[#07111F] px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all hover:scale-[1.02] shadow-soft"
          >
            Pedir proposta gratuita
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Main Footer */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Brand col */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4DA3FF] to-[#63E6BE] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-lg text-white tracking-tight">
                  yourgift<span className="text-[#4DA3FF]">.pt</span>
                </span>
              </Link>
              <p className="text-white/52 text-sm leading-relaxed max-w-xs mb-6">
                Plataforma premium B2B de branding, merchandising e corporate
                gifts. Desde a ideia à entrega, com experiência de classe
                mundial.
              </p>
              <div className="space-y-2.5">
                <a
                  href={`mailto:${siteConfig.links.email}`}
                  className="flex items-center gap-2.5 text-sm text-white/52 hover:text-white/80 transition-colors"
                >
                  <Mail className="h-4 w-4 text-[#4DA3FF]" />
                  {siteConfig.links.email}
                </a>
                <a
                  href={`tel:${siteConfig.links.phone}`}
                  className="flex items-center gap-2.5 text-sm text-white/52 hover:text-white/80 transition-colors"
                >
                  <Phone className="h-4 w-4 text-[#4DA3FF]" />
                  {siteConfig.links.phone}
                </a>
                <div className="flex items-center gap-2.5 text-sm text-white/52">
                  <MapPin className="h-4 w-4 text-[#4DA3FF]" />
                  {siteConfig.company.address}
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38 mb-4">
                Soluções
              </h3>
              <ul className="space-y-2.5">
                {footerNav.solutions.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-white/56 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38 mb-4">
                Empresa
              </h3>
              <ul className="space-y-2.5">
                {footerNav.company.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-white/56 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38 mb-4">
                Newsletter
              </h3>
              <p className="text-sm text-white/52 mb-4 leading-relaxed">
                Tendências, inspiração e novidades do setor — direto na sua
                caixa.
              </p>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="O seu email"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm text-white placeholder:text-white/38 focus:outline-none focus:border-[#4DA3FF]/50 transition-colors"
                />
                <button
                  type="submit"
                  className="px-3 py-2.5 rounded-xl bg-[#4DA3FF]/20 text-[#4DA3FF] hover:bg-[#4DA3FF]/30 transition-colors border border-[#4DA3FF]/20"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Social proof + WhatsApp */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-2">
                <p className="text-xs text-white/50">
                  ⭐ 4.9/5 · 312 clientes activos · Resposta em 48h
                </p>
                <a
                  href="https://wa.me/351000000000?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20vossos%20servi%C3%A7os."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-[#25D366] transition-colors"
                >
                  <span>💬</span>
                  <span>WhatsApp disponível 9h–18h</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/38">
            © {new Date().getFullYear()} yourgift.pt — Todos os direitos
            reservados.
          </p>
          <div className="flex items-center gap-5">
            {footerNav.legal.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-white/38 hover:text-white/60 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
