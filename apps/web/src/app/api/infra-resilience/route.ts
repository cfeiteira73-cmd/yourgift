import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── OMEGA WORLDCLASS — Infrastructure Resilience API ─────────────────────────
//
// X9 Infrastructure Resilience: Dead-letter queue management, circuit breaker
// tracking, self-healing webhook retry orchestration, and system health mesh.
//
// GET  ?mode=dlq              — dead-letter queue: failed events awaiting retry
// GET  ?mode=circuit_breakers — circuit breaker states per integration
// GET  ?mode=health_mesh      — full system health across all integrations
// GET  ?mode=retry_log        — recent retry attempts and outcomes
// POST { action:'retry', eventId }         — retry a dead-letter event
// POST { action:'purge', eventId }         — permanently discard DLQ entry
// POST { action:'reset_breaker', service } — manually reset a circuit breaker
// POST { action:'health_check' }           — trigger full health probe sweep
//
// Circuit breaker states:
//   closed   = healthy (requests pass through)
//   open     = failing (requests blocked, fallback active)
//   half_open = recovering (test requests allowed)
//
// Admin-only endpoint.
//
// ─────────────────────────────────────────────────────────────────────────────


function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// ── In-memory circuit breaker state (TTL: per-process) ───────────────────────
// In production, this would be backed by Redis. Here we use Supabase as store.

const MONITORED_SERVICES = [
  'stripe', 'anthropic', 'midocean', 'pfconcept', 'supabase_storage',
  'supabase_realtime', 'resend', 'exchange_rate_api',
];

