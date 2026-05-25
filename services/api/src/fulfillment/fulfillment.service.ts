import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateFulfillmentDto } from './dto/create-fulfillment.dto';

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async createFulfillment(dto: CreateFulfillmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    const allowedEntryStatuses = ['paid', 'approved'];
    if (!allowedEntryStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order must be in status "paid" or "approved" to start fulfillment. Current status: "${order.status}"`,
      );
    }

    if (['fulfilling', 'shipped'].includes(order.status)) {
      throw new BadRequestException(
        `Order ${dto.orderId} is already in status "${order.status}" — fulfillment already initiated`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: dto.orderId },
      data: {
        status: 'fulfilling',
        trackingNumber: dto.trackingNumber ?? null,
        shippedAt: new Date(),
        supplier: dto.supplierId,
      },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: dto.orderId,
        event: 'fulfillment.started',
        actorId: dto.supplierId,
        actorType: 'supplier',
        payload: {
          supplierId: dto.supplierId,
          trackingNumber: dto.trackingNumber ?? null,
          carrier: dto.carrier ?? null,
          warehouseNotes: dto.warehouseNotes ?? null,
          estimatedDelivery: dto.estimatedDelivery ?? null,
        },
        orderId: dto.orderId,
      },
    });

    this.events.emit('fulfillment.started', {
      orderId: dto.orderId,
      supplierId: dto.supplierId,
      trackingNumber: dto.trackingNumber ?? null,
      carrier: dto.carrier ?? null,
      estimatedDelivery: dto.estimatedDelivery ?? null,
    });

    return updated;
  }

  async markShipped(orderId: string, trackingNumber: string, carrier: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== 'fulfilling') {
      throw new BadRequestException(
        `Order must be in status "fulfilling" to mark as shipped. Current status: "${order.status}"`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'shipped',
        trackingNumber,
        shippedAt: new Date(),
      },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'fulfillment.shipped',
        actorId: order.supplier ?? 'system',
        actorType: 'supplier',
        payload: { trackingNumber, carrier },
        orderId,
      },
    });

    this.events.emit('fulfillment.shipped', {
      orderId,
      trackingNumber,
      carrier,
      shippedAt: updated.shippedAt,
    });

    return updated;
  }

  async markDelivered(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== 'shipped') {
      throw new BadRequestException(
        `Order must be in status "shipped" to mark as delivered. Current status: "${order.status}"`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
      },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'order.delivered',
        actorId: 'system',
        actorType: 'system',
        payload: { deliveredAt: updated.deliveredAt },
        orderId,
      },
    });

    // Triggers ledger supplier payable settlement downstream
    this.events.emit('order.delivered', {
      orderId,
      supplierId: order.supplier ?? null,
      deliveredAt: updated.deliveredAt,
      totalAmount: order.totalAmount,
    });

    return updated;
  }

  async getFulfillmentStatus(orderId: string): Promise<{
    status: string;
    trackingNumber: string | null;
    shippedAt: Date | null;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, trackingNumber: true, shippedAt: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    return {
      status: order.status,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
    };
  }
}
