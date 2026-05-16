"use client";

import { motion } from "framer-motion";

const CLIENTS = [
  { name: "Galp", icon: "⛽", color: "#FF6B00" },
  { name: "EDP", icon: "⚡", color: "#00A859" },
  { name: "Sonae", icon: "🛒", color: "#0066CC" },
  { name: "Jerónimo Martins", icon: "🏪", color: "#E31E24" },
  { name: "NOS", icon: "📡", color: "#FF6B00" },
  { name: "MEO", icon: "📱", color: "#00AEEF" },
  { name: "Millennium BCP", icon: "🏦", color: "#CC0000" },
  { name: "Santander", icon: "🔴", color: "#EC0000" },
  { name: "BPI", icon: "💳", color: "#003DA5" },
  { name: "KPMG", icon: "📊", color: "#00338D" },
  { name: "Deloitte", icon: "🔷", color: "#86BC25" },
  { name: "PwC", icon: "📈", color: "#D04A02" },
  { name: "Vodafone", icon: "📶", color: "#E60000" },
  { name: "Altice", icon: "🌐", color: "#003DA5" },
  { name: "CTT", icon: "✉️", color: "#C8102E" },
  { name: "TAP", icon: "✈️", color: "#006E4A" },
];

// Duplicate for seamless loop
const TRACK = [...CLIENTS, ...CLIENTS];

function LogoItem({ client }: { client: typeof CLIENTS[0] }) {
  return (
    <div className="group flex items-center gap-2.5 px-6 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.07] transition-all duration-300 cursor-default flex-shrink-0">
      <span className="text-xl grayscale group-hover:grayscale-0 transition-all duration-300">
        {client.icon}
      </span>
      <span className="text-sm font-semibold text-white/38 group-hover:text-white/80 transition-colors duration-300 whitespace-nowrap">
        {client.name}
      </span>
    </div>
  );
}

export function ClientLogos() {
  return (
    <section className="py-14 border-y border-white/[0.05] bg-[#07111F] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-8 mb-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
          Confiado pelas maiores empresas de Portugal
        </p>
      </div>

      {/* Marquee track */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#07111F] to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#07111F] to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex gap-3 w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 28,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {TRACK.map((client, i) => (
            <LogoItem key={`${client.name}-${i}`} client={client} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
