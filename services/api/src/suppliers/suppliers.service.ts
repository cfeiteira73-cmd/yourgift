import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';
import { PrismaService } from '../prisma/prisma.service';
import { MidoceanClient, MidoceanSyncService, transformProduct } from '@yourgift/midocean';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);
  private midocean: MidoceanClient;

  constructor(
    private config: ConfigService,
    private events: EventBusService,
    private prisma: PrismaService,
  ) {
    this.midocean = new MidoceanClient(this.config.getOrThrow('MIDOCEAN_KEY'));
    this.events.on('payment.confirmed', this.routeToSupplier.bind(this));
  }

  /** Sync all 2428 Midocean products into the database */
  async syncMidocean() {
    const syncer = new MidoceanSyncService(this.config.getOrThrow('MIDOCEAN_KEY'));

    return syncer.sync(async (data) => {
      const product = await this.prisma.product.upsert({
        where: { supplierRef: data.supplierRef },
        create: {
          supplierRef: data.supplierRef,
          supplier: data.supplier,
          title: data.title,
          description: data.description,
          category: data.category,
          basePrice: data.basePrice,
          images: data.images,
          printAreas: data.printAreas,
        },
        update: {
          title: data.title,
          description: data.description,
          category: data.category,
          basePrice: data.basePrice,
          images: data.images,
          printAreas: data.printAreas,
        },
      });

      for (const v of data.variants) {
        await this.prisma.productVariant.upsert({
          where: { sku: v.sku },
          create: {
            productId: product.id,
            sku: v.sku,
            color: v.color,
            price: v.price,
            stock: v.stock,
          },
          update: {
            price: v.price,
            stock: v.stock,
          },
        });
      }
    });
  }

  /** Route confirmed order to the correct supplier */
  private async routeToSupplier({ orderId }: { orderId: string }) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    const supplier = order.items[0]?.product?.supplier ?? 'midocean';

    if (supplier === 'midocean') {
      await this.dispatchToMidocean(order);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'in_production', supplier },
    });

    this.events.emit(`supplier.${supplier}.dispatched`, order);
  }

  private async dispatchToMidocean(order: any) {
    try {
      const response = await this.midocean.createOrder({
        order_reference: order.ref,
        delivery_address: {
          company_name: order.shippingAddress.company ?? order.shippingAddress.name,
          attention: order.shippingAddress.name,
          address1: order.shippingAddress.street,
          city: order.shippingAddress.city,
          postal_code: order.shippingAddress.postalCode,
          country_code: order.shippingAddress.country,
          phone: order.shippingAddress.phone,
        },
        order_rows: order.items.map((item: any) => ({
          sku: item.variant?.sku ?? item.variantId,
          quantity: item.quantity,
        })),
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { supplierOrderId: response.order_id },
      });

      this.logger.log(`Midocean order created: ${response.order_id} for order ${order.ref}`);
    } catch (err) {
      this.logger.error(`Failed to dispatch ${order.ref} to Midocean: ${err}`);
      throw err;
    }
  }
}
