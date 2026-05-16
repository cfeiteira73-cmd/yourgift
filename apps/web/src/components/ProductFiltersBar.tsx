'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';

interface CategoryGroup {
  id: string;
  label: string;
  count: number;
}

interface Props {
  categories: CategoryGroup[];
  searchParams: Record<string, string>;
}

export function ProductFiltersBar({ categories, searchParams }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      startTransition(() => router.push(`/products?${params.toString()}`));
    },
    [router, searchParams],
  );

  const hasFilters = Object.keys(searchParams).some((k) => k !== 'page');

  return (
    <div className={`flex flex-wrap gap-3 mb-8 transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <input
        type="text"
        placeholder="Pesquisar ref., nome..."
        defaultValue={searchParams.search ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v.length === 0 || v.length >= 3) update('search', v);
        }}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-56 bg-white"
      />

      <select
        value={searchParams.categoryGroup ?? ''}
        onChange={(e) => update('categoryGroup', e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
      >
        <option value="">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.label} ({c.count})</option>
        ))}
      </select>

      <select
        value={searchParams.sort ?? ''}
        onChange={(e) => update('sort', e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
      >
        <option value="">Ordenar por</option>
        <option value="newest">Mais recentes</option>
        <option value="price_asc">Preço ↑</option>
        <option value="price_desc">Preço ↓</option>
        <option value="name_asc">Nome A–Z</option>
      </select>

      <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-green-50 hover:border-green-300 bg-white select-none transition-colors">
        <input
          type="checkbox"
          checked={searchParams.eco === 'true'}
          onChange={(e) => update('eco', e.target.checked ? 'true' : '')}
          className="accent-green-600"
        />
        <span className="text-green-700">🌱 Eco</span>
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push('/products')}
          className="text-sm text-gray-400 hover:text-gray-700 px-3 py-2 transition-colors"
        >
          × Limpar
        </button>
      )}

      {isPending && (
        <div className="flex items-center gap-1.5 text-xs text-brand-600">
          <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          A filtrar...
        </div>
      )}
    </div>
  );
}
