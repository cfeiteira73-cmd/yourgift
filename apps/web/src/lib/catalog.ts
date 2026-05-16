/**
 * Server-side catalog data fetching via Supabase PostgREST.
 * Used by RSC pages (no client exposure, no NestJS dependency at runtime).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact',
};

/** Maps UI category groups → Midocean category code prefixes */
const CATEGORY_GROUP_PREFIXES: Record<string, string[]> = {
  apparel:    ['MOBTEX'],
  bags:       ['MOBT&B'],
  drinkware:  ['MOBH&L_DRI', 'MOBH&L_CUP', 'MOBH&L_GLA', 'MOBH&L_THE', 'MOBH&L_WIA'],
  home:       ['MOBH&L'],
  office:     ['MOBOFF'],
  tech:       ['MOBS&I', 'MOBT&W', 'MOBOFF_COM'],
  writing:    ['MOBWRI'],
  leisure:    ['MOBL&G'],
  personal:   ['MOBPER'],
  tools:      ['MOBTLL'],
  stationery: ['MOBP&S'],
  kitchen:    ['MOBH&L_KAC', 'MOBK&G'],
  seasonal:   ['MOBXMS'],
};

export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  apparel:    'Vestuário',
  bags:       'Malas & Viagem',
  drinkware:  'Bebidas & Copos',
  home:       'Casa & Living',
  office:     'Escritório',
  tech:       'Tecnologia',
  writing:    'Escrita & Papelaria',
  leisure:    'Lazer & Desporto',
  personal:   'Cuidado Pessoal',
  tools:      'Ferramentas',
  stationery: 'Papelaria',
  kitchen:    'Cozinha & BBQ',
  seasonal:   'Sazonal & Presentes',
};

export interface ProductVariant {
  id: string;
  sku: string;
  color?: string;
  colorGroup?: string;
  price: number;
  stock: number;
  images: string[];
}

export interface Product {
  id: string;
  supplierRef: string;
  title: string;
  description: string;
  category: string;
  supplier: string;
  basePrice: number;
  images: string[];
  variants: ProductVariant[];
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CategoryGroup {
  id: string;
  label: string;
  count: number;
}

export interface ProductFilters {
  search?: string;
  categoryGroup?: string;
  eco?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

const PRODUCT_SELECT = [
  'id', 'supplier_ref', 'title', 'description', 'category',
  'supplier', 'base_price', 'images',
  'product_variants(id,sku,color,color_group,price,stock,images)',
].join(',');

function normalizeProduct(row: Record<string, unknown>): Product {
  const variants = (row.product_variants as Record<string, unknown>[] | null) ?? [];
  return {
    id: row.id as string,
    supplierRef: row.supplier_ref as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string,
    supplier: row.supplier as string,
    basePrice: row.base_price as number,
    images: (row.images as string[]) ?? [],
    variants: variants.map((v) => ({
      id: v.id as string,
      sku: v.sku as string,
      color: v.color as string | undefined,
      colorGroup: v.color_group as string | undefined,
      price: v.price as number,
      stock: v.stock as number,
      images: (v.images as string[]) ?? [],
    })),
  };
}

export async function getProducts(filters: ProductFilters = {}): Promise<PaginatedProducts> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
  const offset = (page - 1) * limit;

  const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
  url.searchParams.set('select', PRODUCT_SELECT);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const sort = filters.sort ?? 'newest';
  if (sort === 'price_asc') url.searchParams.set('order', 'base_price.asc');
  else if (sort === 'price_desc') url.searchParams.set('order', 'base_price.desc');
  else if (sort === 'name_asc') url.searchParams.set('order', 'title.asc');
  else url.searchParams.set('order', 'updated_at.desc');

  if (filters.minPrice !== undefined) url.searchParams.set('base_price', `gte.${filters.minPrice}`);
  if (filters.maxPrice !== undefined) url.searchParams.append('base_price', `lte.${filters.maxPrice}`);

  const andFilters: string[] = [];

  if (filters.categoryGroup && filters.categoryGroup !== 'all') {
    const prefixes = CATEGORY_GROUP_PREFIXES[filters.categoryGroup] ?? [];
    if (prefixes.length > 0) {
      const parts = prefixes.map((p) => `category.ilike.${p.replace(/&/g, '%26')}*`);
      andFilters.push(`(${parts.join(',')})`);
    }
  }

  if (filters.search) {
    const esc = filters.search.replace(/[%_]/g, '\\$&');
    andFilters.push(`(title.ilike.*${esc}*,description.ilike.*${esc}*,supplier_ref.ilike.*${esc}*)`);
  }

  if (filters.eco) {
    andFilters.push('(category.ilike.MOBL%26G*,description.ilike.*recycl*,description.ilike.*bamboo*,description.ilike.*organic*,description.ilike.*sustainab*,description.ilike.*eco*)');
  }

  if (andFilters.length === 1) url.searchParams.set('or', andFilters[0]);
  else if (andFilters.length > 1) url.searchParams.set('and', `(${andFilters.join(',')})`);

  try {
    const res = await fetch(url.toString(), {
      headers: SB_HEADERS,
      next: { revalidate: 60 },
    });

    if (!res.ok) return { data: [], total: 0, page, totalPages: 0 };

    const rows: Record<string, unknown>[] = await res.json();
    const contentRange = res.headers.get('content-range') ?? '0-0/0';
    const total = parseInt(contentRange.split('/')[1] ?? '0', 10);

    return {
      data: rows.map(normalizeProduct),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch {
    return { data: [], total: 0, page, totalPages: 0 };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULL_SELECT = [
  'id', 'supplier_ref', 'title', 'description', 'category',
  'supplier', 'base_price', 'images',
  'product_variants(id,sku,color,color_group,color_code,gtin,price,stock,images,category_level1,category_level2,category_level3)',
].join(',');

export async function getProductById(id: string): Promise<Product | null> {
  const isUUID = UUID_RE.test(id);
  const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
  url.searchParams.set('select', FULL_SELECT);
  url.searchParams.set('limit', '1');
  url.searchParams.set(isUUID ? 'id' : 'supplier_ref', `eq.${isUUID ? id : id.toUpperCase()}`);

  try {
    const res = await fetch(url.toString(), {
      headers: SB_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows: Record<string, unknown>[] = await res.json();
    return rows.length ? normalizeProduct(rows[0]) : null;
  } catch {
    return null;
  }
}

const CATEGORY_PAGE_SIZE = 1000;

export async function getCategories(): Promise<CategoryGroup[]> {
  const all: string[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set('select', 'category');
    url.searchParams.set('limit', String(CATEGORY_PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    try {
      const res = await fetch(url.toString(), {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const rows: { category: string }[] = await res.json();
      if (!rows.length) break;
      all.push(...rows.map((r) => r.category));
      if (rows.length < CATEGORY_PAGE_SIZE) break;
      offset += CATEGORY_PAGE_SIZE;
    } catch {
      break;
    }
  }

  const groups: Record<string, number> = {};
  for (const cat of all) {
    const upper = cat?.toUpperCase() ?? '';
    for (const [group, prefixes] of Object.entries(CATEGORY_GROUP_PREFIXES)) {
      if (prefixes.some((p) => upper.startsWith(p.toUpperCase()))) {
        groups[group] = (groups[group] ?? 0) + 1;
        break;
      }
    }
  }

  return Object.entries(groups)
    .map(([id, count]) => ({ id, label: CATEGORY_GROUP_LABELS[id] ?? id, count }))
    .sort((a, b) => b.count - a.count);
}
