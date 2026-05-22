import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// Platform overhead rate: 8% of order value
const PLATFORM_RATE = 0.08;
// Fulfillment rate: 12% of order value
const FULFILLMENT_RATE = 0.12;

@Injectable()
export class CostAllocationService implements OnModuleInit {
  private readonly logger = new Logger(CostAllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    this.events.on('order.paid', async ({ orderId, totalAmount, tenantId }: { orderId: string; totalAmount?: number; tenantId?: string }) => {
      try {
        if (orderId && totalAmount) {
          await this.allocateOrderCosts(orderId, Number(totalAmount), tenantId ?? 'default');
        }
      } catch (err) {
        this.logger.error(`CostAllocation: failed for order ${orderId}: ${err}`);
      }
    });
  }

  async allocateOrderCosts(orderId: string, orderValue: number, tenantId: string) {
    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    await this.prisma.$transaction([
      // Platform cost allocation
      this.prisma.costAllocation.create({
        data: {
          tenantId,
          orderId,
          costType: 'platform',
          department: 'tech',
          baseAmount: orderValue,
          allocatedAmount: orderValue * PLATFORM_RATE,
          allocationRate: PLATFORM_RATE,
          periodStart,
          periodEnd,
          metadata: { source: 'order.paid' } as object,
        },
      }),
      // Fulfillment cost allocation
      this.prisma.costAllocation.create({
        data: {
          tenantId,
          orderId,
          costType: 'fulfillment',
          department: 'operations',
          baseAmount: orderValue,
          allocatedAmount: orderValue * FULFILLMENT_RATE,
          allocationRate: FULFILLMENT_RATE,
          periodStart,
          periodEnd,
          metadata: { source: 'order.paid' } as object,
        },
      }),
    ]);

    this.logger.debug(`Cost allocated for order ${orderId}: platform=${(orderValue * PLATFORM_RATE).toFixed(2)}, fulfillment=${(orderValue * FULFILLMENT_RATE).toFixed(2)}`);
  }

  async getTenantCostSummary(tenantId: string, periodStart: Date, periodEnd: Date) {
    const allocations = await this.prisma.costAllocation.findMany({
      where: { tenantId, periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
    });

    const byType: Record<string, number> = {};
    let total = 0;
    for (const a of allocations) {
      const amount = Number(a.allocatedAmount);
      byType[a.costType] = (byType[a.costType] ?? 0) + amount;
      total += amount;
    }

    return { tenantId, total, byType, allocationCount: allocations.length };
  }

  async getDepartmentCostSummary(periodStart: Date, periodEnd: Date) {
    const allocations = await this.prisma.costAllocation.findMany({
      where: { periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
    });

    const byDept: Record<string, number> = {};
    for (const a of allocations) {
      const dept = a.department ?? 'unallocated';
      byDept[dept] = (byDept[dept] ?? 0) + Number(a.allocatedAmount);
    }

    return { byDept, total: Object.values(byDept).reduce((s, v) => s + v, 0) };
  }

  async getPlatformCostOverhead(months = 3) {
    const from = new Date();
    from.setMonth(from.getMonth() - months);

    const result = await this.prisma.costAllocation.aggregate({
      where: { costType: 'platform', periodStart: { gte: from } },
      _sum: { allocatedAmount: true },
      _avg: { allocatedAmount: true },
      _count: { id: true },
    });

    return {
      totalPlatformCost: Number(result._sum.allocatedAmount ?? 0),
      avgPerOrder: Number(result._avg.allocatedAmount ?? 0),
      orderCount: result._count.id,
    };
  }
}
