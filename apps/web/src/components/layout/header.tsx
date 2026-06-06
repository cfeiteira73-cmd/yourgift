"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Menu,
  X,
  Package,
  Gift,
  Store,
  Truck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mainNav } from "@/config/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { type Lang } from "@/lib/i18n";

const solutionIcons: Record<string, React.ReactNode> = {
  "/corporate-gifts": <Gift className="h-4 w-4" />,
  "/branded-merch": <Package className="h-4 w-4" />,
  "/packaging": <Package className="h-4 w-4" />,
  "/company-stores": <Store className="h-4 w-4" />,
  "/fulfillment": <Truck className="h-4 w-4" />,
};

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<Lang>('pt');

  useEffect(() => {
    const match = document.cookie.match(/lang=(pt|en)/);
    if (match) setCurrentLang(match[1] as Lang);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled
          ? "border-[#3a3a3a]/30"
          : "border-transparent"
      )}
      style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(13,13,13,0.88)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              className="text-xl tracking-[0.2em] text-[#c5a059] uppercase"
              style={{ fontFamily: 'var(--font-playfair), serif', fontWeight: 700 }}
            >
              yourgift.pt
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainNav.map((item) =>
              item.children ? (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.href)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200",
                      "text-[#a5a5a5] hover:text-[#c5a059]",
                      openDropdown === item.href && "text-[#c5a059]"
                    )}
                    style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        openDropdown === item.href && "rotate-180"
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {openDropdown === item.href && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="absolute top-full left-0 mt-2 w-72 border border-[#3a3a3a]/50 p-2"
                  style={{ backgroundColor: 'rgba(13,13,13,0.97)', backdropFilter: 'blur(16px)' }}
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-start gap-3 p-3 hover:bg-[#c5a059]/5 transition-colors group"
                          >
                            <div className="mt-0.5 p-1.5 text-[#c5a059]">
                              {solutionIcons[child.href] || (
                                <Package className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[#f2f0f0] group-hover:text-[#c5a059] transition-colors" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
                                {child.label}
                              </div>
                              {child.description && (
                                <div className="text-xs text-[#a5a5a5] mt-0.5 leading-relaxed">
                                  {child.description}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all duration-200",
                    "text-[#a5a5a5] hover:text-[#c5a059]",
                    pathname === item.href && "text-[#c5a059]"
                  )}
                  style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageSwitcher currentLang={currentLang} />
            </div>

            <Link
              href="/auth/login"
              className="hidden md:block text-sm text-[#a5a5a5] hover:text-[#c5a059] px-4 py-2 transition-all"
              style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
            >
              Entrar
            </Link>

            <Link
              href="/rfq"
              className="hidden md:flex items-center gap-2 text-[10px] font-semibold px-5 py-2.5 text-[#131313] transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #c5a059 0%, #e9c176 100%)', fontFamily: 'var(--font-montserrat), sans-serif' }}
            >
              Pedir proposta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-[#a5a5a5] hover:text-[#c5a059] transition-all"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:hidden border-t border-[#3a3a3a]/30 overflow-hidden"
            style={{ backgroundColor: 'rgba(13,13,13,0.98)', backdropFilter: 'blur(16px)' }}
          >
            <div className="px-6 py-6 space-y-1 max-h-[80vh] overflow-y-auto">
              {mainNav.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between py-3 px-4 text-[#a5a5a5] hover:text-[#c5a059] transition-all"
                    style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
                  >
                    <span className="font-medium">{item.label}</span>
                  </Link>
                  {item.children && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center gap-2 py-2.5 px-4 text-[#a5a5a5]/60 hover:text-[#c5a059] transition-all text-sm"
                          style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-[#3a3a3a]/30 space-y-2">
                <Link
                  href="/rfq"
                  className="flex items-center justify-center gap-2 w-full py-3 text-[#131313] text-sm"
                  style={{ background: 'linear-gradient(135deg, #c5a059 0%, #e9c176 100%)', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700 }}
                >
                  Pedir proposta
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center w-full py-3 border border-[#c5a059]/30 text-[#a5a5a5] text-sm hover:text-[#c5a059] transition-all"
                  style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
                >
                  Entrar
                </Link>
                <div className="flex justify-center pt-1">
                  <LanguageSwitcher currentLang={currentLang} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
