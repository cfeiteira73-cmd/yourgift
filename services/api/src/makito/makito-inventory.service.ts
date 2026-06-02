// ── Phase 3 — Makito Inventory Intelligence ───────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { MakitoService } from './makito.service';

export interface MakitoInventoryAlert {
  sku: string;
  productTitle: string;
  currentStock: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  trend: 'declining' | 'stable' | 'rising' | 'unknown';
  volatility: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100
  recommendedAction: 'reorder_now' | 'reorder_soon' | 'monitor';
}

export interface MakitoInventoryReport {
  generatedAt: string;
  totalSkus: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  alerts: MakitoInventoryAlert[];
  stockValue: number;
  coverageDays: number; // estimated days of stock at current velocity
}

@Injectable()
export class MakitoInventoryService {
  private readonly logger = new Logger(MakitoInventoryService.name);
  private readonly LOW_STOCK_THRESHOLD = 50;
  private readonly CRITICAL_THRESHOLD = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly makito: MakitoService,
  ) {}

  /** Live inventory state merged with DB order velocity */
  async getInventoryReport(): Promise<MakitoInventoryReport> {
    // Get current stock from DB
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { supplier: 'makito' } },
      include: { product: { select: { title: true, basePrice: true } } },
    });

    // Get order velocity (units sold last 30 days per SKU)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const velocity = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        order: { createdAt: { gte: thirtyDaysAgo }, status: { in: ['confirmed', 'shipped', 'delivered'] } },
      },
      _sum: { quantity: true },
    });

    const velocityMap = new Map(velocity.map((v) => [v.variantId, (v._sum.quantity ?? 0) / 30]));

    const alerts: MakitoInventoryAlert[] = [];
    let inStock = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let stockValue = 0;

    for (const v of variants) {
      const stock = v.stock ?? 0;
      const dailyVelocity = velocityMap.get(v.id) ?? 0;
      const price = Number(v.price ?? 0);

      stockValue += stock * price;
      if (stock === 0) outOfStock++;
      else if (stock <= this.LOW_STOCK_THRESHOLD) { lowStock++; }
      else inStock++;

      // Generate alerts for low/critical stock
      if (stock <= this.CRITICAL_THRESHOLD && dailyVelocity > 0) {
        alerts.push(this.buildAlert(v, stock, dailyVelocity, 'critical'));
      } else if (stock <= this.LOW_STOCK_THRESHOLD && dailyVelocity > 0) {
        alerts.push(this.buildAlert(v, stock, dailyVelocity, 'warning'));
      }
    }

    const avgDailyVelocity = [...velocityMap.values()].reduce((a, b) => a + b, 0);
    const totalStock = variants.reduce((a, v) => a + (v.stock ?? 0), 0);
    const coverageDays = avgDailyVelocity > 0 ? Math.round(totalStock / avgDailyVelocity) : 999;

    // Emit critical alerts
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      this.events.emit('makito.inventory.critical', { alerts: criticalAlerts });
    }

    return {
      generatedAt: new Date().toISOString(),
      totalSkus: variants.length,
      inStock,
      outOfStock,
      lowStock,
      alerts: alerts.sort((a, b) => a.currentStock - b.currentStock).slice(0, 50),
      stockValue: Math.round(stockValue),
      coverageDays,
    };
  }

  /** Check stock before order confirmation */
  async checkOrderStock(lines: Array<{ sku: string; quantity: number }>): Promise<{
    available: boolean;
    issues: Array<{ sku: string; requested: number; available: number }>;
  }> {
    const issues: Array<{ sku: string; requested: number; available: number }> = [];

    for (const line of lines) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { sku: line.sku, product: { supplier: 'makito' } },
      });
      const available = variant?.stock ?? 0;
      if (available < line.quantity) {
        issues.push({ sku: line.sku, requested: line.quantity, available });
      }
    }

    return { available: issues.length === 0, issues };
  }

  /** Sync live stock from Makito API and update DB */
  async refreshLiveStock() {
    if (!this.makito.isEnabled()) return { updated: 0 };
    const stockItems = await this.makito.getLiveStock();
    let updated = 0;

    for (const item of stockItems) {
      const result = await this.prisma.productVariant.updateMany({
        where: { sku: item.sku, product: { supplier: 'makito' } },
        data: { stock: item.available },
      });
      updated += result.count;
    }

    this.logger.debug(`Makito live stock refreshed: ${updated} variants updated`);
    return { updated };
  }

  private buildAlert(
    variant: any,
    stock: number,
    dailyVelocity: number,
    severity: 'critical' | 'warning',
  ): MakitoInventoryAlert {
    const daysLeft = dailyVelocity > 0 ? Math.floor(stock / dailyVelocity) : 99;
    const action = daysLeft <= 3 ? 'reorder_now' : daysLeft <= 7 ? 'reorder_soon' : 'monitor';
    const volatility = dailyVelocity > 5 ? 'high' : dailyVelocity > 1 ? 'medium' : 'low';

    return {
      sku: variant.sku,
      productTitle: variant.product?.title ?? variant.sku,
      currentStock: stock,
      threshold: severity === 'critical' ? this.CRITICAL_THRESHOLD : this.LOW_STOCK_THRESHOLD,
      severity,
      message: `${stock} units remaining — approx ${daysLeft} days at current velocity`,
      trend: dailyVelocity > 0 ? 'declining' : 'stable',
      volatility,
      confidenceScore: Math.min(95, Math.round(70 + dailyVelocity * 2)),
      recommendedAction: action,
    };
  }
}
