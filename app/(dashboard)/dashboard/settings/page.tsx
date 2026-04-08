import React from "react";
import type { Metadata } from "next";
import { User, Building2, Bell, Shield, CreditCard } from "lucide-react";

export const metadata: Metadata = { title: "Definições | yourgift.pt" };

const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

const tabs = [
  { label: "Perfil", icon: <User className="h-3.5 w-3.5" />, active: true },
  { label: "Empresa", icon: <Building2 className="h-3.5 w-3.5" />, active: false },
  { label: "Notificações", icon: <Bell className="h-3.5 w-3.5" />, active: false },
  { label: "Segurança", icon: <Shield className="h-3.5 w-3.5" />, active: false },
  { label: "Faturação", icon: <CreditCard className="h-3.5 w-3.5" />, active: false },
];

const notifications = [
  {
    id: "new-order",
    label: "Confirmação de encomenda",
    description: "Recebe um email quando a tua encomenda é confirmada",
    enabled: true,
  },
  {
    id: "mockup-ready",
    label: "Mockup disponível",
    description: "Notificação quando um novo mockup está pronto para aprovação",
    enabled: true,
  },
  {
    id: "order-shipped",
    label: "Encomenda expedida",
    description: "Alerta quando a tua encomenda é enviada com código de rastreio",
    enabled: true,
  },
  {
    id: "promotions",
    label: "Promoções e novidades",
    description: "Novos produtos, descontos por volume e campanhas sazonais",
    enabled: false,
  },
];

export default async function SettingsPage() {
  let firstName = "";
  let lastName = "";
  let email = "";
  let initials = "YG";
  let imageUrl: string | null = null;

  if (hasClerkKeys) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    if (user) {
      firstName = user.firstName ?? "";
      lastName = user.lastName ?? "";
      email = user.emailAddresses[0]?.emailAddress ?? "";
      imageUrl = user.imageUrl ?? null;
      initials =
        `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "YG";
    }
  }

  const profileFields = [
    { label: "Nome", type: "text", value: firstName || "—", disabled: false },
    { label: "Apelido", type: "text", value: lastName || "—", disabled: false },
    { label: "Email", type: "email", value: email || "—", disabled: true },
    { label: "Telefone", type: "tel", value: "", placeholder: "+351 9...", disabled: false },
    { label: "Cargo", type: "text", value: "", placeholder: "Marketing Manager", disabled: false },
    { label: "Idioma", type: "text", value: "Português (PT)", disabled: false },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Definições</h1>
        <p className="text-white/50 mt-1">Gere as tuas preferências e dados de conta</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.07] bg-white/[0.02] mb-8 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab.active
                ? "bg-white/10 text-white border border-white/[0.1]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile section */}
      <div className="p-6 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent mb-6">
        <h2 className="text-base font-semibold text-white mb-6">Perfil</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#4DA3FF]/30 to-[#74E7FF]/10 border border-white/[0.1] flex items-center justify-center flex-shrink-0">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-white">{initials}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {firstName && lastName ? `${firstName} ${lastName}` : "O teu perfil"}
            </p>
            {email && <p className="text-xs text-white/40 mt-0.5">{email}</p>}
            <button type="button" className="text-xs text-[#4DA3FF] hover:underline mt-1">
              Alterar foto
            </button>
          </div>
        </div>

        {/* Form grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {profileFields.map((field) => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                defaultValue={field.value}
                disabled={field.disabled}
                placeholder={field.placeholder ?? field.value}
                className={`w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-[#4DA3FF]/40 transition-colors ${
                  field.disabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
              />
              {field.disabled && (
                <p className="text-xs text-white/25 mt-1">Gerido pelo teu login</p>
              )}
            </div>
          ))}
        </div>

        {/* Save button */}
        <button
          type="button"
          className="px-6 py-2.5 rounded-xl bg-white text-[#07111F] text-sm font-semibold hover:bg-white/90 transition-all"
        >
          Guardar alterações
        </button>
      </div>

      {/* Notifications section */}
      <div className="p-6 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="h-4 w-4 text-white/50" />
          <h2 className="text-base font-semibold text-white">Notificações</h2>
        </div>

        <div className="space-y-0 divide-y divide-white/[0.05]">
          {notifications.map((notif) => (
            <div key={notif.id} className="flex items-center justify-between py-4">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-white/80">{notif.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{notif.description}</p>
              </div>
              <div
                className={`relative flex-shrink-0 rounded-full transition-colors cursor-pointer ${
                  notif.enabled ? "bg-[#4DA3FF]" : "bg-white/10"
                }`}
                style={{ height: "22px", width: "40px" }}
              >
                <span
                  className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    notif.enabled ? "left-[22px]" : "left-[3px]"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <button
            type="button"
            className="px-6 py-2.5 rounded-xl bg-white text-[#07111F] text-sm font-semibold hover:bg-white/90 transition-all"
          >
            Guardar preferências
          </button>
        </div>
      </div>
    </div>
  );
}
