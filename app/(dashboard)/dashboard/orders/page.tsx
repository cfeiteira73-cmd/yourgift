import { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, ArrowRight, Package, Truck, CheckCircle2, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Encomendas | yourgift.pt" };

const orders = [
  { id: "YG-2024-001", product: "Premium Leather Journal", qty: 100, status: "entregue", date: "12 Jan 2025", total: "€1.450" },
  { id: "YG-2024-002", product: "Insulated Tumbler 500ml", qty: 200, status: "em-producao", date: "28 Jan 2025", total: "€4.200" },
  { id: "YG-2024-003", product: "Bamboo Tech Organizer", qty: 50, status: "expedida", date: "3 Fev 2025", total: "€1.250" },
  { id: "YG-2025-001", product: "Organic Cotton Tee", qty: 150, status: "em-producao", date: "15 Fev 2025", total: "€1.890" },
  { id: "YG-2025-002", product: "Canvas Tote Bag Premium", qty: 300, status: "pendente", date: "22 Fev 2025", total: "€2.100" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  "entregue":    { label: "Entregue",     color: "text-[#63E6BE] bg-[#63E6BE]/10 border-[#63E6BE]/20" },
  "em-producao": { label: "Em produção",  color: "text-[#4DA3FF] bg-[#4DA3FF]/10 border-[#4DA3FF]/20" },
  "expedida":    { label: "Expedida",     color: "text-[#74E7FF] bg-[#74E7FF]/10 border-[#74E7FF]/20" },
  "pendente":    { label: "Pendente",     color: "text-white/50 bg-white/5 border-white/10" },
  "cancelada":   { label: "Cancelada",    color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

export default function OrdersPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Encomendas</h1>
          <p className="text-white/50 mt-1">Acompanha o estado das tuas encomendas</p>
        </div>
        <Link
          href="/rfq"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#07111F] hover:bg-white/90 transition-all"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          Nova proposta
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Em produção", count: 2, icon: <Package className="h-4 w-4" />, accent: "#4DA3FF" },
          { label: "Expedidas",   count: 1, icon: <Truck className="h-4 w-4" />,   accent: "#74E7FF" },
          { label: "Entregues",   count: 1, icon: <CheckCircle2 className="h-4 w-4" />, accent: "#63E6BE" },
          { label: "Pendentes",   count: 1, icon: <Clock className="h-4 w-4" />,   accent: "rgba(255,255,255,0.5)" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent"
          >
            <div className="flex items-center gap-2 mb-2" style={{ color: s.accent }}>
              {s.icon}
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{s.count}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                {["Encomenda", "Produto", "Qtd", "Estado", "Data", "Total", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-medium text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4 text-sm font-mono text-[#4DA3FF]">{order.id}</td>
                  <td className="px-5 py-4 text-sm text-white/80">{order.product}</td>
                  <td className="px-5 py-4 text-sm text-white/60">{order.qty} un</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig[order.status].color}`}>
                      {statusConfig[order.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/50">{order.date}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">{order.total}</td>
                  <td className="px-5 py-4">
                    <Link href="#" className="text-xs text-[#4DA3FF] hover:underline flex items-center gap-1">
                      Ver <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-white/20 mt-6">
        {orders.length} encomendas · Ordenadas por data (mais recente primeiro)
      </p>
    </div>
  );
}
