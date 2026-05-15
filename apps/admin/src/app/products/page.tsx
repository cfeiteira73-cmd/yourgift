'use client';

import { useEffect, useState } from 'react';

export default function AdminProductsPage() {
  const [result, setResult] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products?limit=50`)
      .then((r) => r.json())
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    const token = localStorage.getItem('adminToken') ?? '';
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/suppliers/midocean/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({ error: true });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-sm text-gray-400 mt-1">{result.total} produtos em catálogo</p>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={syncing}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {syncing ? '⟳ A sincronizar Midocean...' : '⟳ Sync Midocean'}
        </button>
      </div>

      {syncResult && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${syncResult.error ? 'bg-red-900/30 text-red-300 border border-red-800' : 'bg-green-900/30 text-green-300 border border-green-800'}`}>
          {syncResult.error
            ? 'Erro durante sincronização.'
            : `✓ ${syncResult.productsUpserted} produtos · ${syncResult.variantsUpserted} variantes · ${syncResult.durationMs}ms`
          }
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-500">A carregar...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {result.data?.map((product: any) => {
            const minPrice = product.variants?.[0]?.price ?? product.basePrice;
            const image = product.images?.[0];
            return (
              <div key={product.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="aspect-square bg-gray-800 overflow-hidden">
                  {image
                    ? <img src={image} alt={product.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-3xl">🎁</div>
                  }
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{product.supplierRef}</p>
                  <p className="text-xs font-semibold text-gray-200 line-clamp-2">{product.title}</p>
                  {minPrice > 0 && <p className="text-xs text-brand-400 font-bold mt-1">€{minPrice.toFixed(2)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
