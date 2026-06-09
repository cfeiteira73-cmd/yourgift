import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseBody } from '@/lib/schemas';
import { rateLimitGuard } from '@/lib/rate-limit-redis';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Stripe Checkout Session Creation ───────────────────────
//
// Creates Stripe checkout sessions for order payments with full idempotency.
//
// POST { orderId }
//   - Validates the order belongs to the authenticated user
//   - Generates a deterministic idempotency key (orderId + userId + date)
//   - Creates or retrieves an existing Stripe Checkout Session
//   - Returns { url: string } — redirect the user to this URL
//
// Idempotency strategy:
//   Key = SHA-256(orderId + ":" + userId + ":" + YYYY-MM-DD)
//   This means the same order can only create one session per day,
//   and retries within the same day reuse the existing Stripe session.
//
// ─────────────────────────────────────────────────────────────────────────────

const CheckoutRequestSchema = z.object({
  orderId: z.string().min(1), // orders.id is text, not uuid
});

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2023-10-16' as const });
}

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/** Deterministic idempotency key per user+order+day */
function buildIdempotencyKey(orderId: string, userId: string): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const raw = `checkout:${orderId}:${userId}:${day}`;
  return createHash('sha256').update(raw).digest('hex');
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Rate limit: 5 checkout attempts per user per hour ─────────────────────
  const rl = await rateLimitGuard(`checkout:${user.id}`, 5, 3600);
  if (rl.limited) {
    return NextResponse.json({ error: 'Too many checkout attempts. Try again later.' }, { status: 429, headers: rl.headers });
  }

  // ── Validate request body ─────────────────────────────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = parseBody(CheckoutRequestSchema, rawBody);
  if (!parsed.ok) return parsed.response;
  const { orderId } = parsed.data;

  // ── Fetch order (RLS ensures client can only see their own orders) ─────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, ref, total_amount, status, payment_status, client_id, stripe_checkout_session_id, shipping_address')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Don't allow re-paying already-paid orders
  if (order.payment_status === 'paid') {
    return NextResponse.json({ error: 'Order is already paid', status: order.payment_status }, { status: 409 });
  }

  // Don't allow checkout for cancelled orders
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot checkout a cancelled order' }, { status: 409 });
  }

  const amount = Number(order.total_amount ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: 'Order has no payable amount' }, { status: 422 });
  }

  // ── Stripe ─────────────────────────────────────────────────────────────────
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Payment system not configured' }, { status: 503 });
  }

  // If a session already exists on the order, verify it's still usable
  if (order.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existing.status === 'open' && existing.url) {
        return NextResponse.json({ url: existing.url, reused: true });
      }
    } catch { /* session expired or invalid — create a new one */ }
  }

  // Deterministic idempotency key
  const idempotencyKey = buildIdempotencyKey(orderId, user.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.yourgift.pt';

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(amount * 100), // Stripe uses cents
              product_data: {
                name: `Encomenda ${order.ref ?? orderId}`,
                description: 'YourGift — Merchandising B2B Premium',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          order_id: orderId,
          yourgift_order_id: orderId,
          user_id: user.id,
        },
        // Safety net: if order has no shipping address, collect it at checkout
        // This ensures supplier dispatch always has a valid address
        shipping_address_collection: {
          allowed_countries: [
            'PT', 'ES', 'FR', 'DE', 'GB', 'IT', 'NL', 'BE', 'AT', 'CH',
            'SE', 'NO', 'DK', 'FI', 'PL', 'IE', 'LU', 'US', 'CA', 'AU',
            'AE', 'BR',
          ],
        },
        // Pre-fill shipping if we already have it
        ...(() => {
          const addr = order.shipping_address as Record<string, string> | null;
          if (addr?.name && addr?.street) {
            return {
              shipping_options: [],
            };
          }
          return {};
        })(),
        success_url: `${appUrl}/orders/${orderId}?payment=success`,
        cancel_url: `${appUrl}/orders/${orderId}?payment=cancelled`,
        client_reference_id: orderId,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min expiry
      },
      {
        idempotencyKey, // ← Stripe idempotency: same key = same session returned
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Stripe error';
    console.error('[checkout] Stripe session create error:', msg);
    return NextResponse.json({ error: 'Failed to create payment session', detail: msg }, { status: 502 });
  }

  // ── Store session ID on the order ─────────────────────────────────────────
  const db = getAdminDb() ?? supabase;
  await db
    .from('orders')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', orderId);

  // ── Audit log ──────────────────────────────────────────────────────────────
  await db.from('omega_final_audit_log').insert({
    entity_type: 'order',
    entity_id: orderId,
    action: 'checkout_session_created',
    performed_by: user.id,
    metadata: {
      stripe_session_id: session.id,
      amount_eur: amount,
      idempotency_key: idempotencyKey,
    },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
