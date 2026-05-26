import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class AccrualService implements OnModuleInit {
  private readonly logger = new Logger(AccrualService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // When order is paid: create deferred revenue (recognize on delivery)
    this.events.on('order.paid', async ({ orderId, totalAmount }: { orderId: string; totalAmount?: number }) => {
      try {
        if (orderId && totalAmount) {
          await this.createDeferredRevenue(orderId, Number(totalAmount));
        }
      } catch (err) {
        this.logger.error(`Accrual: deferred revenue failed for ${orderId}: ${err}`);
      }
    });

    // When order is delivered: recognize deferred revenue
    this.events.on('order.delivered', async ({ orderId }: { orderId: string }) => {
      try {
        if (orderId) await this.recognizeRevenue(orderId);
      } catch (err) {
        this.logger.error(`Accrual: revenue recognition failed for ${orderId}: ${err}`);
      }
    });

    // When order is cancelled: reverse deferred revenue
    this.events.on('order.cancelled', async ({ orderId }: { orderId: string }) => {
      try {
        if (orderId) await this.reverseDeferredRevenue(orderId);
      } catch (err) {
        this.logger.error(`Accrual: reversal failed for ${orderId}: ${err}`);
      }
    });
  }

  async createDeferredRevenue(orderId: string, amount: number, tenantId = 'default') {
    // Delivery date estimate: today + 7 days
    const recognitionDate = new Date();
    recognitionDate.setDate(recognitionDate.getDate() + 7);

    return this.prisma.accrualEntry.create({
      data: {
        tenantId,
        referenceType: 'order',
        referenceId: orderId,
        entryType: 'deferred_revenue',
        amount,
        recognitionDate,
        description: `Deferred revenue for order ${orderId}`,
      },
    });
  }

  async recognizeRevenue(orderId: string) {
    const deferred = await this.prisma.accrualEntry.findFirst({
      where: { referenceType: 'order', referenceId: orderId, entryType: 'deferred_revenue', recognizedAt: null },
    });
    if (!deferred) return null;

    return this.prisma.$transaction(async (tx) => {
      // Mark deferred entry as recognized
      await tx.accrualEntry.update({
        where: { id: deferred.id },
        data: { recognizedAt: new Date() },
      });
      // Create recognized_revenue entry
      return tx.accrualEntry.create({
        data: {
          tenantId: deferred.tenantId,
          referenceType: 'order',
          referenceId: orderId,
          entryType: 'recognized_revenue',
          amount: deferred.amount,
          recognizedAt: new Date(),
          description: `Revenue recognized for order ${orderId}`,
        },
      });
    });
  }

  async reverseDeferredRevenue(orderId: string) {
    return this.prisma.accrualEntry.updateMany({
      where: { referenceType: 'order', referenceId: orderId, entryType: 'deferred_revenue', recognizedAt: null },
      data: { settledAt: new Date(), description: `Reversed (cancelled): order ${orderId}` },
    });
  }

  async createAccruedExpense(params: {
    referenceType: string;
    referenceId: string;
    amount: number;
    description: string;
    tenantId?: string;
  }) {
    return this.prisma.accrualEntry.create({
      data: {
        tenantId: params.tenantId ?? 'default',
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        entryType: 'accrued_expense',
        amount: params.amount,
        description: params.description,
      },
    });
  }

  async settleExpense(entryId: string) {
    return this.prisma.accrualEntry.update({
      where: { id: entryId },
      data: { entryType: 'settled_expense', settledAt: new Date() },
    });
  }

  async getDeferredRevenueSummary(tenantId?: string) {
    const where = {
      entryType: 'deferred_revenue',
      recognizedAt: null,
      settledAt: null,
      ...(tenantId ? { tenantId } : {}),
    };

    const entries = await this.prisma.accrualEntry.findMany({ where });
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);
    return { count: entries.length, totalDeferred: total, entries };
  }

  async getAccruedExpensesSummary(tenantId?: string) {
    const where = {
      entryType: 'accrued_expense',
      settledAt: null,
      ...(tenantId ? { tenantId } : {}),
    };
    const entries = await this.prisma.accrualEntry.findMany({ where });
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);
    return { count: entries.length, totalAccrued: total };
  }

  async getRevenueRecognitionSchedule(from: Date, to: Date) {
    return this.prisma.accrualEntry.findMany({
      where: {
        entryType: 'deferred_revenue',
        recognitionDate: { gte: from, lte: to },
        recognizedAt: null,
      },
      orderBy: { recognitionDate: 'asc' },
    });
  }
}
