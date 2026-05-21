import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductFilters {
  category?: string;       // Midocean category prefix e.g. "MOBTEX"
  categoryGroup?: string;  // UI group: apparel|office|bags|drinkware|tech|writing|leisure|personal|tools|seasonal
  supplier?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  eco?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc';
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  data: any[];
  total: number;
  page: number;
  totalPages: number;
}

/** Maps UI category groups to Midocean category code prefixes */
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

/** Human-readable labels for category groups */
export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  apparel:    'Apparel & Clothing',
  bags:       'Bags & Travel',
  drinkware:  'Drinkware',
  home:       'Home & Living',
  office:     'Office & Desk',
  tech:       'Tech & Gadgets',
  writing:    'Writing & Stationery',
  leisure:    'Leisure & Sports',
  personal:   'Personal Care',
  tools:      'Tools',
  stationery: 'Pocket & Stationery',
  kitchen:    'Kitchen & BBQ',
  seasonal:   'Seasonal & Gifts',
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: ProductFilters = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
    const skip = (page - 1) * limit;

    // Build category filter
    let categoryCondition: any = undefined;
    if (filters.categoryGroup && filters.categoryGroup !== 'all') {
      const prefixes = CATEGORY_GROUP_PREFIXES[filters.categoryGroup] ?? [];
      if (prefixes.length > 0) {
        categoryCondition = {
          OR: prefixes.map((prefix) => ({
            category: { startsWith: prefix, mode: 'insensitive' as const },
          })),
        };
      }
    } else if (filters.category) {
      categoryCondition = { category: { startsWith: filters.category, mode: 'insensitive' as const } };
    }

    // Build AND conditions to avoid OR collisions
    const andConditions: any[] = [];

    if (categoryCondition) andConditions.push(categoryCondition);

    if (filters.supplier) andConditions.push({ supplier: filters.supplier });

    if (filters.search) {
      andConditions.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { supplierRef: { contains: filters.search, mode: 'insensitive' } },
          { category: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.minPrice !== undefined) andConditions.push({ basePrice: { gte: filters.minPrice } });
    if (filters.maxPrice !== undefined) andConditions.push({ basePrice: { lte: filters.maxPrice } });
    if (filters.inStock) andConditions.push({ variants: { some: { stock: { gt: 0 } } } });

    if (filters.eco) {
      andConditions.push({
        OR: [
          { category: { startsWith: 'MOBL&G' } },
          { description: { contains: 'recycl', mode: 'insensitive' } },
          { description: { contains: 'bamboo', mode: 'insensitive' } },
          { description: { contains: 'organic', mode: 'insensitive' } },
          { description: { contains: 'sustainab', mode: 'insensitive' } },
          { description: { contains: 'eco', mode: 'insensitive' } },
        ],
      });
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

    // Sort order
    let orderBy: any = { updatedAt: 'desc' };
    if (filters.sort === 'price_asc') orderBy = { basePrice: 'asc' };
    else if (filters.sort === 'price_desc') orderBy = { basePrice: 'desc' };
    else if (filters.sort === 'name_asc') orderBy = { title: 'asc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          variants: {
            orderBy: { price: 'asc' },
            take: 3,
            select: {
              id: true,
              sku: true,
              color: true,
              colorGroup: true,
              price: true,
              stock: true,
              images: true,
              categoryLevel1: true,
              categoryLevel2: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    // Support both UUID and supplierRef
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const product = await this.prisma.product.findUnique({
      where: isUUID ? { id } : { supplierRef: id.toUpperCase() },
      include: {
        variants: {
          orderBy: { price: 'asc' },
          select: {
            id: true,
            sku: true,
            color: true,
            colorGroup: true,
            colorCode: true,
            gtin: true,
            price: true,
            stock: true,
            images: true,
            categoryLevel1: true,
            categoryLevel2: true,
            categoryLevel3: true,
          },
        },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getCategories() {
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    // Group into UI categories with counts
    const groups: Record<string, number> = {};
    for (const row of rows) {
      for (const [group, prefixes] of Object.entries(CATEGORY_GROUP_PREFIXES)) {
        if (prefixes.some((p) => row.category.toUpperCase().startsWith(p.toUpperCase()))) {
          groups[group] = (groups[group] ?? 0) + 1;
        }
      }
    }

    return Object.entries(groups)
      .map(([id, count]) => ({ id, label: CATEGORY_GROUP_LABELS[id] ?? id, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getFeatured(limit = 12) {
    return this.prisma.product.findMany({
      where: {
        images: { isEmpty: false },
        variants: { some: { stock: { gt: 0 } } },
      },
      include: {
        variants: {
          take: 1,
          orderBy: { price: 'asc' },
          select: { price: true, stock: true, images: true, color: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getStats() {
    const [productCount, variantCount, inStockCount] = await this.prisma.$transaction([
      this.prisma.product.count(),
      this.prisma.productVariant.count(),
      this.prisma.productVariant.count({ where: { stock: { gt: 0 } } }),
    ]);
    return { productCount, variantCount, inStockCount };
  }
}
