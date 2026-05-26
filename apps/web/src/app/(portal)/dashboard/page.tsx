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

  // ── Recent orders (last 10 for activity feed) ───────────────────────────
  const { data: orders } = await supabase
    .from('orders')
    .select(`id, ref, status, total_amount, created_at,
             order_items ( id, quantity, unit_price, products ( title, images ) )`)
    .eq('client_id', client?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Pending quotes count ─────────────────────────────────────────────────
  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client?.id ?? '')
    .in('status', ['submitted', 'pricing']);

  // ── Spend this month ─────────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('client_id', client?.id ?? '')
    .gte('created_at', monthStart)
    .not('status', 'eq', 'cancelled');

  const totalThisMonth = (monthOrders ?? []).reduce(
    (s, o) => s + ((o as { total_amount: number | null }).total_amount ?? 0), 0
  );

  // ── Active orders ────────────────────────────────────────────────────────
  const { data: allOrders } = await supabase
    .from('orders')
    .select('status')
    .eq('client_id', client?.id ?? '');

  const activeOrders = (allOrders ?? []).filter(
    (o) => !['delivered', 'cancelled', 'draft'].includes((o as { status: string }).status)
  ).length;

  // ── Pipeline counts by status ─────────────────────────────────────────────
  const pipeline: Record<string, number> = {};
  for (const o of allOrders ?? []) {
    const s = (o as { status: string }).status;
    pipeline[s] = (pipeline[s] ?? 0) + 1;
  }

  // ── Daily revenue last 7 days (sparkline data) ────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weekOrders } = await supabase
    .from('orders')
    .select('total_amount, created_at')
    .eq('client_id', client?.id ?? '')
    .gte('created_at', sevenDaysAgo)
    .not('status', 'eq', 'cancelled');

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

  return (
    <PortalLayout
      userName={(client as { name?: string } | null)?.name ?? undefined}
      userEmail={user.email ?? undefined}
      companyName={(client as { company?: string } | null)?.company ?? undefined}
      tier={(client as { tier?: string } | null)?.tier ?? undefined}
    >
      {/* Live updates: refreshes server data when orders/quotes change */}
      <RealtimeWatcher clientId={client?.id ?? ''} />
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
      />
    </PortalLayout>
  );
}
