import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';
import { createClient } from '@/lib/supabase/server';

const STATUS_STEPS = [
  { key: 'pending',       label: 'Pendente' },
  { key: 'confirmed',     label: 'Confirmado' },
  { key: 'in_production', label: 'Em produção' },
  { key: 'shipped',       label: 'Enviado' },
  { key: 'delivered',     label: 'Entregue' },
];

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, ref, status, total_amount, created_at, tracking_number, shipping_address, supplier_order_id,
      order_items (
        id, quantity, unit_price,
        products (id, title, images, supplier_ref),
        product_variants (sku, color)
      )
    `)
    .eq('id', params.id)
    .eq('client_id', client?.id ?? '')
    .single();

  if (!order) notFound();

  const currentStep = STATUS_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900">your<span className="text-brand-600">gift</span></Link>
          <Link href="/dashboard" className="text-sm text-brand-600 hover:text-brand-700 font-medium">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Encomenda</h1>
          <code className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-mono">{order.ref}</code>
        </div>

        {/* STATUS TRACKER */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-100">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {STATUS_STEPS.map((s, i) => (
              <div key={s.key} className="relative flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all ${
                  i < currentStep ? 'bg-brand-500 text-white' :
                  i === currentStep ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                  'bg-white border-2 border-gray-200 text-gray-300'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden md:block ${i === currentStep ? 'text-brand-700' : i < currentStep ? 'text-gray-500' : 'text-gray-300'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-6 md:hidden">
            Estado atual: <strong className="text-gray-700">{STATUS_STEPS[currentStep]?.label}</strong>
          </p>
          {order.tracking_number && (
            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 mb-1">Número de rastreio</p>
              <code className="text-brand-700 font-mono font-semibold text-sm bg-brand-50 px-3 py-1.5 rounded-lg">
                {order.tracking_number}
              </code>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ORDER ITEMS */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Artigos</h2>
            {(order.order_items as any[])?.map((item) => {
              const prod = item.products as { id: string; title: string; images: string[]; supplier_ref: string } | null;
              const v = item.product_variants as { sku: string; color: string | null } | null;
              const thumb = prod?.images?.[0];
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                    {thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumb} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${prod?.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors text-sm">
                      {prod?.title}
                    </Link>
                    {v?.color && <p className="text-xs text-gray-400">{v.color} · {v.sku}</p>}
                    <p className="text-xs text-gray-400">{item.quantity} un.</p>
                  </div>
                  <p className="font-bold text-gray-900 flex-shrink-0">
                    {item.unit_price > 0 ? formatPrice(item.unit_price * item.quantity) : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Resumo</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Data</span>
                  <span>{new Date(order.created_at).toLocaleDateString('pt-PT')}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Referência</span>
                  <span className="font-mono text-xs">{order.ref}</span>
                </div>
                {order.supplier_order_id && (
                  <div className="flex justify-between text-gray-500">
                    <span>Ref. Midocean</span>
                    <span className="font-mono text-xs">{order.supplier_order_id}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                  <span>Total</span>
                  <span className="text-brand-700">{order.total_amount ? formatPrice(order.total_amount) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Entrega</h2>
              {order.shipping_address ? (
                <address className="text-sm text-gray-700 not-italic space-y-0.5">
                  <p className="font-medium">{(order.shipping_address as any).name}</p>
                  <p>{(order.shipping_address as any).street}</p>
                  <p>{(order.shipping_address as any).city} {(order.shipping_address as any).postalCode}</p>
                  <p>{(order.shipping_address as any).country}</p>
                </address>
              ) : <p className="text-sm text-gray-400">—</p>}
            </div>

            <Link href="/products" className="block text-center bg-brand-50 text-brand-700 py-3 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors">
              + Nova encomenda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
