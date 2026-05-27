import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { CommandCenter } from '@/components/portal/dashboard/CommandCenter';
import { RealtimeWatcher } from '@/components/portal/RealtimeWatcher';

export const metadata = { title: 'Dashboard — YourGift OS' };

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  // ── Client profile ──────────────────────────────────────────────────────
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, tier, budget_limit')
    .eq('auth_user_id', user.id)
    .single();

  // ── All queries in parallel for speed ────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const clientId = client?.id ?? '';

  const [
    { data: orders },
    { count: pendingQuotes },
    { data: monthOrders },
    { data: allOrders },
    { data: weekOrders },
    { data: inventoryAlerts },
    { data: supplierScores },
    { data: slaDefinitions },
    { data: allClients },
    { data: allQuotes },
  ] = await Promise.all([
    // Recent orders with items
    supabase
      .from('orders')
      .select(`id, ref, status, total_amount, created_at,
               order_items ( id, quantity, unit_price, products ( title, images ) )`)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Pending quotes count
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['submitted', 'pricing']),

    // Month orders for revenue
    supabase
      .from('orders')
      .select('total_amount, status')
      .eq('client_id', clientId)
      .gte('created_at', monthStart),

    // All orders for pipeline
    supabase
      .from('orders')
      .select('status')
      .eq('client_id', clientId),

    // Week orders for sparkline
    supabase
      .from('orders')
      .select('total_amount, created_at')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo)
      .not('status', 'eq', 'cancelled'),

    // Inventory alerts (admin operational data) — top critical
    supabase
      .from('inventory_alerts')
      .select('id, alert_type, current_stock, threshold, resolved')
      .eq('resolved', false)
      .order('current_stock')
      .limit(20),

    // Supplier global scores
    supabase
      .from('supplier_global_scores')
      .select('*')
      .order('overall_score', { ascending: false })
      .limit(6),

    // SLA definitions (production stages)
    supabase
      .from('sla_definitions')
      .select('stage, expected_hours, warning_hours, critical_hours, display_name, color')
      .eq('is_active', true)
      .order('sort_order'),

    // All clients count (admin overview)
    supabase
      .from('clients')
      .select('id, tier, created_at'),

    // All recent quotes across all clients (admin)
    supabase
      .from('quotes')
      .select('id, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalThisMonth = (monthOrders ?? []).reduce(
    (s, o) => s + ((o as { total_amount: number | null }).total_amount ?? 0), 0
  );

  const activeOrders = (allOrders ?? []).filter(
    (o) => !['delivered', 'cancelled', 'draft'].includes((o as { status: string }).status)
  ).length;

  const pipeline: Record<string, number> = {};
  for (const o of allOrders ?? []) {
    const s = (o as { status: string }).status;
    pipeline[s] = (pipeline[s] ?? 0) + 1;
  }

  const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const day = d.toISOString().slice(0, 10);
    return (weekOrders ?? [])
      .filter((o) => (o as { created_at: string }).created_at.startsWith(day))
      .reduce((s, o) => s + ((o as { total_amount: number | null }).total_amount ?? 0), 0);
  });

  // ── Budget display ────────────────────────────────────────────────────────
  const budgetLimit = (client as { budget_limit?: number | null } | null)?.budget_limit;
  const budgetDisplay = budgetLimit != null
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(budgetLimit)
    : 'Ilimitado';

  // ── Operational intelligence ──────────────────────────────────────────────
  const criticalAlerts = (inventoryAlerts ?? []).filter(
    (a) => (a as { alert_type: string }).alert_type === 'out_of_stock'
  ).length;
  const lowStockAlerts = (inventoryAlerts ?? []).filter(
    (a) => (a as { alert_type: string }).alert_type === 'low_stock'
  ).length;

  const totalClients = (allClients ?? []).length;
  const premiumClients = (allClients ?? []).filter(
    (c) => ['premium', 'enterprise'].includes((c as { tier: string }).tier)
  ).length;

  // All-time revenue across all clients (admin view)
  const allTimeRevenue = (allQuotes ?? [])
    .filter((q) => (q as { status: string }).status !== 'rejected')
    .reduce((s, q) => s + ((q as { total_amount: number | null }).total_amount ?? 0), 0);

  return (
    <PortalLayout
      userName={(client as { name?: string } | null)?.name ?? undefined}
      userEmail={user.email ?? undefined}
      companyName={(client as { company?: string } | null)?.company ?? undefined}
      tier={(client as { tier?: string } | null)?.tier ?? undefined}
    >
      {/* Live updates: refreshes server data when orders/quotes change */}
      <RealtimeWatcher clientId={clientId} />
      <CommandCenter
        userName={(client as { name?: string } | null)?.name ?? undefined}
        companyName={(client as { company?: string } | null)?.company ?? undefined}
        tier={(client as { tier?: string } | null)?.tier ?? undefined}
        totalThisMonth={totalThisMonth}
        activeOrders={activeOrders}
        pendingQuotes={pendingQuotes ?? 0}
        budgetDisplay={budgetDisplay}
        orders={(orders ?? []) as unknown as Parameters<typeof CommandCenter>[0]['orders']}
        pipeline={pipeline}
        dailyRevenue={dailyRevenue}
        // Operational intelligence — REAL DATA
        inventoryAlerts={{ critical: criticalAlerts, lowStock: lowStockAlerts, total: (inventoryAlerts ?? []).length }}
        supplierScores={(supplierScores ?? []) as Parameters<typeof CommandCenter>[0]['supplierScores']}
        slaDefinitions={(slaDefinitions ?? []) as Parameters<typeof CommandCenter>[0]['slaDefinitions']}
        totalClients={totalClients}
        premiumClients={premiumClients}
        allTimeRevenue={allTimeRevenue}
      />
    </PortalLayout>
  );
}
