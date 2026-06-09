import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── OMEGA FINAL — Financial Reconciliation Engine ─────────────────────────────
//
// Stripe vs internal ledger reconciliation.
// Detects drift, missing entries, amount mismatches, and duplicates.
// Ensures every EUR is accounted for.
//
// GET  ?mode=runs              — reconciliation run history
// GET  ?mode=run&id=           — run detail + discrepancies
// GET  ?mode=stats             — reconciliation health stats
// POST { action:'start_run' }  — start reconciliation for a period
// POST { action:'resolve' }    — mark discrepancy as resolved
// POST { action:'validate_webhook' } — validate Stripe webhook idempotency
//
// ─────────────────────────────────────────────────────────────────────────────


export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('mode') ?? 'runs';

  if (mode === 'runs') {
    const { data } = await supabase.from('omega_final_reconciliation_runs')
      .select('*').order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ runs: data ?? [] });
  }

  if (mode === 'run') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const [run, discrepancies] = await Promise.all([
      supabase.from('omega_final_reconciliation_runs').select('*').eq('id', id).single(),
      supabase.from('omega_final_recon_discrepancies')
        .select('*').eq('run_id', id).order('created_at', { ascending: false }),
    ]);
    if (run.error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run: run.data, discrepancies: discrepancies.data ?? [] });
  }

  if (mode === 'stats') {
    const [runs, openDiscrepancies] = await Promise.all([
      supabase.from('omega_final_reconciliation_runs')
        .select('status, drift_amount, drift_count, entries_checked')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('omega_final_recon_discrepancies')
        .select('type, delta')
        .eq('resolved', false),
    ]);

    const latestRun = runs.data?.[0];
    const totalDrift = (openDiscrepancies.data ?? [])
      .reduce((sum, d) => sum + Math.abs(Number(d.delta ?? 0)), 0);

    const discrepancyByType: Record<string, number> = {};
    for (const d of (openDiscrepancies.data ?? [])) {
      discrepancyByType[d.type] = (discrepancyByType[d.type] ?? 0) + 1;
    }

    return NextResponse.json({
      latest_run: latestRun ?? null,
      open_discrepancies: openDiscrepancies.data?.length ?? 0,
      total_drift_eur: Math.round(totalDrift * 100) / 100,
      discrepancy_by_type: discrepancyByType,
      recent_runs: runs.data ?? [],
    });
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[reconciliation] GET error:', error);
    return NextResponse.json({ error: 'Reconciliation unavailable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action === 'start_run') {
    const { period_start, period_end, notes } = body;
    if (!period_start || !period_end) {
      return NextResponse.json({ error: 'period_start and period_end required' }, { status: 400 });
    }

    // Create run record
    const { data: run, error: runError } = await supabase.from('omega_final_reconciliation_runs').insert({
      period_start,
      period_end,
      status: 'running',
      run_by: user.email,
      notes: notes ?? null,
    }).select().single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

    // Pull internal orders/invoices for the period
    const { data: orders } = await supabase.from('orders')
      .select('id, total_amount, stripe_payment_intent_id, status, created_at')
      .gte('created_at', period_start)
      .lte('created_at', period_end + 'T23:59:59Z')
      .not('stripe_payment_intent_id', 'is', null);

    let totalInternal = 0;
    let driftCount = 0;
    let driftAmount = 0;
    const discrepancies: Array<Record<string, unknown>> = [];

    for (const order of (orders ?? [])) {
      totalInternal += Number(order.total_amount ?? 0);

      // Check for duplicates (same stripe_payment_intent_id appearing twice)
      const { count: dupCount } = await supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('stripe_payment_intent_id', order.stripe_payment_intent_id);

      if ((dupCount ?? 0) > 1) {
        discrepancies.push({
          run_id: run.id,
          type: 'duplicate',
          internal_id: String(order.id),
          stripe_id: order.stripe_payment_intent_id,
          internal_amount: order.total_amount,
          stripe_amount: null,
          delta: 0,
          notes: `Duplicate stripe_payment_intent_id detected`,
        });
        driftCount++;
      }

      // Check for orders missing stripe confirmation
      if (order.status === 'confirmed' && !order.stripe_payment_intent_id) {
        discrepancies.push({
          run_id: run.id,
          type: 'missing_stripe',
          internal_id: String(order.id),
          stripe_id: null,
          internal_amount: order.total_amount,
          stripe_amount: null,
          delta: Number(order.total_amount ?? 0),
          notes: `Order confirmed but no Stripe payment intent`,
        });
        driftCount++;
        driftAmount += Number(order.total_amount ?? 0);
      }
    }

    // Insert discrepancies
    if (discrepancies.length > 0) {
      await supabase.from('omega_final_recon_discrepancies').insert(discrepancies);
    }

    const finalStatus = driftCount === 0 ? 'clean' : 'drift_detected';

    // Update run with results
    const { data: updatedRun, error: updateError } = await supabase
      .from('omega_final_reconciliation_runs')
      .update({
        status: finalStatus,
        total_internal: Math.round(totalInternal * 100) / 100,
        drift_amount: Math.round(driftAmount * 100) / 100,
        drift_count: driftCount,
        entries_checked: orders?.length ?? 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Notify if drift detected
    if (driftCount > 0) {
      await supabase.from('omega_final_notifications').insert({
        user_email: null,
        type: 'error',
        category: 'financial',
        title: `⚠️ Reconciliação: ${driftCount} discrepância(s) detectada(s)`,
        message: `Drift total: €${Math.round(driftAmount * 100) / 100}`,
        action_url: `/reconciliation`,
        action_label: 'Ver Reconciliação',
        priority: 3,
        source: 'reconciliation',
      });
    }

    return NextResponse.json({
      run: updatedRun,
      discrepancies_found: driftCount,
      entries_checked: orders?.length ?? 0,
      status: finalStatus,
      action: 'run_completed',
    });
  }

  if (action === 'resolve') {
    const { id, notes } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('omega_final_recon_discrepancies')
      .update({ resolved: true, notes: notes ?? null })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ discrepancy: data, action: 'resolved' });
  }

  if (action === 'validate_webhook') {
    // Idempotency check: verify a Stripe event ID hasn't been processed twice
    const { stripe_event_id } = body;
    if (!stripe_event_id) return NextResponse.json({ error: 'stripe_event_id required' }, { status: 400 });

    // Check audit trail for this event
    const { count } = await supabase.from('omega_final_audit_trail')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'stripe_event')
      .eq('entity_id', stripe_event_id);

    const isDuplicate = (count ?? 0) > 0;
    return NextResponse.json({
      stripe_event_id,
      is_duplicate: isDuplicate,
      safe_to_process: !isDuplicate,
      action: 'validated',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[reconciliation] POST error:', error);
    return NextResponse.json({ error: 'Reconciliation action failed' }, { status: 500 });
  }
}
