import { z } from 'zod';

export const RfqItemSchema = z.object({
  productName: z.string().min(1).max(200),
  quantity: z.number().int().min(1),
  specifications: z.string().max(1000).optional(),
});

export const CreateRfqSchema = z.object({
  tenantId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(100),
  targetBudget: z.number().positive().optional(),
  currency: z.string().length(3).default('EUR'),
  deadline: z.coerce
    .date()
    .refine((d: Date) => d > new Date(), { message: 'deadline must be in the future' }),
  supplierIds: z.array(z.string().cuid()).min(1).max(20),
  items: z.array(RfqItemSchema).min(1),
});

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  comments: z.string().max(2000).optional(),
});

export type CreateRfqInput = z.infer<typeof CreateRfqSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
