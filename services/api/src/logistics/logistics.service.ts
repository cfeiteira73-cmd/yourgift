import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

// Local type mirrors — Prisma client will be regenerated after migration
export interface LogisticsProvider {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  strengths: string[];
  apiAvailable: boolean;
  createdAt: Date;
}

export interface ShippingRateCard {
  id: string;
  providerCode: string;
  zoneLevel: number;
  weightFromKg: PrismaAny;
  weightToKg: PrismaAny;
  basePrice: PrismaAny;
  pricePerKg: PrismaAny;
  fuelSurchargePct: PrismaAny;
  isActive: boolean;
  createdAt: Date;
}

export interface ShippingQuote {
  id: string;
  referenceId: string | null;
  referenceType: string | null;
  originCountry: string;
  destinationCountry: string;
  weightKg: PrismaAny;
  lengthCm: PrismaAny;
  widthCm: PrismaAny;
  heightCm: PrismaAny;
  volumetricWeightKg: PrismaAny;
  effectiveWeightKg: PrismaAny;
  options: PrismaAny;
  selectedProvider: string | null;
  selectedCost: PrismaAny;
  selectionReason: string | null;
  currency: string;
  createdAt: Date;
}

export interface ShippingOption {
  provider: string;
  providerCode: string;
  zoneLevel: number;
  baseCost: number;
  fuelSurcharge: number;
  totalCost: number;
  transitDaysMin: number;
  transitDaysMax: number;
  requiresCustoms: boolean;
  currency: string;
}

