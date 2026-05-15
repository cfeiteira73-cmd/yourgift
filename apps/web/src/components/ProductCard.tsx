import Link from 'next/link';
import { formatPrice } from '@yourgift/shared';

interface Props {
  product: {
    id: string;
    title: string;
    category: string;
    supplier: string;
    basePrice: number;
    images: string[];
    variants?: Array<{ price: number }>;
  };
}

export function ProductCard({ product }: Props) {
  const minPrice = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.basePrice;

  return (
    <Link
      href={`/products/${product.id}`}
      className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-5xl text-gray-300">🎁</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-brand-600 font-medium uppercase tracking-wider mb-1">
          {product.category}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2 line-clamp-2">
          {product.title}
        </h3>
        <p className="text-brand-700 font-bold">
          A partir de {formatPrice(minPrice)}
        </p>
      </div>
    </Link>
  );
}
