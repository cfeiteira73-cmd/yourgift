import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import {
  buildPricingBreakdown,
  estimatePrintCost,
  generateOrderRef,
  generateQuoteRef,
  MARGIN_RATE,
  VAT_RATE,
} from '@yourgift/shared';

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {}

  async create(clientId: string, dto: CreateQuoteDto) {
    const ref = generateQuoteRef();

    const quote = await this.prisma.quote.create({
      data: {
        ref,
        clientId,
        companyId: dto.companyId,
        departmentId: dto.departmentId,
        status: 'draft',
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        notes: dto.notes,
        artworkUrl: dto.artworkUrl,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            technique: item.technique,
            notes: item.notes,
          })),
        },
      },
      include: { items: { include: { product: true, variant: true } } },
    });

    await this.logEvent('quote', quote.id, 'quote.created', 'system', 'system', {
      ref: quote.ref,
      clientId,
      itemCount: quote.items.length,
    });

    this.events.emit('quote.created', quote);
    return quote;
  }

  async findAll(clientId: string) {
    return this.prisma.quote.findMany({
      where: { clientId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, clientId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, clientId },
      include: {
        items: { include: { product: true, variant: true } },
        client: true,
      },
    });
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    return quote;
  }

  async submit(id: string, clientId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, clientId },
    });
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'draft') {
      throw new BadRequestException(
        `Quote is in status "${quote.status}", only draft quotes can be submitted`,
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: 'submitted' },
      include: { items: true },
    });

    await this.logEvent('quote', id, 'quote.submitted', clientId, 'client', {
      ref: updated.ref,
    });

    this.events.emit('quote.submitted', updated);
    return updated;
  }

  async calculatePricing(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true, variant: true },
        },
      },
    });
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (!['submitted', 'pricing'].includes(quote.status)) {
      throw new BadRequestException(
        `Quote must be in submitted or pricing state to calculate pricing`,
      );
    }

    // Mark as pricing while calculating
    await this.prisma.quote.update({ where: { id }, data: { status: 'pricing' } });

    let totalAmount = 0;
    let marginAmount = 0;
    const lineBreakdowns: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      technique: string;
      breakdown: ReturnType<typeof buildPricingBreakdown>;
    }> = [];

    for (const item of quote.items) {
      const basePrice = item.variant?.price ?? item.product.basePrice;
      const printCost = estimatePrintCost(item.technique ?? 'pad', item.quantity);
      const breakdown = buildPricingBreakdown(
        basePrice * item.quantity,
        printCost,
        0, // shipping calculated separately at order level
        MARGIN_RATE,
        VAT_RATE,
      );

      // Persist unit prices back to item
      await this.prisma.quoteItem.update({
        where: { id: item.id },
        data: {
          unitCost: basePrice,
          unitPrice: parseFloat((breakdown.total / item.quantity).toFixed(2)),
        },
      });

      totalAmount += breakdown.total;
      marginAmount += breakdown.margin;
      lineBreakdowns.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        technique: item.technique ?? 'pad',
        breakdown,
      });
    }

    const pricingSnapshot = {
      calculatedAt: new Date().toISOString(),
      lines: lineBreakdowns,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      marginAmount: parseFloat(marginAmount.toFixed(2)),
    };

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'approved',
        pricingSnapshot: JSON.parse(JSON.stringify(pricingSnapshot)) as Prisma.InputJsonValue,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        marginAmount: parseFloat(marginAmount.toFixed(2)),
      },
      include: { items: true },
    });

    await this.logEvent('quote', id, 'quote.pricing_complete', 'system', 'system', {
      totalAmount,
      marginAmount,
    });

    this.events.emit('quote.approved', updated);
    return updated;
  }

  async convert(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { include: { variants: { take: 1, orderBy: { stock: 'desc' } } } },
            variant: true,
          },
        },
        client: true,
      },
    });
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'approved') {
      throw new BadRequestException(
        `Only approved quotes can be converted. Current status: "${quote.status}"`,
      );
    }
    if (quote.convertedOrderId) {
      throw new BadRequestException(`Quote already converted to order ${quote.convertedOrderId}`);
    }

    // Build order ref
    const orderRef = generateOrderRef();

    // Derive shipping address from company or a default placeholder
    const shippingAddress = quote.client.company
      ? { name: quote.client.name, company: quote.client.company, country: 'PT' }
      : { name: quote.client.name, country: 'PT' };

    const order = await this.prisma.order.create({
      data: {
        ref: orderRef,
        clientId: quote.clientId,
        companyId: quote.companyId ?? undefined,
        departmentId: quote.departmentId ?? undefined,
        status: 'created',
        shippingAddress: JSON.parse(JSON.stringify(shippingAddress)) as Prisma.InputJsonValue,
        totalAmount: quote.totalAmount ?? undefined,
        marginAmount: quote.marginAmount ?? undefined,
        pricingSnapshot: quote.pricingSnapshot !== null && quote.pricingSnapshot !== undefined
          ? JSON.parse(JSON.stringify(quote.pricingSnapshot)) as Prisma.InputJsonValue
          : undefined,
        items: {
          create: quote.items.map((qi) => ({
            productId: qi.productId,
            variantId: qi.variantId ?? qi.product.variants?.[0]?.id ?? '',
            quantity: qi.quantity,
            unitCost: qi.unitCost ?? 0,
            unitPrice: qi.unitPrice ?? 0,
            printCost: 0,
            technique: qi.technique ?? undefined,
          })),
        },
      },
      include: { items: true },
    });

    await this.prisma.quote.update({
      where: { id },
      data: { status: 'converted', convertedOrderId: order.id },
    });

    await this.logEvent('quote', id, 'quote.converted', 'system', 'system', {
      orderId: order.id,
      orderRef: order.ref,
    });

    this.events.emit('quote.converted', { quoteId: id, orderId: order.id, order });
    return { orderId: order.id, orderRef: order.ref };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async logEvent(
    entity: string,
    entityId: string,
    event: string,
    actorId: string,
    actorType: string,
    payload: Prisma.InputJsonValue,
    orderId?: string,
  ) {
    await this.prisma.eventLog.create({
      data: { entity, entityId, event, actorId, actorType, payload, orderId: orderId ?? null },
    });
  }
}
