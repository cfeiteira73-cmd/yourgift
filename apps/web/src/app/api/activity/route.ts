import { isAdminEmail } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── Phase 12: Activity Feed / Audit Trail ─────────────────────────────────────
//
// Returns recent system events across orders, quotes, and clients.
// Admins see all events; clients see only their own.
//
// GET /api/activity?limit=20&since=ISO-datetime
// ─────────────────────────────────────────────────────────────────────────────


interface ActivityEvent {
  id: string;
  type: 'order_created' | 'order_status_change' | 'quote_submitted' | 'quote_status_change' | 'client_joined' | 'delivery';
  entityId: string;
  entityRef?: string;
  description: string;
  amount?: number;
  clientName?: string;
  status?: string;
  timestamp: string;
  isAdmin: boolean;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  producing: 'Em produção',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  draft: 'Rascunho',
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  pricing: 'Em análise',
  proposed: 'Proposto',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido em encomenda',
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = isAdminEmail(user.email);
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20'), 50);
    const since = request.nextUrl.searchParams.get('since') ?? new Date(Date.now() - 30 * 86400000).toISOString();

    // Get client ID for non-admins
    let clientId: string | null = null;
    let clientName: string | null = null;
    if (!isAdmin) {
      const { data: clientData } = await supabase.from('clients').select('id, name').eq('auth_user_id', user.id).single();
      clientId = clientData?.id ?? null;
      clientName = clientData?.name ?? null;
    }

    // ── Fetch recent orders ────────────────────────────────────────────────
    let ordersQuery = supabase
      .from('orders')
      .select('id, ref, status, total_amount, created_at, updated_at, client_id, clients(name)')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (clientId) ordersQuery = ordersQuery.eq('client_id', clientId);

    // ── Fetch recent quotes ────────────────────────────────────────────────
    let quotesQuery = supabase
      .from('quotes')
      .select('id, status, total_amount, created_at, updated_at, client_id, clients(name)')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (clientId) quotesQuery = quotesQuery.eq('client_id', clientId);

    // ── Fetch recent clients (admin only) ─────────────────────────────────
    const clientsQuery = isAdmin
      ? supabase.from('clients').select('id, name, company, tier, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] });

    const [ordersRes, quotesRes, clientsRes] = await Promise.all([ordersQuery, quotesQuery, clientsQuery]);

    const orders = (ordersRes.data ?? []) as unknown as Array<{
      id: string; ref: string; status: string; total_amount: number | null;
      created_at: string; updated_at: string; client_id: string;
      clients?: { name: string | null } | null;
    }>;
    const quotes = (quotesRes.data ?? []) as unknown as Array<{
      id: string; status: string; total_amount: number | null;
      created_at: string; updated_at: string; client_id: string;
      clients?: { name: string | null } | null;
    }>;
    const newClients = (clientsRes.data ?? []) as Array<{
      id: string; name: string | null; company: string | null; tier: string | null; created_at: string;
    }>;

    // ── Build unified event list ────────────────────────────────────────────
    const events: ActivityEvent[] = [];

    for (const order of orders) {
      const cn = isAdmin ? ((order.clients as { name?: string | null } | null)?.name ?? 'Cliente') : (clientName ?? 'Você');
      const isNew = Math.abs(new Date(order.created_at).getTime() - new Date(order.updated_at).getTime()) < 5000;

      if (isNew) {
        events.push({
          id: `order-created-${order.id}`,
          type: 'order_created',
          entityId: order.id,
          entityRef: order.ref,
          description: `Nova encomenda ${order.ref} criada por ${cn}`,
          amount: order.total_amount ?? undefined,
          clientName: cn,
          status: order.status,
          timestamp: order.created_at,
          isAdmin,
        });
      } else if (order.status === 'delivered') {
        events.push({
          id: `order-delivered-${order.id}`,
          type: 'delivery',
          entityId: order.id,
          entityRef: order.ref,
          description: `Encomenda ${order.ref} entregue a ${cn}`,
          amount: order.total_amount ?? undefined,
          clientName: cn,
          status: order.status,
          timestamp: order.updated_at,
          isAdmin,
        });
      } else {
        events.push({
          id: `order-status-${order.id}`,
          type: 'order_status_change',
          entityId: order.id,
          entityRef: order.ref,
          description: `Encomenda ${order.ref} → ${ORDER_STATUS_LABELS[order.status] ?? order.status}`,
          amount: order.total_amount ?? undefined,
          clientName: cn,
          status: order.status,
          timestamp: order.updated_at,
          isAdmin,
        });
      }
    }

    for (const quote of quotes) {
      const cn = isAdmin ? ((quote.clients as { name?: string | null } | null)?.name ?? 'Cliente') : (clientName ?? 'Você');
      const isNew = Math.abs(new Date(quote.created_at).getTime() - new Date(quote.updated_at).getTime()) < 5000;
      events.push({
        id: `quote-${quote.id}`,
        type: isNew ? 'quote_submitted' : 'quote_status_change',
        entityId: quote.id,
        description: isNew
          ? `Novo orçamento submetido por ${cn}`
          : `Orçamento → ${QUOTE_STATUS_LABELS[quote.status] ?? quote.status}`,
        amount: quote.total_amount ?? undefined,
        clientName: cn,
        status: quote.status,
        timestamp: isNew ? quote.created_at : quote.updated_at,
        isAdmin,
      });
    }

    for (const client of newClients) {
      events.push({
        id: `client-${client.id}`,
        type: 'client_joined',
        entityId: client.id,
        description: `Novo cliente: ${client.name ?? 'N/A'}${client.company ? ` (${client.company})` : ''} · tier ${client.tier ?? 'standard'}`,
        clientName: client.name ?? undefined,
        timestamp: client.created_at,
        isAdmin: true,
      });
    }

    // Sort by timestamp descending, limit
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const trimmed = events.slice(0, limit);

    return NextResponse.json({
      events: trimmed,
      total: trimmed.length,
      isAdmin,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({ error: 'Activity feed unavailable' }, { status: 500 });
  }
}
