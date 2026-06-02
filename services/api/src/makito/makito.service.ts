// ── Makito Main Service (Phases 1-3, 7-8) ────────────────────────────────────
// Orchestrates auth, sync, inventory, orders, RFQ, tracking

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  MakitoClient,
  MakitoCatalogSyncService,
  transformMakitoProduct,
} from '@yourgift/makito';
import type {
  MakitoOrderRequest,
  MakitoOrderResponse,
  MakitoRFQRequest,
  MakitoRFQResponse,
} from '@yourgift/makito';
import type { MakitoSyncResult } from '@yourgift/makito';

@Injectable()
export class MakitoService implements OnModuleInit {
  private readonly logger = new Logger(MakitoService.name);
  private client?: MakitoClient;
  private syncer?: MakitoCatalogSyncService;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    const clientId = this.config.get<string>('MAKITO_CLIENT_ID');
    const clientSecret = this.config.get<string>('MAKITO_CLIENT_SECRET');
    const baseUrl = this.config.get<string>('MAKITO_BASE_URL');

    if (!clientId || !clientSecret) {
      this.logger.warn('Makito: MAKITO_CLIENT_ID or MAKITO_CLIENT_SECRET not set — integration disabled');
      return;
    }

    this.client = new MakitoClient({
      clientId,
      clientSecret,
      baseUrl,
      logger: (msg) => this.logger.debug(msg),
    });

    this.syncer = new MakitoCatalogSyncService({ clientId, clientSecret, baseUrl });
    this.enabled = true;
    this.logger.log('Makito integration: ENABLED');

    // Subscribe to order routing
    this.events.on('payment.confirmed', this.onPaymentConfirmed.bind(this));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Health Check ──────────────────────────────────────────────────────────

  async healthCheck() {
    if (!this.client) return { healthy: false, reason: 'not configured' };
    const result = await this.client.healthCheck();
    return {
      ...result,
      circuit: this.client.getCircuitState(),
      supplier: 'makito',
    };
  }

  // ── Catalog Sync ─────────────────────────────────────────────────────────

  async syncFull(): Promise<MakitoSyncResult> {
    if (!this.syncer) throw new Error('Makito not configured');
    this.logger.log('Starting Makito full catalog sync...');

    const [stockMap, priceMap] = await Promise.all([
      this.client!.getStockMap(),
      this.client!.getPriceMap('EUR'),
    ]);

    const result = await this.syncer.syncFull(async (data) => {
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
          updatedAt: new Date(),
        },
      });

