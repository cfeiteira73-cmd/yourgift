"use client";

import { motion } from "framer-motion";

const MINI_LOGOS = [
  { name: "Galp", icon: "⛽" },
  { name: "EDP", icon: "⚡" },
  { name: "Sonae", icon: "🛒" },
  { name: "NOS", icon: "📡" },
  { name: "MEO", icon: "📱" },
  { name: "KPMG", icon: "📊" },
  { name: "Deloitte", icon: "🔷" },
  { name: "TAP", icon: "✈️" },
];

const MINI_TRACK = [...MINI_LOGOS, ...MINI_LOGOS];

export function TrustStrip() {
  return (
    <section className="border-y border-white/[0.06] bg-[#0B1526]/70 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          {/* Left: credibility statement */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded-full bg-[#63E6BE]/10 border border-[#63E6BE]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#63E6BE] text-xs font-bold">✓</span>
            </div>
            <p className="text-sm font-semibold text-white/80 leading-snug">
              Confiado por{" "}
              <span className="text-white">312+ empresas</span>{" "}
              em Portugal
            </p>
          </motion.div>

          {/* Middle: mini marquee */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0B1526] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0B1526] to-transparent z-10 pointer-events-none" />
            <motion.div
              className="flex gap-3 w-max"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 14, ease: "linear", repeat: Infinity }}
            >
              {MINI_TRACK.map((logo, i) => (
                <div
                  key={`${logo.name}-${i}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] flex-shrink-0"
                >
                  <span className="text-sm grayscale opacity-60">{logo.icon}</span>
                  <span className="text-[11px] text-white/40 font-medium whitespace-nowrap">
                    {logo.name}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: certifications */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-end gap-2 flex-wrap"
          >
            {["ISO 9001", "3 anos activos", "🇵🇹 Equipa Portuguesa"].map((item) => (
              <span
                key={item}
                className="text-xs text-white/50 bg-white/[0.04] border border-white/[0.07] px-2.5 py-1 rounded-lg font-medium"
              >
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
