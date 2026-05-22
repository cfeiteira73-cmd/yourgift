import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    companyId: string;
    tenantId?: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    logoUrl?: string;
    styleKeywords?: string[];
    forbiddenColors?: string[];
    preferredLayouts?: string[];
    brandScoreThreshold?: number;
  }) {
    return this.prisma.brandTemplate.create({
      data: {
        companyId: data.companyId,
        tenantId: data.tenantId ?? 'default',
        name: data.name,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        logoUrl: data.logoUrl,
        styleKeywords: data.styleKeywords ?? [],
        forbiddenColors: data.forbiddenColors ?? [],
        preferredLayouts: data.preferredLayouts ?? ['centered'],
        brandScoreThreshold: data.brandScoreThreshold ?? 70,
      },
    });
  }

  async getForCompany(companyId: string) {
    return this.prisma.brandTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      primaryColor: string;
      secondaryColor: string;
      logoUrl: string;
      styleKeywords: string[];
      brandScoreThreshold: number;
    }>,
  ) {
    return this.prisma.brandTemplate.update({ where: { id }, data });
  }

  async list(tenantId?: string) {
    return this.prisma.brandTemplate.findMany({
      where: { ...(tenantId ? { tenantId } : {}), isActive: true },
      include: { _count: { select: { designJobs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
