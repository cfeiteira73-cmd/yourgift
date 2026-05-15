import { ProductCard } from '@/components/ProductCard';

async function getProducts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Catalogo de Produtos</h1>
        {products.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-lg">Nenhum produto disponivel de momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
