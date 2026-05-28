import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── OMEGA PROTOCOL — S5: Manufacturing OS ────────────────────────────────────
//
// Intelligent routing · ETA prediction · Load balancing · Bottleneck detection
// Supplier failover · Capacity utilisation
//
// GET /api/manufacturing?mode=routing|capacity|bottlenecks|eta&orderId=...
//
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['geral@yourgift.pt', 'geral@agencygroup.pt'];

// Simulated capacity limits per production stage (units/week)
const STAGE_CAPACITY: Record<string, number> = {
  confirmed:  150,
  producing:  80,
  shipped:    200,
};

// Expected hours per stage (from SLA definitions)
const DEFAULT_STAGE_HOURS: Record<string, number> = {
  pending:    4,
  confirmed:  8,
  producing:  72,
  shipped:    48,
  delivered:  0,
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const params = request.nextUrl.searchParams;
    const mode = params.get('mode') ?? 'routing';
    const orderId = params.get('orderId');

    // ── Fetch active orders ──────────────────────────────────────────────────
    let ordersQuery = supabase
      .from('orders')
      .select('id, ref, status, total_amount, created_at, updated_at, client_id, clients(name)')
      .not('status', 'in', '("delivered","cancelled","draft")')
      .order('created_at', { ascending: true })
      .limit(300);

    if (!isAdmin) {
      const { data: c } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).single();
      if (c?.id) ordersQuery = ordersQuery.eq('client_id', c.id);
    }

    // Fetch SLA definitions
    const [ordersRes, slaRes, suppliersRes] = await Promise.all([
      ordersQuery,
      supabase.from('sla_definitions').select('stage, expected_hours, warning_hours, critical_hours').eq('is_active', true),
      supabase.from('supplier_global_scores').select('id, name, overall_score, delivery_score, quality_score').order('overall_score', { ascending: false }).limit(20),
    ]);

    type OrderRow = { id: string; ref: string; status: string; total_amount: number | null; created_at: string; updated_at: string; client_id: string | null; clients?: { name: string | null } | null };
    type SlaRow   = { stage: string; expected_hours: number; warning_hours: number; critical_hours: number };
    type SupRow   = { id: string; name: string; overall_score: number; delivery_score: number; quality_score: number };

    const orders    = (ordersRes.data ?? []) as unknown as OrderRow[];
    const slaMap    = Object.fromEntries(((slaRes.data ?? []) as SlaRow[]).map(s => [s.stage, s]));
    const suppliers = (suppliersRes.data ?? []) as SupRow[];

    // ── Bottleneck detection ──────────────────────────────────────────────────
    if (mode === 'bottlenecks') {
      const stageCount: Record<string, number> = {};
      const stageValue: Record<string, number> = {};
      const stageOldest: Record<string, number> = {};

      for (const order of orders) {
        stageCount[order.status] = (stageCount[order.status] ?? 0) + 1;
        stageValue[order.status] = (stageValue[order.status] ?? 0) + (order.total_amount ?? 0);
        const hoursElapsed = (Date.now() - new Date(order.updated_at ?? order.created_at).getTime()) / 3600000;
        stageOldest[order.status] = Math.max(stageOldest[order.status] ?? 0, hoursElapsed);
      }

      const bottlenecks = Object.entries(stageCount).map(([stage, count]) => {
        const capacity = STAGE_CAPACITY[stage] ?? 100;
        const utilisation = Math.min(Math.round((count / capacity) * 100), 100);
        const sla = slaMap[stage];
        const maxWaitHours = stageOldest[stage] ?? 0;
        const breached = sla && maxWaitHours >= sla.critical_hours;
        const atRisk   = sla && maxWaitHours >= sla.warning_hours;

        return {
          stage,
          count,
          value: Math.round(stageValue[stage] ?? 0),
          utilisation,
          maxWaitHours: Math.round(maxWaitHours),
          status: breached ? 'critical' : atRisk ? 'at_risk' : utilisation > 80 ? 'high_load' : 'ok',
          capacityLimit: capacity,
        };
      }).sort((a, b) => b.utilisation - a.utilisation);

      return NextResponse.json({ bottlenecks, generatedAt: new Date().toISOString() });
    }

    // ── ETA prediction ────────────────────────────────────────────────────────
    if (mode === 'eta') {
      if (!orderId) return NextResponse.json({ error: 'orderId required for ETA mode' }, { status: 400 });

      const order = orders.find(o => o.id === orderId);
      if (!order) return NextResponse.json({ error: 'Order not found or not active' }, { status: 404 });

      const stages = ['pending', 'confirmed', 'producing', 'shipped', 'delivered'];
      const currentIdx = stages.indexOf(order.status);
      const remainingStages = stages.slice(currentIdx + 1);

      let totalHoursRemaining = 0;
      const stageEtas = remainingStages.map(stage => {
        const hours = slaMap[stage]?.expected_hours ?? DEFAULT_STAGE_HOURS[stage] ?? 24;
        totalHoursRemaining += hours;
        return { stage, estimatedHours: hours };
      });

      const etaDate = new Date(Date.now() + totalHoursRemaining * 3600000);
      const hoursElapsed = (Date.now() - new Date(order.created_at).getTime()) / 3600000;
      const currentSla = slaMap[order.status];
      const slaStatus = currentSla
        ? hoursElapsed >= currentSla.critical_hours ? 'critical'
        : hoursElapsed >= currentSla.warning_hours ? 'at_risk' : 'on_time'
        : 'unknown';

      return NextResponse.json({
        order: { id: order.id, ref: order.ref, status: order.status },
        currentStageHoursElapsed: Math.round(hoursElapsed),
        slaStatus,
        remainingStages: stageEtas,
        totalHoursRemaining,
        estimatedDelivery: etaDate.toISOString(),
        estimatedDeliveryFormatted: etaDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }),
        confidence: slaStatus === 'on_time' ? 85 : slaStatus === 'at_risk' ? 65 : 40,
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Capacity utilisation ──────────────────────────────────────────────────
    if (mode === 'capacity') {
      const byStage = Object.entries(STAGE_CAPACITY).map(([stage, cap]) => {
        const count = orders.filter(o => o.status === stage).length;
        return {
          stage,
          active: count,
          capacity: cap,
          utilisation: Math.min(Math.round((count / cap) * 100), 100),
          available: Math.max(0, cap - count),
        };
      });

      const topSupplier = suppliers[0] ?? null;
      const failoverSupplier = suppliers[1] ?? null;

      return NextResponse.json({
        byStage,
        totalActive: orders.length,
        primarySupplier: topSupplier,
        failoverSupplier,
        recommendations: buildCapacityRecommendations(byStage),
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Default: routing recommendations ─────────────────────────────────────
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const routingRecommendations = pendingOrders.slice(0, 10).map(order => {
      // Score suppliers for this order
      const best = suppliers.slice(0, 3).map(s => ({
        supplierId: s.id,
        supplierName: s.name,
        score: Math.round(s.overall_score),
        deliveryScore: Math.round(s.delivery_score),
        qualityScore: Math.round(s.quality_score),
        estimatedLeadDays: Math.round(14 + (100 - s.delivery_score) / 10),
        recommended: s === suppliers[0],
      }));

      return {
        orderId: order.id,
        orderRef: order.ref,
        value: order.total_amount ?? 0,
        suppliers: best,
      };
    });

    return NextResponse.json({
      pendingCount: pendingOrders.length,
      routingRecommendations,
      activeOrders: orders.length,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[manufacturing] error:', error);
    return NextResponse.json({ error: 'Manufacturing OS unavailable' }, { status: 500 });
  }
}

function buildCapacityRecommendations(stages: Array<{ stage: string; utilisation: number; available: number }>) {
  const recs: string[] = [];
  for (const s of stages) {
    if (s.utilisation >= 90) recs.push(`Fase "${s.stage}" em sobrecarga (${s.utilisation}%) — considerar redistribuição.`);
    else if (s.utilisation <= 20) recs.push(`Fase "${s.stage}" subutilizada (${s.utilisation}%) — capacidade disponível: ${s.available} unidades.`);
  }
  if (recs.length === 0) recs.push('Capacidade de produção equilibrada em todas as fases.');
  return recs;
}