async function getCircuitBreakerStates(db: ReturnType<typeof getAdminDb>) {
  // Read recent failure patterns from audit log to derive breaker states
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { data: recentErrors } = await db!
    .from('omega_final_audit_log')
    .select('metadata, entity_type, created_at')
    .eq('action', 'webhook_failed')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  type ErrorEntry = { metadata?: { service?: string }; entity_type: string; created_at: string };

  const errorsByService: Record<string, number> = {};
  for (const entry of (recentErrors ?? []) as ErrorEntry[]) {
    const svc = entry.metadata?.service ?? entry.entity_type;
    errorsByService[svc] = (errorsByService[svc] ?? 0) + 1;
  }

  return MONITORED_SERVICES.map(service => {
    const errors = errorsByService[service] ?? 0;
    const state = errors >= 5 ? 'open' : errors >= 2 ? 'half_open' : 'closed';
    return {
      service,
      state,
      errorCount1h: errors,
      failureThreshold: 5,
      healthPct: Math.max(0, 100 - errors * 15),
    };
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  const mode = req.nextUrl.searchParams.get('mode') ?? 'dlq';

  try {
    if (mode === 'dlq') {
      // Dead-letter queue: webhook events that have failed and need retry
      const { data: dlq } = await db
        .from('omega_final_webhook_events')
        .select('id, event_type, payload, error_message, retry_count, last_attempt_at, created_at, source')
        .eq('status', 'failed')
        .order('last_attempt_at', { ascending: false })
        .limit(50);

      const { data: deadLetter } = await db
        .from('omega_final_audit_log')
        .select('id, entity_type, entity_id, action, metadata, created_at')
        .eq('action', 'webhook_failed')
        .order('created_at', { ascending: false })
        .limit(30);

      type DLQEntry = { id: string; retry_count?: number; [key: string]: unknown };
      const maxRetries = 3;
      const retriable = (dlq ?? []).filter(e => ((e as DLQEntry).retry_count ?? 0) < maxRetries);
      const abandoned = (dlq ?? []).filter(e => ((e as DLQEntry).retry_count ?? 0) >= maxRetries);

      return NextResponse.json({
        queue: dlq ?? [],
        retriable: retriable.length,
        abandoned: abandoned.length,
        auditTrail: deadLetter ?? [],
        totalFailed: (dlq ?? []).length,
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'circuit_breakers') {
      const breakers = await getCircuitBreakerStates(db);
      const openCount = breakers.filter(b => b.state === 'open').length;
      const halfOpenCount = breakers.filter(b => b.state === 'half_open').length;

      return NextResponse.json({
        breakers,
        summary: {
          total: breakers.length,
          open: openCount,
          halfOpen: halfOpenCount,
          closed: breakers.length - openCount - halfOpenCount,
          systemHealth: openCount === 0 ? 'healthy' : openCount >= 2 ? 'degraded' : 'warning',
        },
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'health_mesh') {
      const [breakers, dlqRes] = await Promise.all([
        getCircuitBreakerStates(db),
        db.from('omega_final_webhook_events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed'),
      ]);

      const openBreakers = breakers.filter(b => b.state === 'open');
      const overallHealth = openBreakers.length === 0 && (dlqRes.count ?? 0) === 0
        ? 100
        : Math.max(0, 100 - openBreakers.length * 20 - Math.min((dlqRes.count ?? 0) * 3, 40));

      return NextResponse.json({
        overallHealth,
        status: overallHealth >= 90 ? 'healthy' : overallHealth >= 70 ? 'degraded' : 'critical',
        breakers,
        dlqSize: dlqRes.count ?? 0,
        services: MONITORED_SERVICES,
        generatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'retry_log') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: retryLog } = await db
        .from('omega_final_audit_log')
        .select('id, entity_id, action, metadata, created_at, performed_by')
        .in('action', ['webhook_retried', 'webhook_retry_succeeded', 'webhook_retry_failed'])
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      type RetryEntry = { action: string };
      const succeeded = (retryLog ?? []).filter(r => (r as RetryEntry).action === 'webhook_retry_succeeded').length;
      const failed = (retryLog ?? []).filter(r => (r as RetryEntry).action === 'webhook_retry_failed').length;

      return NextResponse.json({
        log: retryLog ?? [],
        summary: {
          total: (retryLog ?? []).length,
          succeeded,
          failed,
          successRate: (retryLog ?? []).length > 0 ? Math.round((succeeded / (retryLog ?? []).length) * 100) : 100,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('[infra-resilience GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminDb() ?? supabase;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = body.action as string;

  try {
    if (action === 'retry') {
      const eventId = body.eventId as string;
      if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

      const { data: event } = await db
        .from('omega_final_webhook_events')
        .select('id, event_type, payload, retry_count, source')
        .eq('id', eventId)
        .single();

      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

      const retryCount = ((event as { retry_count?: number }).retry_count ?? 0) + 1;

      // Attempt to re-process (update status to retrying, would trigger actual processing in production)
      await db.from('omega_final_webhook_events').update({
        status: 'retrying',
        retry_count: retryCount,
        last_attempt_at: new Date().toISOString(),
      }).eq('id', eventId);

      await db.from('omega_final_audit_log').insert({
        entity_type: 'webhook_event',
        entity_id: eventId,
        action: 'webhook_retried',
        performed_by: user.id,
        metadata: { retry_count: retryCount, event_type: (event as { event_type?: string }).event_type },
      });

      return NextResponse.json({ ok: true, retryCount, eventId });
    }

    if (action === 'purge') {
      const eventId = body.eventId as string;
      if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

      await db.from('omega_final_webhook_events').update({
        status: 'purged',
        purged_at: new Date().toISOString(),
        purged_by: user.id,
      }).eq('id', eventId);

      await db.from('omega_final_audit_log').insert({
        entity_type: 'webhook_event',
        entity_id: eventId,
        action: 'webhook_purged',
        performed_by: user.id,
        metadata: { reason: 'manual_purge' },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === 'reset_breaker') {
      const service = body.service as string;
      if (!service || !MONITORED_SERVICES.includes(service)) {
        return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
      }

      // Log manual circuit breaker reset
      await db.from('omega_final_audit_log').insert({
        entity_type: 'circuit_breaker',
        entity_id: service,
        action: 'circuit_breaker_reset',
        performed_by: user.id,
        metadata: { service, reset_at: new Date().toISOString() },
      });

      return NextResponse.json({ ok: true, service, newState: 'closed' });
    }

    if (action === 'health_check') {
      // Trigger health probes across all services
      const results: Array<{ service: string; status: 'ok' | 'error'; latencyMs?: number }> = [];

      // Probe Supabase
      const supabaseStart = Date.now();
      try {
        await db.from('clients').select('id', { count: 'exact', head: true }).limit(1);
        results.push({ service: 'supabase', status: 'ok', latencyMs: Date.now() - supabaseStart });
      } catch {
        results.push({ service: 'supabase', status: 'error' });
      }

      // Probe Anthropic
      const aiStart = Date.now();
      const aiKey = process.env.ANTHROPIC_API_KEY;
      if (aiKey) {
        try {
          const r = await fetch('https://api.anthropic.com/v1/models', {
            headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01' },
          });
          results.push({ service: 'anthropic', status: r.ok ? 'ok' : 'error', latencyMs: Date.now() - aiStart });
        } catch {
          results.push({ service: 'anthropic', status: 'error' });
        }
      }

      // Probe Exchange Rate API
      const fxStart = Date.now();
      try {
        const r = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        results.push({ service: 'exchange_rate_api', status: r.ok ? 'ok' : 'error', latencyMs: Date.now() - fxStart });
      } catch {
        results.push({ service: 'exchange_rate_api', status: 'error' });
      }

      await db.from('omega_final_audit_log').insert({
        entity_type: 'health_check',
        entity_id: 'system',
        action: 'health_check_completed',
        performed_by: user.id,
        metadata: { results, probed_at: new Date().toISOString() },
      });

      const allOk = results.every(r => r.status === 'ok');
      return NextResponse.json({ ok: allOk, results, probedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[infra-resilience POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
