import { Injectable } from '@nestjs/common';
import { buildPricingBreakdown, MARGIN_RATE, VAT_RATE } from '@yourgift/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {
    this.events.on('order.created', this.onOrderCreated.bind(this));
  }

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

  private async onOrderCreated(order: any) {
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
