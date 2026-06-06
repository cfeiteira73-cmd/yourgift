import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ── OMEGA WORLDCLASS — Stripe Inbound Webhook Handler ────────────────────────
//
// Receives and verifies Stripe webhook events with signature validation.
// Updates order/payment state from authoritative Stripe events.
//
// CRITICAL: This endpoint must be exempt from CSRF / auth middleware.
// The middleware.ts /api/* bypass ensures it passes through correctly.
//
// Handled events:
//   payment_intent.succeeded          → order status: paid
//   payment_intent.payment_failed     → order status: payment_failed + audit log
//   payment_intent.canceled           → order status: cancelled
//   charge.dispute.created            → create dispute record
//   charge.dispute.updated            → update dispute status
//   charge.dispute.closed             → close dispute + set outcome
//   charge.refunded                   → log refund
//   checkout.session.completed        → confirm order
//   invoice.paid                      → mark invoice paid + audit
//   invoice.payment_failed            → mark invoice overdue
//
// Setup in Stripe Dashboard:
//   Endpoint: https://www.yourgift.pt/api/webhooks/stripe
//   Events: payment_intent.*, charge.dispute.*, checkout.session.completed, invoice.*
//
// ─────────────────────────────────────────────────────────────────────────────

// This route receives raw body — do not parse as JSON before signature check
export const dynamic = 'force-dynamic';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2023-10-16' as const });
}

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function auditLog(
  db: ReturnType<typeof getAdminDb>,
  action: string,
  metadata: Record<string, unknown>,
) {
  if (!db) return;
  await db.from('omega_final_audit_log').insert({
    entity_type: 'payment',
    action,
    performed_by: 'stripe_webhook',
    metadata,
  }).select('id').single();
}

export async function POST(request: Request) {
  // ── Verify Stripe signature ─────────────────────────────────────────────────
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe-webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  const db = getAdminDb();
  const eventId = event.id;
  const eventType = event.type;

  // ── Idempotency check — skip already-processed events ──────────────────────
  if (db) {
    const { data: existing } = await db
      .from('omega_final_payment_events')
      .select('id')
      .eq('stripe_event_id', eventId)
      .single();

    if (existing) {
      // Already processed — return 200 to acknowledge without reprocessing
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record the event (idempotency marker)
    await db.from('omega_final_payment_events').insert({
      stripe_event_id: eventId,
      event_type: eventType,
      object_id: (event.data.object as { id?: string })?.id ?? null,
      amount: getEventAmount(event),
      raw_payload: event,
      processed_at: new Date().toISOString(),
    });
  }

  // ── Route to handler ────────────────────────────────────────────────────────
  try {
    switch (eventType) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, db);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, db);
        break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent, db);
        break;
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute, db);
        break;
      case 'charge.dispute.updated':
        await handleDisputeUpdated(event.data.object as Stripe.Dispute, db);
        break;
      case 'charge.dispute.closed':
        await handleDisputeClosed(event.data.object as Stripe.Dispute, db);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge, db);
        break;
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, db);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, db);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, db);
        break;
      default:
        // Unhandled event type — still return 200 to acknowledge
        console.log(`[stripe-webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${eventType}:`, err);
    // Return 500 to trigger Stripe retry
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true, event_type: eventType });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getEventAmount(event: Stripe.Event): number | null {
  const obj = event.data.object as Record<string, unknown>;
  const amount = obj?.amount ?? obj?.amount_total ?? obj?.amount_paid ?? null;
  return typeof amount === 'number' ? amount : null;
}

function extractOrderId(metadata: Record<string, string> | null): string | null {
  return metadata?.order_id ?? metadata?.yourgift_order_id ?? null;
}

// ── Event handlers ─────────────────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  const orderId = extractOrderId(pi.metadata as Record<string, string>);
  if (orderId) {
    await db.from('orders').update({
      payment_status: 'paid',
      stripe_payment_intent_id: pi.id,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId);
  }
  await auditLog(db, 'payment_confirmed', {
    stripe_payment_intent_id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    order_id: orderId,
  });
}

