"use client";

import { motion } from "framer-motion";

const CERTIFICATIONS = [
  {
    name: "ISO 9001",
    label: "Quality Management",
    color: "#4DA3FF",
  },
  {
    name: "SEDEX",
    label: "Ethical Supply Chain",
    color: "#74E7FF",
  },
  {
    name: "FSC®",
    label: "Responsible Forestry",
    color: "#63E6BE",
  },
  {
    name: "OEKO-TEX®",
    label: "Tested for Harmful Substances",
    color: "#4DA3FF",
  },
  {
    name: "B Corp",
    label: "Certified B Corporation",
    color: "#74E7FF",
  },
];

const DELIVERY_COUNTRIES = [
  { flag: "🇵🇹", name: "Portugal" },
  { flag: "🇪🇸", name: "Espanha" },
  { flag: "🇫🇷", name: "França" },
  { flag: "🇩🇪", name: "Alemanha" },
  { flag: "🇬🇧", name: "UK" },
  { flag: "🇺🇸", name: "USA" },
];

const MANUFACTURING_COUNTRIES = [
  { flag: "🇵🇹", name: "Portugal" },
  { flag: "🇨🇳", name: "China" },
  { flag: "🇧🇩", name: "Bangladesh" },
  { flag: "🇮🇳", name: "Índia" },
  { flag: "🇹🇷", name: "Turquia" },
];

function CertBadge({ cert }: { cert: (typeof CERTIFICATIONS)[0] }) {
  return (
    <div
      className="flex flex-col items-center gap-2 px-5 py-4 rounded-2xl border transition-all duration-300 hover:scale-105 cursor-default"
      style={{
        borderColor: `${cert.color}25`,
        backgroundColor: `${cert.color}08`,
      }}
    >
      <span
        className="text-sm font-bold tracking-wide"
        style={{ color: cert.color }}
      >
        {cert.name}
      </span>
      <span className="text-[10px] text-white/40 text-center leading-tight">
        {cert.label}
      </span>
    </div>
  );
}

function CountryPill({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200">
      <span className="text-base leading-none">{flag}</span>
      <span className="text-sm text-white/65 font-medium whitespace-nowrap">{name}</span>
    </div>
  );
}

export function PartnersCertifications() {
  return (
    <section className="py-20 md:py-28 bg-[#07111F] border-y border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#63E6BE] mb-4">
            Confiança e alcance
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Padrões que importam,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #63E6BE, #74E7FF)",
              }}
            >
              alcance que surpreende
            </span>
          </h2>
          <p className="text-white/48 text-base max-w-lg mx-auto">
            Certificações internacionais, fabricantes verificados e entrega
            em 15+ países — tudo gerido por nós.
          </p>
        </motion.div>

        {/* Certifications row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.55 }}
          className="mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/30 text-center mb-5">
            Certificações e padrões de qualidade
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {CERTIFICATIONS.map((cert, i) => (
              <motion.div
                key={cert.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
              >
                <CertBadge cert={cert} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full h-px bg-white/[0.06] mb-12" />

        {/* Delivery countries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.55 }}
          className="mb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/30 text-center mb-5">
            Entregamos para empresas em
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {DELIVERY_COUNTRIES.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <CountryPill flag={c.flag} name={c.name} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Manufacturing countries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/30 text-center mb-5">
            Fabricantes verificados em
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {MANUFACTURING_COUNTRIES.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <CountryPill flag={c.flag} name={c.name} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
