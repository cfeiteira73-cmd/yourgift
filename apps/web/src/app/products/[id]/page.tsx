import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@yourgift/shared';
import { getProductById } from '@/lib/catalog';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);
  if (!product) notFound();

  const prices = product.variants?.map((v) => v.price).filter((p) => p > 0) ?? [];
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const image = product.images?.[0] ?? product.variants?.[0]?.images?.[0];
  const inStockVariants = product.variants?.filter((v) => v.stock > 0) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <Link href="/products" className="text-brand-600 hover:underline text-sm mb-6 block">
          &larr; Voltar ao Catálogo
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-2xl"
              />
            ) : (
              <span className="text-gray-400 text-6xl">🎁</span>
            )}
          </div>

          <div>
            <span className="text-xs font-medium text-brand-600 uppercase tracking-widest">
              {product.supplier} &middot; {product.supplierRef}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-4">{product.title}</h1>
            <p className="text-gray-600 mb-6">{product.description}</p>

            <p className="text-4xl font-extrabold text-brand-700 mb-2">
              {minPrice > 0 ? formatPrice(minPrice) : 'Sob consulta'}
            </p>
            {inStockVariants.length > 0 && (
              <p className="text-sm text-green-600 mb-8">
                {inStockVariants.length} variante{inStockVariants.length !== 1 ? 's' : ''} em stock
              </p>
            )}

            <Link
              href={`/orders/new?productId=${product.id}`}
              className="w-full block text-center bg-brand-600 text-white py-4 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
            >
              Encomendar Agora
            </Link>

            {product.variants?.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Variantes disponíveis</h2>
                <div className="overflow-auto max-h-60 rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Cor</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">SKU</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {product.variants.slice(0, 50).map((v) => (
                        <tr key={v.id} className={v.stock === 0 ? 'opacity-40' : ''}>
                          <td className="px-3 py-2 text-gray-700">{v.color ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono">{v.sku}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-700">{v.stock.toLocaleString('pt-PT')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