async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  const orderId = extractOrderId(pi.metadata as Record<string, string>);
  if (orderId) {
    await db.from('orders').update({
      payment_status: 'failed',
      stripe_payment_intent_id: pi.id,
    }).eq('id', orderId);
  }
  await auditLog(db, 'payment_failed', {
    stripe_payment_intent_id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    failure_code: pi.last_payment_error?.code,
    failure_message: pi.last_payment_error?.message,
    order_id: orderId,
  });
}

async function handlePaymentIntentCanceled(
  pi: Stripe.PaymentIntent,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  const orderId = extractOrderId(pi.metadata as Record<string, string>);
  if (orderId) {
    await db.from('orders').update({
      payment_status: 'cancelled',
      stripe_payment_intent_id: pi.id,
    }).eq('id', orderId);
  }
  await auditLog(db, 'payment_cancelled', {
    stripe_payment_intent_id: pi.id,
    cancellation_reason: pi.cancellation_reason,
    order_id: orderId,
  });
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  await db.from('omega_final_disputes').upsert({
    stripe_dispute_id: dispute.id,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    due_by: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
      : null,
    evidence_submitted: false,
    created_at: new Date(dispute.created * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_dispute_id' });
  await auditLog(db, 'dispute_opened', {
    stripe_dispute_id: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
  });
}

async function handleDisputeUpdated(
  dispute: Stripe.Dispute,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  await db.from('omega_final_disputes').update({
    status: dispute.status,
    updated_at: new Date().toISOString(),
  }).eq('stripe_dispute_id', dispute.id);
}

async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  await db.from('omega_final_disputes').update({
    status: dispute.status,
    outcome: dispute.status === 'won' ? 'won' : 'lost',
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('stripe_dispute_id', dispute.id);
  await auditLog(db, 'dispute_resolved', {
    stripe_dispute_id: dispute.id,
    outcome: dispute.status,
    amount: dispute.amount,
  });
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  const totalRefunded = charge.amount_refunded;
  await auditLog(db, 'payment_refunded', {
    stripe_charge_id: charge.id,
    amount_refunded: totalRefunded,
    currency: charge.currency,
    payment_intent: charge.payment_intent,
  });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  const orderId = extractOrderId(session.metadata as Record<string, string>);
  if (orderId && session.payment_status === 'paid') {
    await db.from('orders').update({
      payment_status: 'paid',
      stripe_checkout_session_id: session.id,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId);
    await auditLog(db, 'payment_confirmed', {
      stripe_checkout_session_id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      order_id: orderId,
    });

    // Send payment confirmation email to customer
    try {
      const clientEmail = session.customer_email ?? session.customer_details?.email;
      if (clientEmail) {
        const { data: order } = await db.from('orders').select('ref, total_amount').eq('id', orderId).single();
        const { sendEmail, paymentConfirmationEmail } = await import('@/lib/email');
        const emailContent = paymentConfirmationEmail({
          clientName: session.customer_details?.name ?? 'Cliente',
          orderRef: (order as Record<string, unknown>)?.ref as string ?? orderId,
          amount: ((order as Record<string, unknown>)?.total_amount as number ?? (session.amount_total ?? 0) / 100),
          stripeSessionId: session.id,
        });
        await sendEmail({ to: clientEmail, ...emailContent });
      }
    } catch (emailErr) {
      console.warn('[stripe-webhook] Payment email failed (non-blocking):', emailErr);
    }
  }
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  if (invoice.metadata?.yourgift_invoice_id) {
    await db.from('invoices').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', invoice.metadata.yourgift_invoice_id);
  }
  await auditLog(db, 'invoice_paid', {
    stripe_invoice_id: invoice.id,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    yourgift_invoice_id: invoice.metadata?.yourgift_invoice_id,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof getAdminDb>,
) {
  if (!db) return;
  if (invoice.metadata?.yourgift_invoice_id) {
    await db.from('invoices').update({
      status: 'overdue',
    }).eq('id', invoice.metadata.yourgift_invoice_id);
  }
  await auditLog(db, 'invoice_payment_failed', {
    stripe_invoice_id: invoice.id,
    attempt_count: invoice.attempt_count,
    next_payment_attempt: invoice.next_payment_attempt,
    yourgift_invoice_id: invoice.metadata?.yourgift_invoice_id,
  });
}
