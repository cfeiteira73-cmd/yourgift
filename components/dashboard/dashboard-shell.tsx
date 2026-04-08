"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  ImageIcon,
  MapPin,
  RotateCcw,
  FolderOpen,
  Settings,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/dashboard/orders", label: "Encomendas", icon: <ShoppingBag className="h-4 w-4" /> },
  { href: "/dashboard/rfqs", label: "Propostas", icon: <FileText className="h-4 w-4" /> },
  { href: "/dashboard/mockups", label: "Mockups", icon: <ImageIcon className="h-4 w-4" /> },
  { href: "/dashboard/addresses", label: "Moradas", icon: <MapPin className="h-4 w-4" /> },
  { href: "/dashboard/reorders", label: "Reorders", icon: <RotateCcw className="h-4 w-4" /> },
  { href: "/dashboard/assets", label: "Ficheiros", icon: <FolderOpen className="h-4 w-4" /> },
  { href: "/dashboard/settings", label: "Definições", icon: <Settings className="h-4 w-4" /> },
];

export function DashboardShell({ children, hasClerkKeys }: { children: React.ReactNode; hasClerkKeys?: boolean }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-[rgb(7,17,31)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/[0.06] bg-[#0B1526]/60 fixed top-0 left-0 bottom-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-[#4DA3FF] to-[#63E6BE] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-white tracking-tight">
            yourgift<span className="text-[#4DA3FF]">.pt</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-[#4DA3FF]/12 text-[#4DA3FF]"
                    : "text-white/52 hover:text-white/80 hover:bg-white/[0.05]"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to site */}
        <div className="px-3 pb-4 border-t border-white/[0.06] pt-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 md:px-8 bg-[#0B1526]/40 backdrop-blur-sm sticky top-0 z-10">
          <div className="text-sm font-medium text-white/60">
            Dashboard
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/rfq"
              className="hidden sm:flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#07111F] hover:bg-white/90 transition-all"
            >
              Nova proposta
            </Link>
            {hasClerkKeys && <UserButton afterSignOutUrl="/" />}
          </div>
        </header>

        {/* Content */}
        <main className="p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
