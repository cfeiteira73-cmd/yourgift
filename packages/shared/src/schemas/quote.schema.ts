import { z } from 'zod';

export const QuoteItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional(),
  supplierId: z.string().cuid(),
  quantity: z.number().int().min(1),
  unitCost: z.number().positive(),
  unitPrice: z.number().positive(),
  leadTimeDays: z.number().int().min(0).max(365),
  specs: z.record(z.string()).optional(),
});

export const CreateQuoteSchema = z.object({
  clientId: z.string().cuid(),
  validUntil: z.coerce
    .date()
    .refine((d: Date) => d > new Date(), { message: 'validUntil must be in the future' }),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().max(2000).optional(),
  items: z.array(QuoteItemSchema).min(1),
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