@Injectable()
export class LogisticsService {
  // Cast to any so that Sprint-13 models are accessible before prisma generate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.prisma;
  }

  constructor(private readonly prisma: PrismaService) {}

  async estimateShipping(params: {
    originCountry: string;
    destinationCountry: string;
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    referenceId?: string;
    referenceType?: string;
  }): Promise<{
    options: ShippingOption[];
    cheapest: ShippingOption;
    fastest: ShippingOption;
    effectiveWeightKg: number;
    volumetricWeightKg: number | null;
  }> {
    const {
      originCountry,
      destinationCountry,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      referenceId,
      referenceType,
    } = params;

    // Compute volumetric weight (DIM factor 5000)
    let volumetricWeightKg: number | null = null;
    if (lengthCm != null && widthCm != null && heightCm != null) {
      volumetricWeightKg =
        Math.round(((lengthCm * widthCm * heightCm) / 5000) * 1000) / 1000;
    }

    // Effective weight = max(actual, volumetric)
    const effectiveWeightKg =
      volumetricWeightKg != null
        ? Math.max(weightKg, volumetricWeightKg)
        : weightKg;

    // Find all zones for this origin->destination route
    const zones: Array<{
      providerCode: string;
      zoneLevel: number;
      transitDaysMin: number;
      transitDaysMax: number;
      requiresCustoms: boolean;
    }> = await this.db.shippingZone.findMany({
      where: { originCountry, destinationCountry },
    });

    const options: ShippingOption[] = [];

    for (const zone of zones) {
      // Find the matching rate card for the effective weight
      const rateCard: ShippingRateCard | null =
        await this.db.shippingRateCard.findFirst({
          where: {
            providerCode: zone.providerCode,
            zoneLevel: zone.zoneLevel,
            isActive: true,
            weightFromKg: { lte: effectiveWeightKg },
            weightToKg: { gt: effectiveWeightKg },
          },
        });

      if (!rateCard) continue;

      const weightFrom = Number(rateCard.weightFromKg);
      const basePrice = Number(rateCard.basePrice);
      const pricePerKg = Number(rateCard.pricePerKg);
      const fuelSurchargePct = Number(rateCard.fuelSurchargePct);

      // cost = base + (effectiveWeight - weightFrom) * pricePerKg
      const rawCost =
        basePrice + (effectiveWeightKg - weightFrom) * pricePerKg;

      // Apply fuel surcharge
      const fuelSurcharge =
        Math.round(rawCost * (fuelSurchargePct / 100) * 100) / 100;
      const totalCost = Math.round((rawCost + fuelSurcharge) * 100) / 100;
      const baseCost = Math.round(rawCost * 100) / 100;

      // Get provider name
      const provider: LogisticsProvider | null =
        await this.db.logisticsProvider.findUnique({
          where: { code: zone.providerCode },
        });

      options.push({
        provider: provider?.name ?? zone.providerCode.toUpperCase(),
        providerCode: zone.providerCode,
        zoneLevel: zone.zoneLevel,
        baseCost,
        fuelSurcharge,
        totalCost,
        transitDaysMin: zone.transitDaysMin,
        transitDaysMax: zone.transitDaysMax,
        requiresCustoms: zone.requiresCustoms,
        currency: 'EUR',
      });
    }

    // Sort by total cost ascending
    options.sort((a, b) => a.totalCost - b.totalCost);

    const cheapest = options[0];
    const fastest =
      options.length > 0
        ? options.reduce((prev, curr) =>
            curr.transitDaysMin < prev.transitDaysMin ||
            (curr.transitDaysMin === prev.transitDaysMin &&
              curr.transitDaysMax < prev.transitDaysMax)
              ? curr
              : prev,
          )
        : options[0];

    // Save quote to DB
    await this.db.shippingQuote.create({
      data: {
        referenceId: (referenceId ?? null) as string,
        referenceType: (referenceType ?? null) as string,
        originCountry,
        destinationCountry,
        weightKg,
        lengthCm: lengthCm ?? null,
        widthCm: widthCm ?? null,
        heightCm: heightCm ?? null,
        volumetricWeightKg: volumetricWeightKg ?? null,
        effectiveWeightKg,
        options: options as unknown as object[],
        selectedProvider: cheapest?.providerCode ?? null,
        selectedCost: cheapest?.totalCost ?? null,
        selectionReason: cheapest ? 'cheapest' : null,
        currency: 'EUR',
      },
    });

    return {
      options,
      cheapest,
      fastest,
      effectiveWeightKg,
      volumetricWeightKg,
    };
  }

  async getBestOption(params: {
    originCountry: string;
    destinationCountry: string;
    weightKg: number;
    maxTransitDays?: number;
    minMarginEur?: number;
    orderValueEur?: number;
  }): Promise<ShippingOption | null> {
    const result = await this.estimateShipping({
      originCountry: params.originCountry,
      destinationCountry: params.destinationCountry,
      weightKg: params.weightKg,
    });

    let candidates = result.options;

    if (params.maxTransitDays != null) {
      const max = params.maxTransitDays;
      candidates = candidates.filter((o) => o.transitDaysMax <= max);
    }

    if (params.minMarginEur != null && params.orderValueEur != null) {
      const minMargin = params.minMarginEur;
      const orderValue = params.orderValueEur;
      candidates = candidates.filter(
        (o) => orderValue - o.totalCost >= minMargin,
      );
    }

    return candidates.length > 0 ? candidates[0] : null;
  }

  async getCarrierStats(): Promise<
    Array<{
      provider: string;
      code: string;
      avgCostEur: number;
      avgTransitDays: number;
      quoteCount: number;
    }>
  > {
    const quotes: Array<{ options: PrismaAny }> =
      await this.db.shippingQuote.findMany({
        select: {
          options: true,
          selectedProvider: true,
          selectedCost: true,
        },
      });

    const statsMap = new Map<
      string,
      { totalCost: number; totalDays: number; count: number; name: string }
    >();

    for (const quote of quotes) {
      const opts = quote.options as ShippingOption[];
      for (const opt of opts) {
        const existing = statsMap.get(opt.providerCode);
        const avgDays = (opt.transitDaysMin + opt.transitDaysMax) / 2;
        if (existing) {
          existing.totalCost += opt.totalCost;
          existing.totalDays += avgDays;
          existing.count += 1;
        } else {
          statsMap.set(opt.providerCode, {
            totalCost: opt.totalCost,
            totalDays: avgDays,
            count: 1,
            name: opt.provider,
          });
        }
      }
    }

    return Array.from(statsMap.entries()).map(([code, stats]) => ({
      provider: stats.name,
      code,
      avgCostEur: Math.round((stats.totalCost / stats.count) * 100) / 100,
      avgTransitDays: Math.round((stats.totalDays / stats.count) * 10) / 10,
      quoteCount: stats.count,
    }));
  }

  async getRecentQuotes(limit = 50): Promise<ShippingQuote[]> {
    return this.db.shippingQuote.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<ShippingQuote[]>;
  }

  async getProviders(): Promise<LogisticsProvider[]> {
    return this.db.logisticsProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }) as Promise<LogisticsProvider[]>;
  }

  async getRateMatrix(): Promise<Record<string, ShippingRateCard[]>> {
    const cards: ShippingRateCard[] = await this.db.shippingRateCard.findMany({
      where: { isActive: true },
      orderBy: [
        { providerCode: 'asc' },
        { zoneLevel: 'asc' },
        { weightFromKg: 'asc' },
      ],
    });

    const result: Record<string, ShippingRateCard[]> = {};
    for (const card of cards) {
      if (!result[card.providerCode]) {
        result[card.providerCode] = [];
      }
      result[card.providerCode].push(card);
    }
    return result;
  }
}
