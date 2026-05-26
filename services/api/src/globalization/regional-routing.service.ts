import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RegionalRoutingRule } from '@prisma/client';

@Injectable()
export class RegionalRoutingService {
  constructor(private readonly prisma: PrismaService) {}

  // Get the best region for a country code
  async getRegionForCountry(countryCode: string): Promise<RegionalRoutingRule | null> {
    const code = countryCode.toUpperCase();
    const rules = await this.prisma.regionalRoutingRule.findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      if (rule.countryCodes.includes(code)) {
        return rule;
      }
    }

    return null;
  }

  // Get preferred suppliers for a destination country
  async getPreferredSuppliers(countryCode: string): Promise<string[]> {
    const rule = await this.getRegionForCountry(countryCode);
    if (!rule || rule.preferredSuppliers.length === 0) {
      return ['midocean'];
    }
    return rule.preferredSuppliers;
  }

  // Get max lead time for a country
  async getMaxLeadTime(countryCode: string): Promise<number> {
    const rule = await this.getRegionForCountry(countryCode);
    return rule?.maxLeadTimeDays ?? 30;
  }

  // Get preferred currency for a country
  async getPreferredCurrency(countryCode: string): Promise<string> {
    const rule = await this.getRegionForCountry(countryCode);
    return rule?.currency ?? 'EUR';
  }

  // Get all routing rules
  async getRoutingRules(): Promise<RegionalRoutingRule[]> {
    return this.prisma.regionalRoutingRule.findMany({
      where: { isActive: true },
      orderBy: { region: 'asc' },
    });
  }

  // Update a routing rule
  async updateRule(
    region: string,
    params: Partial<{
      preferredSuppliers: string[];
      maxLeadTimeDays: number;
      currency: string;
      excludedSuppliers: string[];
    }>,
  ): Promise<RegionalRoutingRule> {
    return this.prisma.regionalRoutingRule.update({
      where: { region: region.toUpperCase() },
      data: {
        ...(params.preferredSuppliers !== undefined && { preferredSuppliers: params.preferredSuppliers }),
        ...(params.maxLeadTimeDays !== undefined && { maxLeadTimeDays: params.maxLeadTimeDays }),
        ...(params.currency !== undefined && { currency: params.currency }),
        ...(params.excludedSuppliers !== undefined && { excludedSuppliers: params.excludedSuppliers }),
      },
    });
  }
}
