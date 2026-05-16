import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/server';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:       { label: 'Pendente',     className: 'bg-gray-100 text-gray-600' },
  confirmed:     { label: 'Confirmado',   className: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'Em produção',  className: 'bg-yellow-100 text-yellow-700' },
  shipped:       { label: 'Enviado',      className: 'bg-purple-100 text-purple-700' },
  delivered:     { label: 'Entregue',     className: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Cancelado',    className: 'bg-red-100 text-red-700' },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company, tier')
    .eq('auth_user_id', user.id)
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, ref, status, total_amount, created_at, tracking_number,
      order_items (
        id, quantity, unit_price,
        products (title, images)
      )
    `)
    .eq('client_id', client?.id ?? '')
    .order('created_at', { ascending: false });

  const totalSpent = (orders as Array<{ total_amount: number | null }> | null)
    ?.reduce((s: number, o) => s + (o.total_amount ?? 0), 0) ?? 0;
  const activeOrders = (orders as Array<{ status: string }> | null)
    ?.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900">
            your<span className="text-brand-600">gift</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {client?.name ?? user.email}
              {client?.tier === 'premium' && (
                <span className="ml-2 bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5 rounded-full">Premium</span>
              )}
            </span>
            <form action="/auth/logout" method="POST">
              <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Sair
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total gasto</p>
            <p className="text-3xl font-black text-gray-900">{totalSpent > 0 ? formatPrice(totalSpent) : '—'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Encomendas ativas</p>
            <p className="text-3xl font-black text-gray-900">{activeOrders}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total encomendas</p>
            <p className="text-3xl font-black text-gray-900">{orders?.length ?? 0}</p>
          </div>
        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">As minhas encomendas</h1>
          <Link
            href="/products"
            className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            + Nova Encomenda
          </Link>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <p className="text-4xl mb-4">📦</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">Ainda não tens encomendas</p>
            <p className="text-sm text-gray-400 mb-6">Explora o catálogo e faz a primeira encomenda.</p>
            <Link href="/products" className="inline-block bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors">
              Ver catálogo →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;
              const firstProduct = (order.order_items?.[0]?.products as unknown) as { title: string; images: string[] } | null;
              const thumb = firstProduct?.images?.[0];
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-5">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                    {thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumb} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 font-mono text-sm">{order.ref}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {order.order_items?.length > 0 && ` · ${order.order_items.length} artigo${order.order_items.length !== 1 ? 's' : ''}`}
                    </p>
                    {order.tracking_number && (
                      <p className="text-xs text-brand-600 mt-0.5">Rastreio: {order.tracking_number}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-brand-700 text-lg">
                      {order.total_amount ? formatPrice(order.total_amount) : 'Sob consulta'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
