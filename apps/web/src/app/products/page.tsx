import Link from 'next/link';
import { Suspense } from 'react';
import { formatPrice } from '@yourgift/shared';
import { ProductFiltersBar } from '@/components/ProductFiltersBar';
import { getProducts, getCategories } from '@/lib/catalog';

export default async function ProductsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const [result, categories] = await Promise.all([
    getProducts({
      search: searchParams.search,
      categoryGroup: searchParams.categoryGroup,
      eco: searchParams.eco === 'true',
      minPrice: searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined,
      maxPrice: searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined,
      sort: searchParams.sort,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
      limit: 24,
    }),
    getCategories(),
  ]);

  const { data: products, total, page, totalPages } = result;
  const currentPage = parseInt(searchParams.page ?? '1', 10);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-gray-900">
            your<span className="text-brand-600">gift</span>
          </Link>
          <p className="text-sm font-medium text-gray-500">
            {total > 0 ? <>{total.toLocaleString('pt-PT')} produtos</> : 'Catálogo'}
          </p>
          <Link href="/dashboard" className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Dashboard →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Suspense fallback={null}>
          <ProductFiltersBar categories={categories} searchParams={searchParams} />
        </Suspense>

        {products.length === 0 ? (
          <div className="text-center py-32">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-gray-700 mb-2">Nenhum produto encontrado</p>
            <p className="text-gray-400 mb-6">Tenta ajustar os filtros de pesquisa.</p>
            <Link href="/products" className="text-brand-600 font-medium hover:underline">Limpar filtros</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
              {products.map((product) => {
                const prices = product.variants?.map((v) => v.price).filter((p) => p > 0) ?? [];
                const minPrice = prices.length ? Math.min(...prices) : 0;
                const image = product.images?.[0] ?? product.variants?.[0]?.images?.[0];
                const inStock = product.variants?.some((v) => v.stock > 0) ?? false;
                return (
                  <Link key={product.id} href={`/products/${product.id}`}
                    className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-brand-200 transition-all duration-200">
                    <div className="aspect-square bg-gray-50 overflow-hidden relative">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={product.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-gray-200">🎁</div>
                      )}
                      {!inStock && (
                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-full">Sem stock</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 truncate mb-0.5">{product.supplierRef}</p>
                      <h3 className="text-xs font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{product.title}</h3>
                      <p className="text-brand-700 font-bold text-sm">
                        {minPrice > 0 ? formatPrice(minPrice) : 'Sob consulta'}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pb-8">
                {currentPage > 1 && (
                  <Link href={`/products?${new URLSearchParams({ ...searchParams, page: String(currentPage - 1) })}`}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-brand-300 transition-colors">
                    ← Anterior
                  </Link>
                )}
                <span className="text-sm text-gray-500 px-4">Página {currentPage} de {totalPages}</span>
                {currentPage < totalPages && (
                  <Link href={`/products?${new URLSearchParams({ ...searchParams, page: String(currentPage + 1) })}`}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-brand-300 transition-colors">
                    Seguinte →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
