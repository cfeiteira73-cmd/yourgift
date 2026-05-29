/**
 * Zod schemas for all POST route bodies.
 *
 * These replace the hand-rolled validate.ts schemas for the most
 * security-critical routes. Import and use the safeParse helper.
 *
 * Usage:
 *   import { parseBody, OrderActionSchema } from '@/lib/schemas';
 *   const parsed = parseBody(OrderActionSchema, body);
 *   if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

// ── Reusable primitives ───────────────────────────────────────────────────────

const uuid = z.string().uuid({ message: 'Must be a valid UUID' });
const nonEmptyString = z.string().min(1, 'Required');
const optionalUuid = z.string().uuid().optional();

// ── Helper: parse + auto-400 ──────────────────────────────────────────────────

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; response: ReturnType<typeof NextResponse.json> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_root';
      details[key] = issue.message;
    }
    return {
      ok: false,
      response: NextResponse.json({ error: 'Validation failed', details }, { status: 400 }),
    };
  }
  return { ok: true, data: result.data };
}

// ── /api/reorder-brain ────────────────────────────────────────────────────────

export const ReorderBrainSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reorder'), orderId: uuid }),
  z.object({ action: z.literal('save_template'), name: nonEmptyString, orderId: uuid }),
]);

// ── /api/margin-intelligence ──────────────────────────────────────────────────

export const MarginActionSchema = z.object({
  action: z.enum(['update_target_margin', 'dismiss_upsell']),
  productId: optionalUuid,
  clientId: optionalUuid,
  targetMarginPct: z.number().min(0).max(100).optional(),
});

// ── /api/recommendations ──────────────────────────────────────────────────────

export const RecommendationActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('log_view'), productId: uuid, context: z.string().max(100).optional() }),
  z.object({ action: z.literal('log_click'), productId: uuid, context: z.string().max(100).optional() }),
  z.object({ action: z.literal('add_to_cart'), productId: uuid }),
]);

// ── /api/artwork-intelligence ─────────────────────────────────────────────────

export const ArtworkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_annotation'),
    submissionId: uuid,
    text: nonEmptyString.max(2000),
    annotationXPct: z.number().min(0).max(100),
    annotationYPct: z.number().min(0).max(100),
  }),
  z.object({
    action: z.literal('production_check'),
    submissionId: uuid,
    imageUrl: z.string().url(),
  }),
  z.object({
    action: z.literal('ai_review'),
    submissionId: uuid,
    imageUrl: z.string().url(),
  }),
]);

// ── /api/infra-resilience ─────────────────────────────────────────────────────

export const InfraActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('health_check') }),
  z.object({ action: z.literal('retry'), jobId: uuid }),
  z.object({ action: z.literal('purge'), jobId: uuid }),
  z.object({ action: z.literal('reset_circuit'), service: nonEmptyString }),
]);

// ── /api/warehouse-intelligence ───────────────────────────────────────────────

export const WarehouseActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('adjust_stock'), productId: uuid, delta: z.number(), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal('set_reorder_point'), productId: uuid, point: z.number().min(0) }),
  z.object({
    action: z.literal('receive_shipment'),
    items: z.array(z.object({
      productId: uuid,
      quantity: z.number().int().positive(),
      supplierName: z.string().max(200).optional(),
    })).min(1),
  }),
]);

// ── /api/procurement-autopilot ────────────────────────────────────────────────

export const ProcurementActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('auto_rfq'), orderId: uuid }),
  z.object({ action: z.literal('blast_suppliers'), rfqId: uuid }),
  z.object({
    action: z.literal('auto_award'),
    rfqId: uuid,
    minScore: z.number().min(0).max(100).optional(),
  }),
  z.object({
    action: z.literal('negotiate_round'),
    rfqId: uuid,
    supplierId: uuid,
    targetPrice: z.number().positive(),
  }),
]);

// ── /api/executive-brief ─────────────────────────────────────────────────────

export const ExecutiveBriefActionSchema = z.object({
  action: z.enum(['generate_brief']),
  forceRefresh: z.boolean().optional(),
});

// ── /api/analytics-platform ──────────────────────────────────────────────────

export const AnalyticsActionSchema = z.object({
  action: z.enum(['export', 'set_period']),
  period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  format: z.enum(['csv', 'json']).optional(),
});

// ── /api/payments POST validation ────────────────────────────────────────────

export const PaymentActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('log_event'), stripe_event_id: nonEmptyString, event_type: nonEmptyString, amount: z.number().optional(), currency: z.string().max(3).optional(), object_id: z.string().optional(), raw_payload: z.unknown().optional() }),
  z.object({ action: z.literal('score_payment'), order_id: uuid }),
  z.object({ action: z.literal('score_all') }),
  z.object({
    action: z.literal('sync_settlement'),
    settlement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    gross_volume: z.number().optional(),
    refunds: z.number().optional(),
    disputes: z.number().optional(),
    fees: z.number().optional(),
    net_settled: z.number().optional(),
    transaction_count: z.number().int().optional(),
    stripe_payout_id: z.string().optional(),
    internal_expected: z.number().optional(),
  }),
  z.object({ action: z.literal('review_risk'), risk_id: uuid, review_notes: z.string().max(2000).optional() }),
]);

// ── /api/org — company membership ────────────────────────────────────────────

export const OrgActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('invite_member'),
    email: z.string().email(),
    role: z.enum(['admin', 'member', 'viewer']),
  }),
  z.object({ action: z.literal('remove_member'), memberId: uuid }),
  z.object({
    action: z.literal('update_member_role'),
    memberId: uuid,
    role: z.enum(['admin', 'member', 'viewer']),
  }),
  z.object({ action: z.literal('accept_invite'), token: nonEmptyString }),
]);

// ── /api/copilot ─────────────────────────────────────────────────────────────

export const CopilotSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000),
  })).min(1).max(50),
  skipContext: z.boolean().optional(),
  stream: z.boolean().optional(),
});
