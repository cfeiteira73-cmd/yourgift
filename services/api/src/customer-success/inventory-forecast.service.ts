import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryForecastService {
  private readonly logger = new Logger(InventoryForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeForecast(productId: string, variantId?: string): Promise<void> {
    // Get current stock from ProductVariant
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, ...(variantId ? { id: variantId } : {}) },
    });
    const currentStock = variants.reduce((s, v) => s + (v.stock ?? 0), 0);

    // Calculate avg daily consumption from order items (last 90 days)
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        productId,
        ...(variantId ? { variantId } : {}),
        order: { createdAt: { gte: d90 }, status: { not: 'cancelled' } },
      },
    });
    const totalConsumed = orderItems.reduce((s, i) => s + i.quantity, 0);
    const avgDailyConsumption = totalConsumed / 90;

    // Forecast
    const daysUntilDepletion = avgDailyConsumption > 0
      ? Math.floor(currentStock / avgDailyConsumption)
      : null;
    const forecastedDemand30d = Math.ceil(avgDailyConsumption * 30);

    // Alert logic
    const isAlertActive = daysUntilDepletion !== null && daysUntilDepletion <= 30;
    const alertSeverity: string = !isAlertActive ? 'low'
      : daysUntilDepletion <= 3 ? 'critical'
      : daysUntilDepletion <= 7 ? 'high'
      : daysUntilDepletion <= 14 ? 'medium'
      : 'low';

    const reorderPoint = Math.ceil(avgDailyConsumption * 14); // 2-week buffer
    const reorderQuantity = Math.max(100, Math.ceil(avgDailyConsumption * 60)); // 60-day supply

    await this.prisma.inventoryForecast.upsert({
      where: { productId_variantId: { productId, variantId: (variantId ?? null) as string } },
      create: {
        productId,
        variantId: variantId ?? null,
        currentStock,
        avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
        daysUntilDepletion,
        reorderPoint,
        reorderQuantity,
        forecastedDemand30d,
        confidence: orderItems.length > 10 ? 0.85 : orderItems.length > 3 ? 0.65 : 0.40,
        isAlertActive,
        alertSeverity,
        lastComputedAt: new Date(),
      },
      update: {
        currentStock,
        avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
        daysUntilDepletion,
        reorderPoint,
        reorderQuantity,
        forecastedDemand30d,
        confidence: orderItems.length > 10 ? 0.85 : orderItems.length > 3 ? 0.65 : 0.40,
        isAlertActive,
        alertSeverity,
        lastComputedAt: new Date(),
      },
    });

    if (isAlertActive) {
      this.logger.warn(`Inventory alert: ${productId} has ${daysUntilDepletion} days until depletion (severity: ${alertSeverity})`);
    }
  }

  async refreshAllForecasts(): Promise<{ processed: number }> {
    const products = await this.prisma.product.findMany({ select: { id: true } });
    let processed = 0;
    for (const p of products) {
      try {
        await this.computeForecast(p.id);
        processed++;
      } catch (err) {
        this.logger.error(`Forecast failed for ${p.id}: ${err}`);
      }
    }
    return { processed };
  }

  async getActiveAlerts() {
    return this.prisma.inventoryForecast.findMany({
      where: { isAlertActive: true },
      orderBy: [{ alertSeverity: 'asc' }, { daysUntilDepletion: 'asc' }],
    });
  }

  async getDepletionSummary() {
    const [critical, high, medium, low, total] = await Promise.all([
      this.prisma.inventoryForecast.count({ where: { alertSeverity: 'critical', isAlertActive: true } }),
      this.prisma.inventoryForecast.count({ where: { alertSeverity: 'high', isAlertActive: true } }),
      this.prisma.inventoryForecast.count({ where: { alertSeverity: 'medium', isAlertActive: true } }),
      this.prisma.inventoryForecast.count({ where: { alertSeverity: 'low', isAlertActive: true } }),
      this.prisma.inventoryForecast.count(),
    ]);
    return { critical, high, medium, low, total, healthyCount: total - critical - high - medium - low };
  }
}
