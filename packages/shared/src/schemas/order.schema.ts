import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional(),
  quantity: z.number().int().min(1).max(10_000),
  unitPrice: z.number().positive().max(1_000_000),
});

export const CreateOrderSchema = z.object({
  companyId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  campaignId: z.string().cuid().optional(),
  items: z.array(OrderItemSchema).min(1).max(500),
  shippingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    country: z.string().length(2), // ISO 3166-1 alpha-2
    postalCode: z.string().min(3).max(20),
  }),
});

export const OrderStatusSchema = z.enum([
  'created',
  'pending_payment',
  'paid',
  'approved',
  'fulfilling',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'partially_refunded',
  'payment_expired',
]);

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
/**
 * Extended order status type including payment lifecycle statuses not present
 * in the base OrderStatus from types.ts. Re-exported as OrderStatusExtended
 * to avoid a name collision with the existing OrderStatus union type.
 */
export type OrderStatusExtended = z.infer<typeof OrderStatusSchema>;
