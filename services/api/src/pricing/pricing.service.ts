import { Injectable, Logger } from '@nestjs/common';
import { buildPricingBreakdown, MARGIN_RATE, VAT_RATE } from '@yourgift/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

export interface PriceCalculationInput {
  productId: string;
  variantId?: string;
  quantity: number;
  basePrice: number;
  unitCost: number;
  clientTier?: string; // standard | premium | enterprise
  categoryName?: string;
  supplierId?: string;
}

export interface PriceCalculationResult {
  unitPrice: number;
  unitCost: number;
  margin: number;
  marginPct: number;
  discountsApplied: Array<{ name: string; type: string; value: number }>;
  finalPricePerUnit: number;
  totalPrice: number;
  breakdown: {
    basePrice: number;
    volumeDiscount: number;
    tierDiscount: number;
    finalPrice: number;
  };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  // Default margin tiers by client tier
  private readonly TIER_MARGINS: Record<string, number> = {
    standard: 0.35, // 35% margin
    premium: 0.28, // 28% margin (better price for premium)
    enterprise: 0.22, // 22% margin (best price for enterprise)
  };

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {
    this.events.on('order.created', this.onOrderCreated.bind(this));
  }

  // ── Legacy calculate (kept for backwards compatibility) ────────────────────

  async calculate(dto: CalculatePriceDto) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
      include: { variants: true },
    });

    const variant = product.variants.find((v) => v.id === dto.variantId);
    if (!variant) throw new Error('Variant not found');

    const printCost = this.estimatePrintCost(dto.technique, dto.quantity);
    const shippingCost = this.estimateShipping(dto.quantity, dto.destinationCountry);

    return buildPricingBreakdown(
      variant.price * dto.quantity,
      printCost,
      shippingCost,
      MARGIN_RATE,
      VAT_RATE,
    );
  }

  // ── Advanced pricing engine ────────────────────────────────────────────────

  async calculatePrice(input: PriceCalculationInput): Promise<PriceCalculationResult> {
    const rules = await this.getActiveRules(input);

    let unitPrice = input.basePrice;
    const discountsApplied: Array<{ name: string; type: string; value: number }> = [];

    // Sort rules by priority (highest first)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!this.ruleApplies(rule, input)) continue;

      const discountedPrice = this.applyDiscount(unitPrice, rule);
      const discount = unitPrice - discountedPrice;

      if (discount > 0) {
        discountsApplied.push({ name: rule.name, type: rule.discountType, value: discount });
        unitPrice = discountedPrice;
      }
    }

    // Apply tier-based markup if price is too close to cost
    const tierMargin = this.TIER_MARGINS[input.clientTier ?? 'standard'] ?? 0.35;
    if (unitPrice <= input.unitCost) {
      unitPrice = input.unitCost / (1 - tierMargin);
    }

    // Enforce minimum margin (absolute floor: 15%)
    const minMarginPrice = input.unitCost / (1 - 0.15);
    if (unitPrice < minMarginPrice) {
      unitPrice = minMarginPrice;
    }

    const margin = unitPrice - input.unitCost;
    const marginPct = margin / unitPrice;

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      unitCost: input.unitCost,
      margin: Math.round(margin * 100) / 100,
      marginPct: Math.round(marginPct * 1000) / 10, // percentage with 1 decimal
      discountsApplied,
      finalPricePerUnit: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(unitPrice * input.quantity * 100) / 100,
      breakdown: {
        basePrice: input.basePrice,
        volumeDiscount:
          input.basePrice - unitPrice > 0
            ? Math.round((input.basePrice - unitPrice) * 100) / 100
            : 0,
        tierDiscount: 0,
        finalPrice: Math.round(unitPrice * 100) / 100,
      },
    };
  }

  async simulatePrice(input: PriceCalculationInput): Promise<PriceCalculationResult> {
    return this.calculatePrice(input);
  }

  // ── Pricing rules CRUD ─────────────────────────────────────────────────────

  async createRule(data: {
    name: string;
    ruleType: string;
    targetId?: string;
    minQuantity?: number;
    maxQuantity?: number;
    discountType: string;
    discountValue: number;
    marginMin?: number;
    clientTier?: string;
    priority?: number;
  }) {
    return this.prisma.pricingRule.create({ data });
  }

  async getRules() {
    return this.prisma.pricingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateRule(
    id: string,
    data: Partial<{
      name: string;
      discountValue: number;
      isActive: boolean;
      priority: number;
      discountType: string;
      marginMin: number;
      clientTier: string;
      minQuantity: number;
      maxQuantity: number;
      targetId: string;
    }>,
  ) {
    return this.prisma.pricingRule.update({ where: { id }, data });
  }

  async deleteRule(id: string) {
    return this.prisma.pricingRule.delete({ where: { id } });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ruleApplies(rule: {
    clientTier?: string | null;
    minQuantity: number;
    maxQuantity?: number | null;
    ruleType: string;
    targetId?: string | null;
  }, input: PriceCalculationInput): boolean {
    if (rule.clientTier && rule.clientTier !== (input.clientTier ?? 'standard')) return false;
    if (rule.minQuantity && input.quantity < rule.minQuantity) return false;
    if (rule.maxQuantity && input.quantity > rule.maxQuantity) return false;
    if (rule.targetId) {
      if (rule.ruleType === 'product' && rule.targetId !== input.productId) return false;
      if (rule.ruleType === 'category' && rule.targetId !== input.categoryName) return false;
      if (rule.ruleType === 'supplier' && rule.targetId !== input.supplierId) return false;
    }
    return true;
  }

  private applyDiscount(price: number, rule: { discountType: string; discountValue: number }): number {
    switch (rule.discountType) {
      case 'percentage':
        return price * (1 - rule.discountValue / 100);
      case 'fixed':
        return Math.max(0, price - rule.discountValue);
      case 'multiplier':
        return price * rule.discountValue;
      default:
        return price;
    }
  }

  private async getActiveRules(input: PriceCalculationInput) {
    return this.prisma.pricingRule.findMany({
      where: {
        isActive: true,
        OR: [
          { ruleType: 'volume', minQuantity: { lte: input.quantity } },
          { ruleType: 'tier', clientTier: input.clientTier ?? 'standard' },
          { ruleType: 'product', targetId: input.productId },
          ...(input.categoryName ? [{ ruleType: 'category', targetId: input.categoryName }] : []),
          ...(input.supplierId ? [{ ruleType: 'supplier', targetId: input.supplierId }] : []),
          { ruleType: 'client' },
        ],
      },
    });
  }

  private estimatePrintCost(technique: string, quantity: number): number {
    const rates: Record<string, number> = {
      embroidery: 3.5,
      dtf: 2.0,
      laser: 1.5,
      pad: 1.0,
      screen: 0.8,
    };
    const rate = rates[technique] ?? 2.0;
    const volumeDiscount = quantity >= 100 ? 0.8 : quantity >= 50 ? 0.9 : 1;
    return Math.round(rate * quantity * volumeDiscount * 100) / 100;
  }

  private estimateShipping(quantity: number, country: string): number {
    const base = country === 'PT' ? 5 : country === 'ES' ? 8 : 15;
    return Math.round((base + quantity * 0.1) * 100) / 100;
  }

  private async onOrderCreated(order: { id: string; items?: Array<{ unitPrice: number; quantity: number }> }) {
    const items = order.items ?? [];
    let total = 0;
    for (const item of items) {
      total += item.unitPrice * item.quantity;
    }
    await this.prisma.order.update({
      where: { id: order.id },
      data: { totalAmount: total },
    });
    this.events.emit('pricing.complete', { orderId: order.id, total });
  }
}
