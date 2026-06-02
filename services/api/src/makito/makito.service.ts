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
  MAKITO_BASE_URL,
} from '@yourgift/makito';
import type {
  MakitoOrderRequest,
  MakitoOrderResponse,
  MakitoSalesOrder,
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
      baseUrl: baseUrl ?? MAKITO_BASE_URL,
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

    // Real API returns { documents: [{ documentNumber, link }] }
    const documentNumber = response.documents?.[0]?.documentNumber;

    await this.prisma.order.update({
      where: { ref: order.customerOrder },
      data: {
        supplierOrderId: documentNumber ?? null,
        supplier: 'makito',
        status: 'confirmed',
      },
    });

    this.events.emit('makito.order.submitted', {
      ref: order.customerOrder,
      makitoDocumentNumber: documentNumber,
      documents: response.documents,
    });

    this.logger.log(`Makito order created: document ${documentNumber} for ${order.customerOrder}`);
    return response;
  }

  async cancelOrder(documentNumber: string, reason?: string) {
    // Makito API does not have a cancel endpoint.
    // Cancellations must be requested via Makito account manager.
    this.logger.warn(`Cancel requested for Makito order ${documentNumber}: ${reason ?? 'no reason'} — contact Makito account manager`);
    this.events.emit('makito.order.cancel_requested', { documentNumber, reason });
    return { requested: true, documentNumber, note: 'Contact Makito account manager to process cancellation' };
  }

  async getOrderStatus(documentNumber: string): Promise<MakitoSalesOrder> {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.getOrder(documentNumber);
  }

  async getOrders(filters: { status?: string; from?: string; to?: string } = {}) {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.getOrders(filters);
  }

  async getMetadata() {
    if (!this.client) throw new Error('Makito not configured');
    const [regions, countries, colors] = await Promise.all([
      this.client.getRegions(),
      this.client.getCountries(),
      this.client.getColors(),
    ]);
    return { regions, countries, colors };
  }

  // ── RFQ / Quote (Phase 7) ────────────────────────────────────────────────
  // Makito does not have an RFQ endpoint — use price list + stock check instead

  async getQuote(items: Array<{ variantRef: string; quantity: number }>) {
    if (!this.client) throw new Error('Makito not configured');
    const [priceMap, stockMap] = await Promise.all([
      this.client.getPriceMap(),
      this.client.getStockMap(),
    ]);

    return items.map(({ variantRef, quantity }) => {
      const priceItem = priceMap.get(variantRef);
      // Find best price for quantity from scales
      const unitPrice = priceItem ?? 0;
      const inStock = (stockMap.get(variantRef) ?? 0) >= quantity;
      return {
        variantRef,
        quantity,
        unitPrice,
        totalPrice: typeof unitPrice === 'number' ? unitPrice * quantity : 0,
        available: inStock,
        stockQty: stockMap.get(variantRef) ?? 0,
      };
    });
  }

  // ── Shipment Tracking (Phase 10) ─────────────────────────────────────────

  async getShipmentTracking(customerOrder: string) {
    if (!this.client) throw new Error('Makito not configured');
    const deliveries = await this.client.getDeliveries({ customerOrder });
    return deliveries.deliveries ?? [];
  }

  async getDeliveries(filters: { from?: string; to?: string; customerOrder?: string } = {}) {
    if (!this.client) throw new Error('Makito not configured');
    return this.client.getDeliveries(filters);
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

      // Makito order format: { customerOrder, items: [{variant, quantity}] }
      await this.submitOrder({
        customerOrder: order.ref,
        items: order.items.map((item: any) => ({
          variant: item.variant?.sku ?? item.variantId,
          quantity: item.quantity,
        })),
        deliveryAddress: {
          company: (order as any).shippingAddress?.company ?? (order as any).shippingAddress?.name,
          contact: (order as any).shippingAddress?.name,
          street: (order as any).shippingAddress?.street,
          city: (order as any).shippingAddress?.city,
          postalCode: (order as any).shippingAddress?.postalCode,
          countryCode: (order as any).shippingAddress?.country ?? 'PT',
          phone: (order as any).shippingAddress?.phone,
        },
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
