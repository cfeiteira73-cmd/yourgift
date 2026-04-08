import { Metadata } from "next";
import { CheckCircle2, Clock, RefreshCw, Info } from "lucide-react";

export const metadata: Metadata = { title: "Mockups | yourgift.pt" };

const mockups = [
  {
    id: "MK-2025-001",
    orderId: "YG-2024-002",
    product: "Insulated Tumbler 500ml",
    status: "aguarda-aprovacao",
    dateSent: "30 Jan 2025",
    approvedAt: null,
  },
  {
    id: "MK-2025-002",
    orderId: "YG-2024-003",
    product: "Bamboo Tech Organizer",
    status: "aprovado",
    dateSent: "5 Fev 2025",
    approvedAt: "6 Fev 2025",
  },
  {
    id: "MK-2025-003",
    orderId: "YG-2025-001",
    product: "Organic Cotton Tee",
    status: "em-revisao",
    dateSent: "17 Fev 2025",
    approvedAt: null,
  },
  {
    id: "MK-2025-004",
    orderId: "YG-2025-002",
    product: "Canvas Tote Bag Premium",
    status: "aguarda-aprovacao",
    dateSent: "24 Fev 2025",
    approvedAt: null,
  },
];

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  "aguarda-aprovacao": {
    label: "Aguarda aprovação",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    dot: "bg-amber-400",
  },
  "aprovado": {
    label: "Aprovado",
    color: "text-[#63E6BE] bg-[#63E6BE]/10 border-[#63E6BE]/20",
    dot: "bg-[#63E6BE]",
  },
  "em-revisao": {
    label: "Em revisão",
    color: "text-[#4DA3FF] bg-[#4DA3FF]/10 border-[#4DA3FF]/20",
    dot: "bg-[#4DA3FF]",
  },
};

export default function MockupsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Mockups</h1>
        <p className="text-white/50 mt-1">Aprovação digital antes de produção</p>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-400/20 bg-amber-400/05 mb-8">
        <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-white/60">
          Os mockups são enviados em formato digital para revisão. Tens{" "}
          <span className="text-white/80 font-medium">48 horas</span> para aprovar ou solicitar alterações —
          após esse prazo, a produção avança automaticamente com o mockup aprovado.
        </p>
      </div>

      {/* Mockup cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockups.map((m) => {
          const cfg = statusConfig[m.status];
          const isApproved = m.status === "aprovado";
          const needsAction = m.status === "aguarda-aprovacao";

          return (
            <div
              key={m.id}
              className="p-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent flex flex-col gap-4"
            >
              {/* Product preview placeholder */}
              <div className="w-full h-36 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white/10">
                    {m.product.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="text-xs text-white/20 mt-1">Pré-visualização</div>
                </div>
              </div>

              {/* Info */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white leading-tight">{m.product}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-white/30 font-mono">{m.orderId} · Enviado a {m.dateSent}</p>
              </div>

              {/* Actions */}
              {isApproved ? (
                <div className="flex items-center gap-2 pt-1">
                  <CheckCircle2 className="h-4 w-4 text-[#63E6BE]" />
                  <span className="text-xs text-[#63E6BE]">Aprovado a {m.approvedAt}</span>
                </div>
              ) : needsAction ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#63E6BE]/30 text-xs font-medium text-[#63E6BE] hover:bg-[#63E6BE]/10 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-white/50 hover:bg-white/[0.04] transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Pedir alterações
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="h-4 w-4 text-[#4DA3FF]" />
                  <span className="text-xs text-[#4DA3FF]">A aguardar revisão da equipa</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/20 mt-8">
        {mockups.filter((m) => m.status === "aguarda-aprovacao").length} mockup(s) a aguardar aprovação
      </p>
    </div>
  );
}
