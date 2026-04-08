import { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight, Plus, Clock, CheckCircle2, XCircle, Search } from "lucide-react";

export const metadata: Metadata = { title: "Propostas | yourgift.pt" };

const rfqs = [
  {
    id: "RFQ-2025-001",
    descricao: "Cadernos A5 com capa personalizada e branding corporativo",
    qty: 500,
    status: "aprovada",
    date: "8 Jan 2025",
    valorEstimado: "€3.750",
  },
  {
    id: "RFQ-2025-002",
    descricao: "Garrafas de água reutilizáveis com gravação a laser",
    qty: 300,
    status: "em-analise",
    date: "20 Jan 2025",
    valorEstimado: "€4.200",
  },
  {
    id: "RFQ-2025-003",
    descricao: "Mochilas executivas com bordado de logótipo",
    qty: 100,
    status: "pendente",
    date: "1 Fev 2025",
    valorEstimado: "€5.800",
  },
  {
    id: "RFQ-2025-004",
    descricao: "Porta-documentos em couro vegano com impressão UV",
    qty: 150,
    status: "rejeitada",
    date: "14 Fev 2025",
    valorEstimado: "€2.100",
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  "aprovada":   { label: "Aprovada",   color: "text-[#63E6BE] bg-[#63E6BE]/10 border-[#63E6BE]/20" },
  "em-analise": { label: "Em análise", color: "text-[#4DA3FF] bg-[#4DA3FF]/10 border-[#4DA3FF]/20" },
  "pendente":   { label: "Pendente",   color: "text-white/50 bg-white/5 border-white/10" },
  "rejeitada":  { label: "Rejeitada",  color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

export default function RfqsPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Propostas</h1>
          <p className="text-white/50 mt-1">Gere os teus pedidos de orçamento</p>
        </div>
        <Link
          href="/rfq"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#07111F] hover:bg-white/90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova proposta
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Em análise", count: 1, icon: <Search className="h-4 w-4" />,      accent: "#4DA3FF" },
          { label: "Aprovadas",  count: 1, icon: <CheckCircle2 className="h-4 w-4" />, accent: "#63E6BE" },
          { label: "Pendentes",  count: 1, icon: <Clock className="h-4 w-4" />,        accent: "rgba(255,255,255,0.5)" },
          { label: "Rejeitadas", count: 1, icon: <XCircle className="h-4 w-4" />,      accent: "#f87171" },
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

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-[#4DA3FF]/20 bg-[#4DA3FF]/05 mb-6">
        <FileText className="h-4 w-4 text-[#4DA3FF] mt-0.5 flex-shrink-0" />
        <p className="text-sm text-white/60">
          As propostas aprovadas são convertidas automaticamente em encomendas. Receberás uma notificação por email assim que houver uma atualização.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                {["Referência", "Descrição", "Qtd", "Estado", "Data", "Valor Est.", ""].map((h) => (
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
              {rfqs.map((rfq) => (
                <tr key={rfq.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4 text-sm font-mono text-[#4DA3FF]">{rfq.id}</td>
                  <td className="px-5 py-4 text-sm text-white/80 max-w-[260px]">
                    <span className="line-clamp-1">{rfq.descricao}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">{rfq.qty} un</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig[rfq.status].color}`}>
                      {statusConfig[rfq.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/50">{rfq.date}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">{rfq.valorEstimado}</td>
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
        {rfqs.length} propostas · Tempo médio de resposta: 24 horas úteis
      </p>
    </div>
  );
}
