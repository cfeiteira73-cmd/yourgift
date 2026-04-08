"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Send, Loader2 } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Nome obrigatório (mínimo 2 caracteres)"),
  email: z.string().email("Email inválido"),
  company: z.string().optional(),
  subject: z.enum(["proposta", "suporte", "parceria", "outro"], {
    errorMap: () => ({ message: "Seleciona um assunto" }),
  }),
  message: z.string().min(20, "Mensagem deve ter pelo menos 20 caracteres"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const subjectOptions: { value: ContactFormData["subject"]; label: string }[] = [
  { value: "proposta", label: "Pedir proposta" },
  { value: "suporte", label: "Suporte técnico" },
  { value: "parceria", label: "Parceria" },
  { value: "outro", label: "Outro" },
];

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4DA3FF]/50 focus:bg-white/[0.07] transition-all duration-200";

const labelClass = "block text-sm font-medium text-white/64 mb-1.5";
const errorClass = "text-xs text-red-400 mt-1.5";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao enviar mensagem");
      }
      setStatus("success");
      reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro inesperado. Tenta novamente.");
      setStatus("error");
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {status === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl border border-[#63E6BE]/20 bg-[#07111F]/90 backdrop-blur-sm p-10 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#63E6BE]/12 flex items-center justify-center mb-5">
              <CheckCircle2 className="h-8 w-8 text-[#63E6BE]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Mensagem enviada!</h3>
            <p className="text-white/54 text-sm mb-6">
              Respondemos em 24h úteis.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors font-medium"
            >
              Enviar outra mensagem
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        style={{ visibility: status === "success" ? "hidden" : "visible" }}
        noValidate
      >
        {/* Name + Email row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>
              Nome <span className="text-white/38">*</span>
            </label>
            <input
              {...register("name")}
              type="text"
              placeholder="O teu nome"
              autoComplete="name"
              className={inputClass}
            />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Email <span className="text-white/38">*</span>
            </label>
            <input
              {...register("email")}
              type="email"
              placeholder="email@empresa.pt"
              autoComplete="email"
              className={inputClass}
            />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>
        </div>

        {/* Company */}
        <div>
          <label className={labelClass}>Empresa</label>
          <input
            {...register("company")}
            type="text"
            placeholder="Nome da empresa (opcional)"
            autoComplete="organization"
            className={inputClass}
          />
        </div>

        {/* Subject */}
        <div>
          <label className={labelClass}>
            Assunto <span className="text-white/38">*</span>
          </label>
          <select
            {...register("subject")}
            className={`${inputClass} appearance-none cursor-pointer`}
            defaultValue=""
          >
            <option value="" disabled className="bg-[#07111F] text-white/40">
              Seleciona um assunto
            </option>
            {subjectOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0B1526] text-white">
                {opt.label}
              </option>
            ))}
          </select>
          {errors.subject && <p className={errorClass}>{errors.subject.message}</p>}
        </div>

        {/* Message */}
        <div>
          <label className={labelClass}>
            Mensagem <span className="text-white/38">*</span>
          </label>
          <textarea
            {...register("message")}
            rows={5}
            placeholder="Como podemos ajudar? Descreve o teu projeto ou questão..."
            className={`${inputClass} resize-none`}
          />
          {errors.message && <p className={errorClass}>{errors.message.message}</p>}
        </div>

        {/* API error */}
        {status === "error" && errorMsg && (
          <p className="text-sm text-red-400 bg-red-400/08 border border-red-400/20 rounded-xl px-4 py-3">
            {errorMsg}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex items-center gap-2 bg-white text-[#07111F] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              A enviar...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar mensagem
            </>
          )}
        </button>
      </form>
    </div>
  );
}
