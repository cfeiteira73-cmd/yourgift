import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RoutingCriteria {
  category: string;
  orderValue: number;
  region?: string;
  preferLowLeadTime?: boolean;
}

export interface RoutingResult {
  supplierId: string;
  supplierName: string;
  score: number;
  breakdown: { reliability: number; price: number; leadTime: number; composite: number };
  leadTimeDays: number;
  reason: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async selectOptimalSupplier(criteria: RoutingCriteria): Promise<RoutingResult | null> {
    const candidates = await this.prisma.supplierRoutingMatrix.findMany({
      where: {
        category: criteria.category,
        isActive: true,
        minOrderValue: { lte: criteria.orderValue },
        ...(criteria.region ? { supportedRegions: { has: criteria.region } } : {}),
      },
    });

    if (!candidates.length) {
      this.logger.warn(`No suppliers found for category=${criteria.category}`);
      return null;
    }

    // Filter by max order value
    const eligible = candidates.filter(
      c => !c.maxOrderValue || Number(c.maxOrderValue) >= criteria.orderValue,
    );

    if (!eligible.length) return null;

    // Multi-criteria scoring (weights: reliability 40%, price 35%, lead time 25%)
    const scored = eligible.map(s => {
      const reliability = Number(s.reliabilityScore);
      const price = Number(s.priceScore);
      const leadTimeScore = Math.max(0, 100 - Number(s.leadTimeDays) * 5); // shorter = higher score
      const leadTimeWeight = criteria.preferLowLeadTime ? 0.35 : 0.25;
      const composite =
        reliability * (criteria.preferLowLeadTime ? 0.35 : 0.40) +
        price * (criteria.preferLowLeadTime ? 0.30 : 0.35) +
        leadTimeScore * leadTimeWeight;

      return {
        supplierId: s.supplierId,
        supplierName: s.supplierName,
        score: Math.round(composite * 10) / 10,
        breakdown: {
          reliability: Math.round(reliability * 10) / 10,
          price: Math.round(price * 10) / 10,
          leadTime: Math.round(leadTimeScore * 10) / 10,
          composite: Math.round(composite * 10) / 10,
        },
        leadTimeDays: Number(s.leadTimeDays),
        reason: `Best composite score (reliability ${reliability}%, price ${price}%, lead time ${String(s.leadTimeDays)}d)`,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    this.logger.debug(
      `Routing: ${scored[0].supplierName} selected for ${criteria.category} (score: ${scored[0].score})`,
    );
    return scored[0];
  }

  async getRankedSuppliers(criteria: RoutingCriteria): Promise<RoutingResult[]> {
    const candidates = await this.prisma.supplierRoutingMatrix.findMany({
      where: { category: criteria.category, isActive: true },
    });

    return candidates
      .map(s => {
        const reliability = Number(s.reliabilityScore);
        const price = Number(s.priceScore);
        const leadTimeScore = Math.max(0, 100 - Number(s.leadTimeDays) * 5);
        const composite = reliability * 0.40 + price * 0.35 + leadTimeScore * 0.25;
        return {
          supplierId: s.supplierId,
          supplierName: s.supplierName,
          score: Math.round(composite * 10) / 10,
          breakdown: {
            reliability,
            price,
            leadTime: leadTimeScore,
            composite: Math.round(composite * 10) / 10,
          },
          leadTimeDays: Number(s.leadTimeDays),
          reason: '',
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async getMatrix() {
    return this.prisma.supplierRoutingMatrix.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });
  }

  async getRoutingMatrix() {
    return this.prisma.supplierRoutingMatrix.findMany({
      where: { isActive: true },
      orderBy: { reliabilityScore: 'desc' },
    });
  }
}
