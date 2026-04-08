import { z } from "zod";

export const rfqSchema = z.object({
  // Contact
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  company: z.string().min(1, "Nome da empresa é obrigatório"),
  vat: z.string().optional(),
  role: z.string().optional(),

  // Project
  objective: z.string().min(10, "Descreve o objetivo do projeto"),
  budget: z.enum(["under_1k", "1k_5k", "5k_15k", "15k_50k", "over_50k"]),
  deadline: z.string().min(1, "Indica o prazo pretendido"),
  quantity: z.number().min(1, "Quantidade mínima é 1"),
  brandingMethod: z.string().optional(),

  // Products
  products: z
    .array(
      z.object({
        productId: z.string().optional(),
        name: z.string(),
        quantity: z.number().min(1),
        notes: z.string().optional(),
      })
    )
    .optional(),

  // Delivery
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryCountry: z.string().default("PT"),

  // Files
  files: z.array(z.string()).optional(),

  // Notes
  notes: z.string().optional(),

  // Newsletter
  acceptMarketing: z.boolean().default(false),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "Deves aceitar os termos",
  }),
});

export type RFQInput = z.infer<typeof rfqSchema>;

export const contactSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  subject: z.string().min(1, "Assunto obrigatório"),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres"),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "Deves aceitar os termos",
  }),
});

export type ContactInput = z.infer<typeof contactSchema>;
