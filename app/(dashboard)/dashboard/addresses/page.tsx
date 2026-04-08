import React from "react";
import { Metadata } from "next";
import { Plus, MapPin, Star, Pencil, Trash2, Building2, Warehouse, Briefcase } from "lucide-react";

export const metadata: Metadata = { title: "Moradas | yourgift.pt" };

const addresses = [
  {
    id: 1,
    name: "Sede Lisboa",
    address: "Av. da Liberdade, 180, 3.º Dto",
    city: "1250-146 Lisboa",
    country: "Portugal",
    contact: "Ana Ferreira",
    phone: "+351 21 000 1234",
    type: "principal",
    isPrincipal: true,
  },
  {
    id: 2,
    name: "Armazém Loures",
    address: "Rua das Indústrias, 45, Nave C",
    city: "2670-480 Loures",
    country: "Portugal",
    contact: "Carlos Mendes",
    phone: "+351 21 990 5678",
    type: "armazem",
    isPrincipal: false,
  },
  {
    id: 3,
    name: "Escritório Porto",
    address: "Rua de Santa Catarina, 102, 2.º Esq",
    city: "4000-450 Porto",
    country: "Portugal",
    contact: "Mariana Costa",
    phone: "+351 22 200 9876",
    type: "escritorio",
    isPrincipal: false,
  },
];

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  principal:  { label: "Principal",   color: "text-amber-400 bg-amber-400/10 border-amber-400/20",  icon: <Star className="h-3 w-3" /> },
  armazem:    { label: "Armazém",     color: "text-[#4DA3FF] bg-[#4DA3FF]/10 border-[#4DA3FF]/20", icon: <Warehouse className="h-3 w-3" /> },
  escritorio: { label: "Escritório",  color: "text-[#74E7FF] bg-[#74E7FF]/10 border-[#74E7FF]/20", icon: <Briefcase className="h-3 w-3" /> },
};

export default function AddressesPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Moradas de entrega</h1>
          <p className="text-white/50 mt-1">Gere os teus endereços de envio</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#07111F] hover:bg-white/90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar morada
        </button>
      </div>

      {/* Address grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {addresses.map((addr) => {
          const cfg = typeConfig[addr.type];
          return (
            <div
              key={addr.id}
              className={`p-5 rounded-2xl border bg-gradient-to-b from-white/[0.05] to-transparent flex flex-col gap-4 ${
                addr.isPrincipal ? "border-amber-400/20" : "border-white/[0.07]"
              }`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/[0.05]">
                    <Building2 className="h-4 w-4 text-white/50" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{addr.name}</h3>
                    {addr.isPrincipal && (
                      <span className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                        <Star className="h-3 w-3 fill-amber-400" /> Morada principal
                      </span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>

              {/* Address details */}
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white/70">{addr.address}</p>
                    <p className="text-sm text-white/50">{addr.city}</p>
                    <p className="text-xs text-white/30">{addr.country}</p>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="pt-1 border-t border-white/[0.06]">
                <p className="text-xs text-white/40">
                  Contacto: <span className="text-white/60">{addr.contact}</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-white/50">{addr.phone}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                {!addr.isPrincipal && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                )}
                {!addr.isPrincipal && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-amber-400/60 hover:text-amber-400 transition-colors ml-auto"
                  >
                    <Star className="h-3 w-3" /> Definir como principal
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add new card */}
        <button
          type="button"
          className="p-5 rounded-2xl border border-dashed border-white/[0.12] hover:border-white/[0.22] bg-transparent hover:bg-white/[0.02] transition-all flex flex-col items-center justify-center gap-3 min-h-[200px] group"
        >
          <div className="p-3 rounded-xl border border-dashed border-white/[0.12] group-hover:border-white/[0.22] transition-colors">
            <Plus className="h-5 w-5 text-white/30 group-hover:text-white/50 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white/40 group-hover:text-white/60 transition-colors">Adicionar nova morada</p>
            <p className="text-xs text-white/20 mt-0.5">Clica para configurar</p>
          </div>
        </button>
      </div>
    </div>
  );
}
