import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@yourgift/shared';

async function getProduct(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) notFound();

  const minPrice = Math.min(...(product.variants?.map((v: any) => v.price) ?? [product.basePrice]));

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <Link href="/products" className="text-brand-600 hover:underline text-sm mb-6 block">
          &larr; Voltar ao Catalogo
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.title} className="w-full h-full object-contain rounded-2xl" />
            ) : (
              <span className="text-gray-400 text-6xl">🎁</span>
            )}
          </div>

          <div>
            <span className="text-xs font-medium text-brand-600 uppercase tracking-widest">
              {product.supplier} &middot; {product.category}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-4">{product.title}</h1>
            <p className="text-gray-600 mb-6">{product.description}</p>
            <p className="text-4xl font-extrabold text-brand-700 mb-8">
              {formatPrice(minPrice)}
            </p>

            <Link
              href={`/orders/new?productId=${product.id}`}
              className="w-full block text-center bg-brand-600 text-white py-4 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
            >
              Encomendar Agora
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
