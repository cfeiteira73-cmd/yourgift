import { Metadata } from "next";
import { RefreshCw, Zap, Clock, ArrowRight, Tag } from "lucide-react";

export const metadata: Metadata = { title: "Reencomendar | yourgift.pt" };

const reorderProducts = [
  {
    id: 1,
    name: "Premium Leather Journal",
    initials: "LJ",
    accentColor: "#4DA3FF",
    lastOrderDate: "12 Jan 2025",
    lastQty: 100,
    unitPrice: "€14,50",
    estimatedTotal: "€1.450",
    leadTime: "18 dias úteis",
    orderId: "YG-2024-001",
  },
  {
    id: 2,
    name: "Insulated Tumbler 500ml",
    initials: "IT",
    accentColor: "#63E6BE",
    lastOrderDate: "28 Jan 2025",
    lastQty: 200,
    unitPrice: "€21,00",
    estimatedTotal: "€4.200",
    leadTime: "22 dias úteis",
    orderId: "YG-2024-002",
  },
  {
    id: 3,
    name: "Bamboo Tech Organizer",
    initials: "BO",
    accentColor: "#74E7FF",
    lastOrderDate: "3 Fev 2025",
    lastQty: 50,
    unitPrice: "€25,00",
    estimatedTotal: "€1.250",
    leadTime: "15 dias úteis",
    orderId: "YG-2024-003",
  },
  {
    id: 4,
    name: "Organic Cotton Tee",
    initials: "OT",
    accentColor: "#a78bfa",
    lastOrderDate: "15 Fev 2025",
    lastQty: 150,
    unitPrice: "€12,60",
    estimatedTotal: "€1.890",
    leadTime: "20 dias úteis",
    orderId: "YG-2025-001",
  },
];

export default function ReordersPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Reencomendar</h1>
        <p className="text-white/50 mt-1">Reorder em 1 clique — configurações guardadas</p>
      </div>

      {/* Highlight card */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#4DA3FF]/20 bg-[#4DA3FF]/05 mb-8">
        <div className="p-2.5 rounded-xl bg-[#4DA3FF]/10 flex-shrink-0">
          <Zap className="h-5 w-5 text-[#4DA3FF]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Configuração de branding guardada</h3>
          <p className="text-sm text-white/50">
            Toda a tua configuração de branding, cores, ficheiros de marca e especificações técnicas está guardada.
            Reencomendar é instantâneo — sem formulários, sem uploads repetidos.
          </p>
        </div>
      </div>

      {/* Product reorder cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reorderProducts.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent"
          >
            {/* Top row */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: `${p.accentColor}18`, color: p.accentColor }}
              >
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{p.name}</h3>
                <p className="text-xs text-white/30 font-mono mt-0.5">{p.orderId}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-[#63E6BE] bg-[#63E6BE]/10 border border-[#63E6BE]/20 flex-shrink-0">
                <Tag className="h-3 w-3" />
                Poupa 2 dias
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/30 mb-1">Última encomenda</p>
                <p className="text-xs font-medium text-white/70">{p.lastOrderDate}</p>
                <p className="text-xs text-white/40">{p.lastQty} un</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/30 mb-1">Preço unitário</p>
                <p className="text-sm font-semibold text-white">{p.unitPrice}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/30 mb-1">Total estimado</p>
                <p className="text-sm font-semibold text-white">{p.estimatedTotal}</p>
              </div>
            </div>

            {/* Lead time */}
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-3.5 w-3.5 text-white/30" />
              <p className="text-xs text-white/40">Prazo estimado: <span className="text-white/60">{p.leadTime}</span></p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-[#07111F] text-xs font-semibold hover:bg-white/90 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reencomendar
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="text-xs text-white/40 hover:text-white/70 transition-colors whitespace-nowrap"
              >
                Alterar quantidade
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
