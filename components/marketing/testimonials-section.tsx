"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  name: string;
  title: string;
  company: string;
  avatar: string;
  quote: string;
  result: string;
  stars: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Ana Silva",
    title: "Head of HR",
    company: "Galp Energia",
    avatar: "https://ui-avatars.com/api/?name=Ana+Silva&background=4DA3FF&color=07111F&size=80&bold=true",
    quote:
      "Recebemos 500 onboarding kits personalizados em 12 dias úteis. Qualidade impecável, packaging premium e o nosso logo perfeito. A equipa reage sempre com entusiasmo quando recebe.",
    result: "500 kits em 12 dias",
    stars: 5,
  },
  {
    name: "Pedro Costa",
    title: "Marketing Director",
    company: "EDP",
    avatar: "https://ui-avatars.com/api/?name=Pedro+Costa&background=63E6BE&color=07111F&size=80&bold=true",
    quote:
      "Encomendar 1.200 t-shirts para o nosso evento anual foi surpreendentemente simples. Mockup aprovado em 24h, produção em 10 dias. Nunca mais trabalhámos com outra empresa.",
    result: "1.200 t-shirts em 10 dias",
    stars: 5,
  },
  {
    name: "Mariana Ferreira",
    title: "Brand Manager",
    company: "Sonae MC",
    avatar: "https://ui-avatars.com/api/?name=Mariana+Ferreira&background=74E7FF&color=07111F&size=80&bold=true",
    quote:
      "O gestor dedicado foi um diferencial enorme. Acompanhou todo o processo, antecipou problemas e entregou antes do prazo. Os nossos clientes ficaram impressionados com os gift boxes.",
    result: "98% satisfação interna",
    stars: 5,
  },
  {
    name: "João Nunes",
    title: "Procurement Manager",
    company: "NOS",
    avatar: "https://ui-avatars.com/api/?name=Joao+Nunes&background=4DA3FF&color=07111F&size=80&bold=true",
    quote:
      "Já fizemos 3 encomendas este ano. O reorder system é fantástico — em 2 cliques repetimos a encomenda anterior com ajustes mínimos. Poupamos horas de trabalho administrativo.",
    result: "3 encomendas recorrentes",
    stars: 5,
  },
  {
    name: "Sofia Rodrigues",
    title: "People & Culture Lead",
    company: "KPMG Portugal",
    avatar: "https://ui-avatars.com/api/?name=Sofia+Rodrigues&background=63E6BE&color=07111F&size=80&bold=true",
    quote:
      "Os nossos kits de boas-vindas para novos colaboradores elevaram completamente a experiência de onboarding. Feedback 100% positivo dos novos — 'é a empresa mais premium em que já trabalhei'.",
    result: "+40% NPS onboarding",
    stars: 5,
  },
  {
    name: "Rui Alves",
    title: "Events & Sponsorship",
    company: "Millennium BCP",
    avatar: "https://ui-avatars.com/api/?name=Rui+Alves&background=74E7FF&color=07111F&size=80&bold=true",
    quote:
      "Para o nosso evento de fim de ano com 800 convidados, a yourgift.pt entregou 800 gift boxes premium dentro do prazo. Logística impecável, zero problemas. Recomendo sem reservas.",
    result: "800 gift boxes, zero erros",
    stars: 5,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-[#FFD700] text-[#FFD700]" />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-[#07111F]">
      {/* Background orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full opacity-10 blur-[140px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(77,163,255,0.5) 0%, rgba(99,230,190,0.3) 50%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4DA3FF] mb-4">
            Clientes satisfeitos
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Resultados reais de{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #4DA3FF, #74E7FF, #63E6BE)",
              }}
            >
              empresas reais
            </span>
          </h2>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            312 empresas confiam na yourgift.pt. Aqui estão algumas das suas histórias.
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative p-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.13] hover:bg-white/[0.05] transition-all duration-300"
            >
              {/* Quote icon */}
              <Quote className="absolute top-5 right-5 h-6 w-6 text-white/[0.07] group-hover:text-[#4DA3FF]/20 transition-colors" />

              {/* Stars */}
              <StarRating count={t.stars} />

              {/* Quote */}
              <p className="text-sm text-white/70 leading-relaxed mt-4 mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Result badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#63E6BE]/10 border border-[#63E6BE]/20 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#63E6BE]" />
                <span className="text-[11px] font-semibold text-[#63E6BE]">{t.result}</span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="h-10 w-10 rounded-full ring-2 ring-white/10"
                  loading="lazy"
                />
                <div>
                  <div className="text-sm font-semibold text-white/90">{t.name}</div>
                  <div className="text-xs text-white/40">
                    {t.title} · {t.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom stat */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-white/[0.08] bg-white/[0.03]">
            <StarRating count={5} />
            <span className="text-sm text-white/60">
              <strong className="text-white">4,9/5</strong> — média de 312 avaliações verificadas
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
