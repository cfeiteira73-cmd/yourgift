import React from "react";
import { Metadata } from "next";
import { Upload, Download, CloudUpload, FileImage, FileText, File } from "lucide-react";

export const metadata: Metadata = { title: "Ficheiros de marca | yourgift.pt" };

const files = [
  { id: 1, name: "logo.svg",             size: "24 KB",  type: "SVG", date: "10 Jan 2025",  category: "logos" },
  { id: 2, name: "brand-guidelines.pdf", size: "3.2 MB", type: "PDF", date: "10 Jan 2025",  category: "guidelines" },
  { id: 3, name: "logo-white.png",       size: "180 KB", type: "PNG", date: "11 Jan 2025",  category: "logos" },
  { id: 4, name: "logo-dark.png",        size: "175 KB", type: "PNG", date: "11 Jan 2025",  category: "logos" },
  { id: 5, name: "product-brief.pdf",    size: "1.1 MB", type: "PDF", date: "20 Jan 2025",  category: "guidelines" },
  { id: 6, name: "team-photo.jpg",       size: "4.8 MB", type: "JPG", date: "25 Jan 2025",  category: "fotos" },
  { id: 7, name: "icon.svg",             size: "12 KB",  type: "SVG", date: "1 Fev 2025",   category: "logos" },
  { id: 8, name: "style-guide.ai",       size: "18.6 MB",type: "AI",  date: "8 Fev 2025",   category: "guidelines" },
];

const typeConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  SVG: { color: "text-[#4DA3FF]",  bg: "bg-[#4DA3FF]/10",  icon: <FileImage className="h-5 w-5" /> },
  PDF: { color: "text-red-400",    bg: "bg-red-400/10",    icon: <FileText className="h-5 w-5" /> },
  PNG: { color: "text-[#74E7FF]",  bg: "bg-[#74E7FF]/10",  icon: <FileImage className="h-5 w-5" /> },
  JPG: { color: "text-[#63E6BE]",  bg: "bg-[#63E6BE]/10",  icon: <FileImage className="h-5 w-5" /> },
  AI:  { color: "text-orange-400", bg: "bg-orange-400/10", icon: <File className="h-5 w-5" /> },
};

const categories = ["Todos", "Logos", "Guidelines", "Fotos", "Outros"];

export default function AssetsPage() {
  const usedGB = 2.4;
  const totalGB = 10;
  const usedPercent = (usedGB / totalGB) * 100;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Ficheiros de marca</h1>
          <p className="text-white/50 mt-1">Logos, guidelines e recursos visuais da tua empresa</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#07111F] hover:bg-white/90 transition-all"
        >
          <Upload className="h-3.5 w-3.5" />
          Fazer upload
        </button>
      </div>

      {/* Storage bar */}
      <div className="p-4 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">Armazenamento utilizado</span>
          <span className="text-xs font-medium text-white/70">{usedGB} GB de {totalGB} GB</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4DA3FF] to-[#74E7FF]"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="text-xs text-white/30 mt-1.5">{(totalGB - usedGB).toFixed(1)} GB disponíveis</p>
      </div>

      {/* Upload zone */}
      <div className="border border-dashed border-white/[0.12] hover:border-white/[0.22] rounded-2xl p-8 mb-6 flex flex-col items-center gap-3 transition-colors cursor-pointer group">
        <div className="p-3 rounded-xl border border-dashed border-white/[0.12] group-hover:border-white/[0.22] transition-colors">
          <CloudUpload className="h-6 w-6 text-white/30 group-hover:text-white/50 transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/50 group-hover:text-white/70 transition-colors">
            Arrasta ficheiros aqui ou <span className="text-[#4DA3FF]">clica para fazer upload</span>
          </p>
          <p className="text-xs text-white/25 mt-1">
            Formatos aceites: SVG, PNG, JPG, PDF, AI, EPS — Máx. 50 MB por ficheiro
          </p>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {categories.map((cat, i) => (
          <button
            key={cat}
            type="button"
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              i === 0
                ? "bg-white/10 border-white/20 text-white"
                : "bg-transparent border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/15"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* File grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => {
          const cfg = typeConfig[file.type] ?? { color: "text-white/50", bg: "bg-white/5", icon: <File className="h-5 w-5" /> };
          return (
            <div
              key={file.id}
              className="group p-4 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent hover:border-white/[0.14] transition-all flex flex-col gap-3"
            >
              {/* Icon + type */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
              </div>

              {/* File info */}
              <div className="flex-1">
                <p className="text-xs font-medium text-white/80 break-all leading-tight">{file.name}</p>
                <p className="text-xs text-white/30 mt-1">{file.size} · {file.date}</p>
              </div>

              {/* Type badge + download */}
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  {file.type}
                </span>
                <button
                  type="button"
                  className="text-white/25 hover:text-[#4DA3FF] transition-colors"
                  aria-label={`Descarregar ${file.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/20 mt-6">
        {files.length} ficheiros · {usedGB} GB utilizados
      </p>
    </div>
  );
}
