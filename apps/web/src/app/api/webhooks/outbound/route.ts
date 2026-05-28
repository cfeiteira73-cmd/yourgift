import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S16: Marketplace + Ecosystem — Outbound Webhooks ─────────
//
// Clients can register webhook endpoints that receive real-time events.
// Admin can manage all endpoints; clients manage their own.
//
// GET    /api/webhooks/outbound          — list registered endpoints
// POST   /api/webhooks/outbound          — register a new endpoint
// DELETE /api/webhooks/outbound?id=...   — remove an endpoint
// POST   /api/webhooks/outbound/test     — fire a test payload to an endpoint
//
// Events emitted: order.created, order.status_changed, quote.submitted,
//                 quote.status_changed, invoice.paid, delivery.confirmed
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

const ALLOWED_EVENTS = [
  'order.created', 'order.status_changed', 'order.cancelled',
  'quote.submitted', 'quote.status_changed', 'quote.converted',
  'invoice.paid', 'delivery.confirmed', 'client.updated',
] as const;

type WebhookEvent = typeof ALLOWED_EVENTS[number];

// ── Delivery helper ────────────────────────────────────────────────────────────

async function deliverWebhook(
  url: string,
  secret: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; status?: number; ms: number }> {
  const payload = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
    source: 'yourgift-os',
  });

  // HMAC signature for verification
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  let signature = '';
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    signature = 'sha256=' + Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto unavailable — send without signature
  }

  const t0 = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-yourgift-signature': signature,
        'x-yourgift-event': event,
        'user-agent': 'YourGift-OS/1.0 Webhooks',
      },
      body: payload,
      signal: AbortSignal.timeout(8000), // 8s timeout
    });
    return { ok: resp.ok, status: resp.status, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0 };
  }
}

// ── GET: List endpoints ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());

    let query = supabase
      .from('webhook_endpoints')
      .select('id, url, events, active, created_at, last_delivery_at, last_delivery_status, delivery_count, owner_id')
      .order('created_at', { ascending: false });

    if (!isAdmin) query = query.eq('owner_id', user.id);

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01') return NextResponse.json({ endpoints: [], note: 'table_pending' });
      throw error;
    }

    // Mask secrets — never expose them in list
    return NextResponse.json({
      endpoints: (data ?? []).map(ep => ({ ...ep, secret: '••••••••' })),
      allowedEvents: ALLOWED_EVENTS,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[webhooks] GET error:', error);
    return NextResponse.json({ error: 'Webhooks unavailable' }, { status: 500 });
  }
}

// ── POST: Register endpoint or test ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url_path = request.nextUrl.pathname;
    const body = await request.json() as Record<string, unknown>;

    // Test mode
    if (url_path.endsWith('/test')) {
      const endpointId = body.endpoint_id as string;
      if (!endpointId) return NextResponse.json({ error: 'endpoint_id required' }, { status: 400 });

      const { data: ep } = await supabase.from('webhook_endpoints').select('url, secret, owner_id').eq('id', endpointId).single();
      if (!ep) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
      if (ep.owner_id !== user.id && !ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const result = await deliverWebhook(
        ep.url as string,
        ep.secret as string,
        'order.created',
        { test: true, message: 'YourGift OS webhook test payload', timestamp: new Date().toISOString() },
      );
      return NextResponse.json({ result });
    }

    // Register new endpoint
    const endpointUrl = body.url as string;
    if (!endpointUrl) return NextResponse.json({ error: 'url required' }, { status: 400 });

    // Validate URL
    try { new URL(endpointUrl); } catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }); }
    if (!endpointUrl.startsWith('https://')) return NextResponse.json({ error: 'HTTPS required' }, { status: 400 });

    const events = (body.events as string[] ?? []).filter(e => ALLOWED_EVENTS.includes(e as WebhookEvent));
    if (events.length === 0) return NextResponse.json({ error: 'At least one valid event required' }, { status: 400 });

    // Generate secret
    const secretBytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data, error } = await supabase.from('webhook_endpoints').insert({
      url: endpointUrl,
      events,
      secret,
      active: true,
      owner_id: user.id,
      owner_email: user.email,
      delivery_count: 0,
    }).select('id, url, events, active, created_at').single();

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ok: true, logged: false, reason: 'table_pending', secret });
      throw error;
    }

    // Return secret ONCE on creation
    return NextResponse.json({ ok: true, endpoint: data, secret }, { status: 201 });

  } catch (error) {
    console.error('[webhooks] POST error:', error);
    return NextResponse.json({ error: 'Webhook registration failed' }, { status: 500 });
  }
}

// ── DELETE: Remove endpoint ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());

    // Verify ownership
    let query = supabase.from('webhook_endpoints').delete().eq('id', id);
    if (!isAdmin) query = query.eq('owner_id', user.id);

    const { error } = await query;
    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ok: true, reason: 'table_pending' });
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhooks] DELETE error:', error);
    return NextResponse.json({ error: 'Webhook deletion failed' }, { status: 500 });
  }
}

// ── Named export for internal use: fire webhooks for an event ─────────────────

export async function fireWebhooks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: WebhookEvent,
  data: Record<string, unknown>,
  ownerId?: string,
): Promise<void> {
  try {
    let query = supabase
      .from('webhook_endpoints')
      .select('id, url, secret')
      .eq('active', true)
      .contains('events', [event]);

    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data: endpoints } = await query;
    if (!endpoints?.length) return;

    await Promise.allSettled(
      (endpoints as Array<{ id: string; url: string; secret: string }>).map(async ep => {
        const result = await deliverWebhook(ep.url, ep.secret, event, data);
        // Update delivery stats (delivery_count increment handled by DB trigger)
        await supabase.from('webhook_endpoints').update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: result.ok ? 'success' : 'failed',
        }).eq('id', ep.id);
      }),
    );
  } catch {
    // Non-fatal — webhook delivery errors never block main flow
  }
}
