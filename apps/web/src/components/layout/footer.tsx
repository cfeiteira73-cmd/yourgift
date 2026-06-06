import Link from "next/link";
import { siteConfig } from "@/config/site";
import { footerNav } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="bg-[#0d0d0d] pt-20 pb-32 px-6 border-t border-[#3a3a3a]/10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2
            className="text-2xl text-[#c5a059] tracking-[0.2em] uppercase mb-12"
            style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}
          >
            yourgift.pt
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 mb-16">
            {/* Soluções */}
            <div className="flex flex-col gap-4">
              <p
                className="text-[9px] text-[#c5a059] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}
              >
                Soluções
              </p>
              {footerNav.solutions.map((item) => (
                <Link key={item.href} href={item.href} className="text-xs text-[#a5a5a5] hover:text-[#c5a059] transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
            {/* Empresa */}
            <div className="flex flex-col gap-4">
              <p
                className="text-[9px] text-[#c5a059] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}
              >
                Empresa
              </p>
              {footerNav.company.map((item) => (
                <Link key={item.href} href={item.href} className="text-xs text-[#a5a5a5] hover:text-[#c5a059] transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
            {/* Legal */}
            <div className="flex flex-col gap-4">
              <p
                className="text-[9px] text-[#c5a059] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}
              >
                Legal
              </p>
              {footerNav.legal.map((item) => (
                <Link key={item.href} href={item.href} className="text-xs text-[#a5a5a5] hover:text-[#c5a059] transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-6 pt-12 border-t border-[#3a3a3a]/10">
            <p
              className="text-[9px] text-[#c5a059] uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}
            >
              Contacto
            </p>
            <div className="text-xs text-[#a5a5a5] space-y-2">
              <p>
                <a href={`mailto:${siteConfig.links.email}`} className="hover:text-[#c5a059] transition-colors">
                  {siteConfig.links.email}
                </a>
              </p>
              <p>{siteConfig.company.address}</p>
              <p>
                <a href={`tel:${siteConfig.links.phone}`} className="hover:text-[#c5a059] transition-colors">
                  {siteConfig.links.phone}
                </a>
              </p>
            </div>
            <div className="flex gap-6 pt-4 text-[#c5a059]">
              <a
                href={`mailto:${siteConfig.links.email}`}
                aria-label="Email"
                className="material-symbols-outlined hover:text-[#e9c176] transition-colors"
              >
                alternate_email
              </a>
              <a
                href="https://wa.me/351919948986"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="material-symbols-outlined hover:text-[#e9c176] transition-colors"
              >
                forum
              </a>
              <span className="material-symbols-outlined">location_on</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[#3a3a3a]/10 text-center">
          <p
            className="text-[8px] text-[#a5a5a5]/40 uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
          >
            © {new Date().getFullYear()} yourgift.pt — Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
