'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@yourgift/shared';

export default function DashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">As minhas encomendas</h1>
          <a
            href="/products"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Nova Encomenda
          </a>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-400">A carregar...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24 text-gray-400">Ainda nao tens encomendas.</div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-6 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{order.ref}</p>
                  <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('pt-PT')}</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-lg font-bold text-brand-700">
                    {order.totalAmount ? formatPrice(order.totalAmount) : '—'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'in_production' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
