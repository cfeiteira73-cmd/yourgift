import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { category?: string; supplier?: string; search?: string }) {
    return this.prisma.product.findMany({
      where: {
        ...(filters?.category && { category: filters.category }),
        ...(filters?.supplier && { supplier: filters.supplier }),
        ...(filters?.search && {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { variants: true },
    });
  }
}
