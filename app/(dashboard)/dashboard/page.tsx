import { ShoppingBag, FileText, Package, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";

const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

export default async function DashboardPage() {
  let firstName: string | null = null;

  if (hasClerkKeys) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    firstName = user?.firstName ?? null;
  }

  const stats = [
    { label: "Encomendas ativas", value: "3", icon: <ShoppingBag className="h-5 w-5" />, accent: "#4DA3FF", href: "/dashboard/orders" },
    { label: "Propostas pendentes", value: "1", icon: <FileText className="h-5 w-5" />, accent: "#74E7FF", href: "/dashboard/rfqs" },
    { label: "Produtos guardados", value: "12", icon: <Package className="h-5 w-5" />, accent: "#63E6BE", href: "/catalog" },
    { label: "Total encomendas", value: "€2.840", icon: <TrendingUp className="h-5 w-5" />, accent: "#4DA3FF", href: "/dashboard/orders" },
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">
          Olá, {firstName || "bem-vindo"} 👋
        </h1>
        <p className="text-white/50 mt-1">
          Aqui tens o resumo da tua conta yourgift.pt
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group p-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent hover:border-white/[0.14] transition-all hover:translate-y-[-1px]"
          >
            <div
              className="p-2.5 rounded-xl w-fit mb-4"
              style={{ backgroundColor: `${stat.accent}14`, color: stat.accent }}
            >
              {stat.icon}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-white/48">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent">
          <h2 className="text-base font-semibold text-white mb-4">Ações rápidas</h2>
          <div className="space-y-2">
            {[
              { label: "Pedir nova proposta", href: "/rfq" },
              { label: "Explorar catálogo", href: "/catalog" },
              { label: "Ver as minhas encomendas", href: "/dashboard/orders" },
              { label: "Upload de ficheiros de marca", href: "/dashboard/assets" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.05] transition-colors group"
              >
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                  {action.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-[#4DA3FF] transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-[#4DA3FF]/14 bg-[#4DA3FF]/05">
          <h2 className="text-base font-semibold text-white mb-2">Próximos passos</h2>
          <p className="text-sm text-white/50 mb-4">
            Completa o teu perfil para uma experiência melhor.
          </p>
          <ul className="space-y-3">
            {[
              { label: "Adicionar dados da empresa", done: false },
              { label: "Upload do teu logo", done: false },
              { label: "Adicionar morada de entrega", done: false },
            ].map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${step.done ? "border-[#63E6BE] bg-[#63E6BE]" : "border-white/20"}`} />
                <span className={step.done ? "text-white/40 line-through" : "text-white/70"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
