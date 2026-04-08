"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Upload, CheckCircle2, Loader2, X } from "lucide-react";
import { rfqSchema, type RFQInput } from "@/lib/validations";
import { submitRFQ } from "@/actions/submit-rfq";

const budgetOptions = [
  { value: "under_1k", label: "Menos de €1.000" },
  { value: "1k_5k", label: "€1.000 – €5.000" },
  { value: "5k_15k", label: "€5.000 – €15.000" },
  { value: "15k_50k", label: "€15.000 – €50.000" },
  { value: "over_50k", label: "Mais de €50.000" },
];

type Status = "idle" | "submitting" | "success" | "error";

export function RFQForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [files, setFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RFQInput>({
    resolver: zodResolver(rfqSchema),
    defaultValues: {
      deliveryCountry: "PT",
      acceptMarketing: false,
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RFQInput) => {
    setStatus("submitting");
    try {
      await submitRFQ(data);
      setStatus("success");
      reset();
      setFiles([]);
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="p-10 rounded-2xl border border-[#63E6BE]/22 bg-[#63E6BE]/05 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-[#63E6BE] mx-auto mb-5" />
        <h3 className="text-xl font-semibold text-white mb-3">
          Proposta recebida com sucesso!
        </h3>
        <p className="text-white/58 mb-6">
          A nossa equipa vai analisar o teu pedido e entrar em contacto em até
          48 horas úteis.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-[#4DA3FF] hover:text-[#74E7FF] transition-colors"
        >
          Submeter outro pedido
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Section: Contact */}
      <FormSection title="Dados de contacto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome completo *" error={errors.name?.message}>
            <input
              {...register("name")}
              placeholder="João Silva"
              className={inputClass(!!errors.name)}
            />
          </Field>
          <Field label="Email *" error={errors.email?.message}>
            <input
              {...register("email")}
              type="email"
              placeholder="joao@empresa.pt"
              className={inputClass(!!errors.email)}
            />
          </Field>
          <Field label="Empresa *" error={errors.company?.message}>
            <input
              {...register("company")}
              placeholder="Nome da empresa"
              className={inputClass(!!errors.company)}
            />
          </Field>
          <Field label="Telefone" error={errors.phone?.message}>
            <input
              {...register("phone")}
              type="tel"
              placeholder="+351 910 000 000"
              className={inputClass(!!errors.phone)}
            />
          </Field>
          <Field label="NIF (opcional)" error={errors.vat?.message}>
            <input
              {...register("vat")}
              placeholder="PT500000000"
              className={inputClass(!!errors.vat)}
            />
          </Field>
          <Field label="Cargo" error={errors.role?.message}>
            <input
              {...register("role")}
              placeholder="Marketing Manager"
              className={inputClass(!!errors.role)}
            />
          </Field>
        </div>
      </FormSection>

      {/* Section: Project */}
      <FormSection title="Detalhes do projeto">
        <div className="space-y-4">
          <Field
            label="Objetivo do projeto *"
            error={errors.objective?.message}
          >
            <textarea
              {...register("objective")}
              placeholder="Descreve o projeto — para quem é, qual a ocasião, que mensagem queres transmitir..."
              rows={4}
              className={`${inputClass(!!errors.objective)} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Budget estimado *" error={errors.budget?.message}>
              <select
                {...register("budget")}
                className={inputClass(!!errors.budget)}
              >
                <option value="">Selecionar</option>
                {budgetOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prazo pretendido *" error={errors.deadline?.message}>
              <input
                {...register("deadline")}
                type="date"
                className={inputClass(!!errors.deadline)}
              />
            </Field>

            <Field label="Quantidade aprox. *" error={errors.quantity?.message}>
              <input
                {...register("quantity", { valueAsNumber: true })}
                type="number"
                min={1}
                placeholder="100"
                className={inputClass(!!errors.quantity)}
              />
            </Field>

            <Field label="Método de branding" error={errors.brandingMethod?.message}>
              <select
                {...register("brandingMethod")}
                className={inputClass(!!errors.brandingMethod)}
              >
                <option value="">A definir</option>
                <option value="embroidery">Bordado</option>
                <option value="screen-print">Serigrafia</option>
                <option value="laser-engraving">Gravação Laser</option>
                <option value="uv-print">Impressão UV</option>
                <option value="debossing">Debossing</option>
                <option value="sublimation">Sublimação</option>
              </select>
            </Field>
          </div>
        </div>
      </FormSection>

      {/* Section: Files */}
      <FormSection title="Ficheiros e assets">
        <div
          className="border-2 border-dashed border-white/[0.1] rounded-2xl p-8 text-center hover:border-[#4DA3FF]/30 transition-colors cursor-pointer group"
          onClick={() => document.getElementById("rfq-file-input")?.click()}
        >
          <input
            id="rfq-file-input"
            type="file"
            multiple
            accept=".pdf,.ai,.eps,.png,.jpg,.zip"
            className="sr-only"
            onChange={(e) => {
              const newFiles = Array.from(e.target.files || []);
              setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
            }}
          />
          <Upload className="h-8 w-8 text-white/30 group-hover:text-[#4DA3FF] transition-colors mx-auto mb-3" />
          <p className="text-sm text-white/52">
            Logo, brandbook, referências visuais
          </p>
          <p className="text-xs text-white/30 mt-1">
            PDF, AI, EPS, PNG, JPG, ZIP — máx. 5 ficheiros
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm text-white/60 bg-white/[0.04] rounded-xl px-4 py-2.5"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="text-white/30 hover:text-white/60 transition-colors ml-3"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* Section: Notes */}
      <FormSection title="Notas adicionais">
        <Field label="Informações extra" error={errors.notes?.message}>
          <textarea
            {...register("notes")}
            placeholder="Qualquer detalhe relevante — referências, restrições, requisitos especiais..."
            rows={3}
            className={`${inputClass(false)} resize-none`}
          />
        </Field>
      </FormSection>

      {/* Terms */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            {...register("acceptTerms")}
            type="checkbox"
            className="mt-0.5 rounded border-white/20 bg-white/[0.06] text-[#4DA3FF] focus:ring-[#4DA3FF]"
          />
          <span className="text-sm text-white/52">
            Aceito os{" "}
            <a href="/terms" className="text-[#4DA3FF] hover:underline">
              Termos de Serviço
            </a>{" "}
            e a{" "}
            <a href="/privacy-policy" className="text-[#4DA3FF] hover:underline">
              Política de Privacidade
            </a>{" "}
            *
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-xs text-red-400 ml-7">{errors.acceptTerms.message}</p>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            {...register("acceptMarketing")}
            type="checkbox"
            className="mt-0.5 rounded border-white/20 bg-white/[0.06] text-[#4DA3FF] focus:ring-[#4DA3FF]"
          />
          <span className="text-sm text-white/40">
            Aceito receber novidades e inspiração da yourgift.pt (opcional)
          </span>
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="flex items-center justify-center gap-2.5 w-full sm:w-auto bg-white text-[#07111F] px-8 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/92 transition-all hover:scale-[1.01] shadow-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            A submeter...
          </>
        ) : (
          <>
            Submeter proposta
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <AnimatePresence>
        {status === "error" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-400"
          >
            Ocorreu um erro. Tenta novamente ou contacta-nos diretamente.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38 mb-4 pb-3 border-b border-white/[0.06]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all ${
    hasError
      ? "border-red-400/60 focus:ring-red-400/30"
      : "border-white/[0.1] focus:border-[#4DA3FF]/50 focus:ring-[#4DA3FF]/15"
  }`;
}
