import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductFilters {
  category?: string;
  supplier?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  data: any[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: ProductFilters = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(filters.category && { category: { contains: filters.category, mode: 'insensitive' } }),
      ...(filters.supplier && { supplier: filters.supplier }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { supplierRef: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.minPrice !== undefined && { basePrice: { gte: filters.minPrice } }),
      ...(filters.maxPrice !== undefined && { basePrice: { lte: filters.maxPrice } }),
      ...(filters.inStock && { variants: { some: { stock: { gt: 0 } } } }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { variants: { orderBy: { price: 'asc' }, take: 1 } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { price: 'asc' } } },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async getFeatured(limit = 8) {
    return this.prisma.product.findMany({
      where: { variants: { some: { stock: { gt: 100 } } } },
      include: { variants: { take: 1, orderBy: { price: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
