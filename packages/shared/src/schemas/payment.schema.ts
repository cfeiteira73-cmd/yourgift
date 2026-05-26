import { z } from 'zod';

export const CreateRefundSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().positive().multipleOf(0.01).optional(),
  reason: z.string().max(512).optional(),
  refundedBy: z.string().max(100).optional(),
});

export const CreateSubscriptionSchema = z.object({
  tenantId: z.string().cuid(),
  customerId: z.string().min(1),
  planId: z.string().min(1),
  priceId: z.string().min(1),
  trialDays: z.number().int().min(0).max(365).optional(),
  metadata: z.record(z.string()).optional(),
});

export type CreateRefundInput = z.infer<typeof CreateRefundSchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