      for (const v of data.variants) {
        await this.prisma.productVariant.upsert({
          where: { sku: v.sku },
          create: {
            productId: product.id,
            sku: v.sku,
            color: v.color,
            colorGroup: v.colorGroup,
            colorCode: v.colorCode,
            gtin: v.gtin,
            price: v.price,
            stock: v.stock,
            images: v.images,
            categoryLevel1: v.categoryLevel1,
            categoryLevel2: v.categoryLevel2,
            categoryLevel3: v.categoryLevel3,
          },
          update: {
            price: v.price,
            stock: v.stock,
            images: v.images,
          },
        });
      }
    });

    await this.prisma.syncLog.create({
      data: {
        supplier: 'makito',
        productsUpserted: result.productsUpserted,
        variantsUpserted: result.variantsUpserted,
        stockUpdated: result.stockUpdated,
        errors: result.errors,
        durationMs: result.durationMs,
      },
    });

    this.events.emit('makito.sync.completed', result);
    this.logger.log(`Makito sync done: ${result.productsUpserted} products, ${result.variantsUpserted} variants`);
    return result;
  }

  async syncIncremental(since: string): Promise<MakitoSyncResult> {
    if (!this.syncer) throw new Error('Makito not configured');

    const result = await this.syncer.syncIncremental(async (data) => {
      await this.prisma.product.upsert({
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
          updatedAt: new Date(),
        },
      });
    }, since);

    await this.prisma.syncLog.create({
      data: {
        supplier: 'makito',
        productsUpserted: result.productsUpserted,
        variantsUpserted: result.variantsUpserted,
        stockUpdated: result.stockUpdated,
        errors: result.errors,
        durationMs: result.durationMs,
      },
    });

    return result;
  }

  async syncStockOnly() {
    if (!this.syncer) throw new Error('Makito not configured');

    return this.syncer.syncStock(async (sku, qty) => {
      await this.prisma.productVariant.updateMany({
        where: { sku, product: { supplier: 'makito' } },
        data: { stock: qty },
      });
    });
  }

  // ── Orders (Phase 8) ──────────────────────────────────────────────────────

  async submitOrder(order: MakitoOrderRequest): Promise<MakitoOrderResponse> {
    if (!this.client) throw new Error('Makito not configured');

    this.logger.log(`Submitting Makito order: ${order.reference}`);

    const response = await this.client.createOrder(order);

    await this.prisma.order.update({
      where: { ref: order.reference },
      data: {
        supplierOrderId: response.orderId,
        supplier: 'makito',
        status: this.mapMakitoStatus(response.status),
      },
    });

    this.events.emit('makito.order.submitted', {
      ref: order.reference,
      makitoOrderId: response.orderId,
      status: response.status,
    });

    this.logger.log(`Makito order created: ${response.orderId} (${response.status})`);
    return response;
  }

  async cancelOrder(makitoOrderId: string, reason?: string) {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.cancelOrder(makitoOrderId, reason);
  }

  async getOrderStatus(makitoOrderId: string): Promise<MakitoOrderResponse> {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.getOrder(makitoOrderId);
  }

  // ── RFQ (Phase 7) ─────────────────────────────────────────────────────────

  async createRFQ(req: MakitoRFQRequest): Promise<MakitoRFQResponse> {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.createRFQ(req);
  }

  // ── Shipment Tracking (Phase 10) ─────────────────────────────────────────

  async getShipmentTracking(makitoOrderId: string) {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.getShipmentTracking(makitoOrderId);
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  async getLiveStock(sku?: string) {
    if (!this.client) throw new Error('Makito not configured');
    const { items } = await this.client.getStock();
    if (sku) return items.filter((i) => i.sku === sku);
    return items;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [products, variants, lastSync] = await Promise.all([
      this.prisma.product.count({ where: { supplier: 'makito' } }),
      this.prisma.productVariant.count({ where: { product: { supplier: 'makito' } } }),
      this.prisma.syncLog.findFirst({
        where: { supplier: 'makito' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      supplier: 'makito',
      enabled: this.enabled,
      products,
      variants,
      lastSync: lastSync ?? null,
      circuit: this.client?.getCircuitState() ?? null,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async onPaymentConfirmed({ orderId }: { orderId: string }) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order || order.items[0]?.product?.supplier !== 'makito') return;
      if (!this.enabled) {
        this.logger.warn(`Makito not configured — cannot dispatch order ${order.ref}`);
        return;
      }

      await this.submitOrder({
        reference: order.ref,
        deliveryAddress: {
          company: (order as any).shippingAddress?.company ?? (order as any).shippingAddress?.name ?? '',
          contact: (order as any).shippingAddress?.name ?? '',
          street: (order as any).shippingAddress?.street ?? '',
          city: (order as any).shippingAddress?.city ?? '',
          postalCode: (order as any).shippingAddress?.postalCode ?? '',
          countryCode: (order as any).shippingAddress?.country ?? 'PT',
          phone: (order as any).shippingAddress?.phone,
        },
        lines: order.items.map((item: any) => ({
          sku: item.variant?.sku ?? item.variantId,
          quantity: item.quantity,
        })),
      });
    } catch (err) {
      this.logger.error(`Failed to dispatch order ${orderId} to Makito: ${err}`);
    }
  }

  private mapMakitoStatus(status: string): string {
    const map: Record<string, string> = {
      RECEIVED: 'confirmed',
      CONFIRMED: 'confirmed',
      ARTWORK_REVIEW: 'producing',
      IN_PRODUCTION: 'producing',
      QUALITY_CONTROL: 'producing',
      PACKED: 'producing',
      SHIPPED: 'shipped',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
      ON_HOLD: 'pending',
    };
    return map[status] ?? 'pending';
  }
}
