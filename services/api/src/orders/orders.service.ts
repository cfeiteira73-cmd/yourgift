import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { generateOrderRef } from '@yourgift/shared';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {}

  async create(clientId: string, dto: CreateOrderDto) {
    const ref = generateOrderRef();

    const order = await this.prisma.order.create({
      data: {
        ref,
        clientId,
        status: 'pending',
        shippingAddress: dto.shippingAddress as any,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    this.events.emit('order.created', order);

    return order;
  }

  async findAll(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, clientId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, clientId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
    });
    this.events.emit(`order.${status}`, order);
    return order;
  }
}
