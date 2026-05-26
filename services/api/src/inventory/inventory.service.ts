import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit(): void {
    // Check inventory every 15 minutes
    this.checkTimer = setInterval(() => void this.runInventoryCheck(), 15 * 60 * 1000);
    // Also react to order fulfillment events (stock consumed)
    this.events.on('order.fulfillment_started', (order: unknown) =>
      this.checkOrderImpact(order),
    );
    this.logger.log('Inventory watcher started (15min interval)');
  }

  onModuleDestroy(): void {
    if (this.checkTimer) clearInterval(this.checkTimer);
  }

  async runInventoryCheck(): Promise<{ alerts: number; reorders: number }> {
    const lowStockVariants = await this.prisma.productVariant.findMany({
      where: {
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { isActive: true },
      },
      include: {
        product: {
          select: { id: true, title: true, supplier: true },
        },
      },
    });

    let alerts = 0;
    let reorders = 0;

    for (const variant of lowStockVariants) {
      // Skip if an unresolved alert already exists for this variant
      const existingAlert = await this.prisma.inventoryAlert.findFirst({
        where: { variantId: variant.id, resolved: false },
      });

      if (!existingAlert) {
        const alertType = variant.stock === 0 ? 'out_of_stock' : 'low_stock';

        await this.prisma.inventoryAlert.create({
          data: {
            variantId: variant.id,
            productId: variant.productId,
            alertType,
            currentStock: variant.stock,
            threshold: LOW_STOCK_THRESHOLD,
          },
        });
        alerts++;

        this.events.emit('inventory.low', {
          variantId: variant.id,
          sku: variant.sku,
          productTitle: variant.product.title,
          stock: variant.stock,
          alertType,
          supplier: variant.product.supplier,
        });

        if (variant.stock === 0) {
          this.events.emit('reorder.triggered', {
            productId: variant.productId,
            variantId: variant.id,
            sku: variant.sku,
            supplier: variant.product.supplier,
          });
          reorders++;
        }

        this.logger.warn(
          `${alertType.toUpperCase()}: ${variant.sku} (${variant.stock} units)`,
        );
      }
    }

    this.logger.log(`Inventory check complete — ${alerts} new alerts, ${reorders} reorders`);
    return { alerts, reorders };
  }

  private checkOrderImpact(order: unknown): void {
    // After order fulfillment, delay 5s for DB to update stock, then re-check
    const o = order as { items?: unknown[] } | null;
    if (!o?.items?.length) return;
    setTimeout(() => void this.runInventoryCheck(), 5_000);
  }

  async getInventoryStats(): Promise<{
    totalVariants: number;
    outOfStock: number;
    lowStock: number;
    activeAlerts: number;
    healthyStock: number;
  }> {
    const [totalVariants, outOfStock, lowStock, activeAlerts] = await Promise.all([
      this.prisma.productVariant.count(),
      this.prisma.productVariant.count({ where: { stock: 0 } }),
      this.prisma.productVariant.count({ where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
      this.prisma.inventoryAlert.count({ where: { resolved: false } }),
    ]);

    return {
      totalVariants,
      outOfStock,
      lowStock,
      activeAlerts,
      healthyStock: totalVariants - outOfStock - lowStock,
    };
  }

  async getLowStockItems(limit = 100) {
    return this.prisma.productVariant.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      include: {
        product: { select: { title: true, supplier: true, category: true } },
      },
      orderBy: { stock: 'asc' },
      take: limit,
    });
  }

  async resolveAlert(alertId: string) {
    return this.prisma.inventoryAlert.update({
      where: { id: alertId },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  async getAlerts(resolved = false) {
    return this.prisma.inventoryAlert.findMany({
      where: { resolved },
      include: {
        variant: { select: { sku: true, stock: true, color: true } },
        product: { select: { title: true, supplier: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
