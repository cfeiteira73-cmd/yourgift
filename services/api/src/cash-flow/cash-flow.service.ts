import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkingCapitalSummary {
  totalPayablesEur: number;
  overduePayablesEur: number;
  pendingInvoiceCount: number;
  overdueInvoiceCount: number;
  avgDaysPayableOutstanding: number;
  cashConversionCycleDays: number;
  liquidityRiskScore: number;
  workingCapitalAtRiskEur: number;
  thirtyDayForecastEur: number;
  sixtyDayForecastEur: number;
  ninetyDayForecastEur: number;
  riskLevel: 'low' | 'medium' | 'high';
  cashFlowTimeline: Array<{ date: string; outflow: number; inflow: number; net: number }>;
}

interface InvoiceRecord {
  status: string;
  amountEur: unknown;
  paidAmountEur: unknown;
  dueDate: unknown;
  invoiceDate: unknown;
}

@Injectable()
export class CashFlowService {
  private get db(): any { return this.prisma; } // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(private readonly prisma: PrismaService) {}

  async getWorkingCapitalSummary(tenantId = 'default'): Promise<WorkingCapitalSummary> {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [invoices, snapshot] = await Promise.all([
      this.db.cashFlowInvoice.findMany({
        where: { tenantId, status: { in: ['pending', 'overdue'] } },
        orderBy: { dueDate: 'asc' },
      }) as Promise<InvoiceRecord[]>,
      this.db.workingCapitalSnapshot.findFirst({
        where: { tenantId },
        orderBy: { snapshotAt: 'desc' },
      }),
    ]);

    const pending = invoices.filter((i) => i.status === 'pending');
    const overdue = invoices.filter((i) => i.status === 'overdue');

    const totalPayables = invoices.reduce(
      (s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur),
      0,
    );
    const overduePayables = overdue.reduce(
      (s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur),
      0,
    );

    const thirtyForecast = invoices
      .filter((i) => new Date(i.dueDate as string) <= thirtyDays)
      .reduce((s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur), 0);

    const sixtyForecast = invoices
      .filter((i) => new Date(i.dueDate as string) <= sixtyDays)
      .reduce((s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur), 0);

    const ninetyForecast = invoices
      .filter((i) => new Date(i.dueDate as string) <= ninetyDays)
      .reduce((s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur), 0);

    // Liquidity risk: 0–100 based on overdue ratio + days outstanding
    const overdueRatio = totalPayables > 0 ? overduePayables / totalPayables : 0;
    const avgDPO: number = snapshot ? Number(snapshot.avgDaysPayableOutstanding) : 30;
    const liquidityRisk = Math.min(
      100,
      Math.round(
        overdueRatio * 60 +
        (avgDPO > 45 ? 20 : avgDPO > 30 ? 10 : 0) +
        (overdue.length > 3 ? 20 : overdue.length > 1 ? 10 : 0),
      ),
    );

    const riskLevel: 'low' | 'medium' | 'high' =
      liquidityRisk >= 60 ? 'high' : liquidityRisk >= 30 ? 'medium' : 'low';

    // Build 8-week cash flow timeline
    const cashFlowTimeline: Array<{ date: string; outflow: number; inflow: number; net: number }> = [];
    for (let week = 0; week < 8; week++) {
      const weekStart = new Date(now.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() + (week + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekOutflow = invoices
        .filter((i) => {
          const d = new Date(i.dueDate as string);
          return d >= weekStart && d < weekEnd;
        })
        .reduce((s, i) => s + Number(i.amountEur) - Number(i.paidAmountEur), 0);

      cashFlowTimeline.push({
        date: weekStart.toISOString().slice(0, 10),
        outflow: Math.round(weekOutflow),
        inflow: 0,
        net: -Math.round(weekOutflow),
      });
    }

    return {
      totalPayablesEur: Math.round(totalPayables),
      overduePayablesEur: Math.round(overduePayables),
      pendingInvoiceCount: pending.length,
      overdueInvoiceCount: overdue.length,
      avgDaysPayableOutstanding: avgDPO,
      cashConversionCycleDays: snapshot ? Number(snapshot.cashConversionCycleDays) : 34,
      liquidityRiskScore: liquidityRisk,
      workingCapitalAtRiskEur: Math.round(overduePayables),
      thirtyDayForecastEur: Math.round(thirtyForecast),
      sixtyDayForecastEur: Math.round(sixtyForecast),
      ninetyDayForecastEur: Math.round(ninetyForecast),
      riskLevel,
      cashFlowTimeline,
    };
  }

  async getInvoices(tenantId = 'default', status?: string): Promise<unknown[]> {
    return this.db.cashFlowInvoice.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });
  }

  async recordInvoice(params: {
    tenantId?: string;
    orderId?: string;
    supplierName?: string;
    invoiceRef: string;
    invoiceDate: Date;
    dueDate: Date;
    amountEur: number;
    category?: string;
    orderDate?: Date;
    notes?: string;
  }): Promise<unknown> {
    return this.db.cashFlowInvoice.create({
      data: {
        tenantId: params.tenantId ?? 'default',
        orderId: params.orderId ?? null,
        supplierName: params.supplierName ?? null,
        invoiceRef: params.invoiceRef,
        invoiceDate: params.invoiceDate,
        dueDate: params.dueDate,
        amountEur: params.amountEur,
        category: params.category ?? null,
        orderDate: params.orderDate ?? null,
        notes: params.notes ?? null,
        status: 'pending',
      },
    });
  }

  async markPaid(invoiceId: string, paidAmountEur?: number): Promise<unknown> {
    const inv = await this.db.cashFlowInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error('Invoice not found');

    const paid = paidAmountEur ?? Number(inv.amountEur);
    const dpo =
      inv.dueDate && inv.invoiceDate
        ? Math.ceil(
            (new Date(inv.dueDate as string).getTime() - new Date(inv.invoiceDate as string).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

    return this.db.cashFlowInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidDate: new Date(),
        paidAmountEur: paid,
        daysPayableOutstanding: dpo,
      },
    });
  }
}
