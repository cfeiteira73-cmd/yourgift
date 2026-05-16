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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-[rgb(7,17,31)]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-heavy"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4DA3FF] to-[#63E6BE] flex items-center justify-center shadow-glow-blue">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg text-white tracking-tight">
              yourgift
              <span className="text-[#4DA3FF]">.pt</span>
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
                      "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                      "text-white/70 hover:text-white hover:bg-white/[0.06]",
                      openDropdown === item.href && "text-white bg-white/[0.06]"
                    )}
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
                        className="absolute top-full left-0 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#0B1526]/95 backdrop-blur-xl shadow-heavy p-2"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.06] transition-colors group"
                          >
                            <div className="mt-0.5 p-1.5 rounded-lg bg-[#4DA3FF]/10 text-[#4DA3FF] group-hover:bg-[#4DA3FF]/18 transition-colors">
                              {solutionIcons[child.href] || (
                                <Package className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                                {child.label}
                              </div>
                              {child.description && (
                                <div className="text-xs text-white/48 mt-0.5 leading-relaxed">
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
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    "text-white/70 hover:text-white hover:bg-white/[0.06]",
                    pathname === item.href && "text-white bg-white/[0.08]"
                  )}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden md:block text-sm text-white/70 hover:text-white px-4 py-2 rounded-xl transition-all hover:bg-white/[0.06]"
            >
              Entrar
            </Link>

            <Link
              href="/rfq"
              className={cn(
                "flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200",
                "bg-white text-[#07111F] hover:bg-white/90 shadow-soft",
                "hover:shadow-glow-blue hover:scale-[1.02]"
              )}
            >
              Pedir proposta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
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
            className="lg:hidden border-t border-white/[0.06] bg-[#07111F]/98 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-6 py-6 space-y-1 max-h-[80vh] overflow-y-auto">
              {mainNav.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between py-3 px-4 rounded-xl text-white/80 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    <span className="font-medium">{item.label}</span>
                  </Link>
                  {item.children && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.06] transition-all text-sm"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-white/[0.06] space-y-2">
                <Link
                  href="/rfq"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-[#07111F] font-semibold text-sm"
                >
                  Pedir proposta
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-center w-full py-3 rounded-xl border border-white/[0.12] text-white/80 text-sm hover:bg-white/[0.06] transition-all"
                >
                  Entrar
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
