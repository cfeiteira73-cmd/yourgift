import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { VatRule } from '@prisma/client';

@Injectable()
export class VatService {
  constructor(private readonly prisma: PrismaService) {}

  // Get VAT rate for a country and optional product category
  async getRate(
    countryCode: string,
    category?: string,
  ): Promise<{ rate: number; isReduced: boolean; countryName: string }> {
    const rule = await this.prisma.vatRule.findUnique({
      where: { countryCode: countryCode.toUpperCase() },
    });

    if (!rule) {
      return { rate: 0, isReduced: false, countryName: 'Unknown' };
    }

    // Check category overrides first
    if (category) {
      const overrides = rule.categoryOverrides as unknown as Record<string, number>;
      if (overrides && typeof overrides === 'object' && category in overrides) {
        return {
          rate: overrides[category],
          isReduced: true,
          countryName: rule.countryName,
        };
      }
    }

    return {
      rate: Number(rule.standardRate),
      isReduced: false,
      countryName: rule.countryName,
    };
  }

  // Compute VAT breakdown for a net amount
  async computeVAT(
    netAmount: number,
    countryCode: string,
    category?: string,
  ): Promise<{
    netAmount: number;
    vatRate: number;
    vatAmount: number;
    grossAmount: number;
    countryCode: string;
    countryName: string;
    isReduced: boolean;
  }> {
    const { rate, isReduced, countryName } = await this.getRate(countryCode, category);
    const vatAmount = netAmount * (rate / 100);
    const grossAmount = netAmount + vatAmount;

    return {
      netAmount: Math.round(netAmount * 100) / 100,
      vatRate: rate,
      vatAmount: Math.round(vatAmount * 100) / 100,
      grossAmount: Math.round(grossAmount * 100) / 100,
      countryCode: countryCode.toUpperCase(),
      countryName,
      isReduced,
    };
  }

  // Validate VAT number format (basic regex check)
  validateVATNumber(vatNumber: string, countryCode: string): boolean {
    const patterns: Record<string, RegExp> = {
      PT: /^PT\d{9}$/,
      ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      DE: /^DE\d{9}$/,
      FR: /^FR[A-Z0-9]{2}\d{9}$/,
      IT: /^IT\d{11}$/,
      NL: /^NL\d{9}B\d{2}$/,
      BE: /^BE0\d{9}$/,
      PL: /^PL\d{10}$/,
      CZ: /^CZ\d{8,10}$/,
      SE: /^SE\d{12}$/,
      DK: /^DK\d{8}$/,
      AT: /^ATU\d{8}$/,
      GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
      CH: /^CHE\d{9}(MWST|TVA|IVA)?$/,
    };

    const pattern = patterns[countryCode.toUpperCase()];
    if (!pattern) return true; // No pattern defined — treat as valid

    return pattern.test(vatNumber.replace(/[\s\-.]/g, '').toUpperCase());
  }

  // Get all VAT rules
  async getVATRules(): Promise<VatRule[]> {
    return this.prisma.vatRule.findMany({
      where: { isActive: true },
      orderBy: { countryCode: 'asc' },
    });
  }

  // Get EU member states only
  async getEUMembers(): Promise<VatRule[]> {
    return this.prisma.vatRule.findMany({
      where: { isActive: true, isEuMember: true },
      orderBy: { countryCode: 'asc' },
    });
  }
}
