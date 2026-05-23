import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface OnboardingDataInput {
  tenantId: string;
  supplierList?: Array<{ name: string; code: string; annualSpendEur?: number }>;
  orderHistory?: Array<{ date: string; supplierCode: string; amountEur: number; category?: string; deliveryDays?: number }>;
  invoiceData?: Array<{ date: string; supplierCode: string; invoicedEur: number; paidEur: number }>;
}

export interface Inefficiency {
  type: string;
  description: string;
  estimatedWasteEur: number;
  severity: 'high' | 'medium' | 'low';
  supplierCode?: string;
  category?: string;
}

export interface SavingsOpportunity {
  title: string;
  description: string;
  potentialSavingEur: number;
  confidencePct: number;
  effort: 'immediate' | 'short_term' | 'long_term';
  action: string;
}

@Injectable()
export class OnboardingService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async createSession(tenantId: string): Promise<any> {
    const tenantHash = createHash('sha256').update(tenantId + 'onboard-2026').digest('hex').slice(0, 16);
    return this.db.onboardingSession.create({
      data: {
        tenantHash,
        status: 'pending',
      },
    });
  }

  async analyzeData(sessionId: string, input: OnboardingDataInput): Promise<any> {
    await this.db.onboardingSession.update({ where: { id: sessionId }, data: { status: 'analyzing' } });

    const orders = input.orderHistory ?? [];
    const suppliers = input.supplierList ?? [];

    // Detect inefficiencies
    const inefficiencies: Inefficiency[] = [];

    // 1. Supplier concentration risk
    const supplierSpend = new Map<string, number>();
    for (const o of orders) {
      supplierSpend.set(o.supplierCode, (supplierSpend.get(o.supplierCode) ?? 0) + o.amountEur);
    }
    const totalSpend = Array.from(supplierSpend.values()).reduce((s, v) => s + v, 0);
    for (const [code, spend] of supplierSpend.entries()) {
      const pct = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
      if (pct > 60) {
        inefficiencies.push({
          type: 'supplier_concentration',
          description: `${code} represents ${pct.toFixed(0)}% of total spend — single-supplier dependency risk`,
          estimatedWasteEur: Math.round(spend * 0.08),
          severity: 'high',
          supplierCode: code,
        });
      }
    }

    // 2. Late delivery patterns
    const lateOrders = orders.filter((o) => (o.deliveryDays ?? 0) > 14);
    if (lateOrders.length > orders.length * 0.2) {
      const lateSpend = lateOrders.reduce((s, o) => s + o.amountEur, 0);
      inefficiencies.push({
        type: 'delivery_delays',
        description: `${lateOrders.length} orders (${((lateOrders.length / orders.length) * 100).toFixed(0)}%) experienced delays > 14 days`,
        estimatedWasteEur: Math.round(lateSpend * 0.03),
        severity: 'medium',
      });
    }

    // 3. Invoice discrepancies
    const invoices = input.invoiceData ?? [];
    const discrepancies = invoices.filter((i) => Math.abs(i.invoicedEur - i.paidEur) > 50);
    if (discrepancies.length > 0) {
      const discrepancyValue = discrepancies.reduce((s, i) => s + Math.abs(i.invoicedEur - i.paidEur), 0);
      inefficiencies.push({
        type: 'invoice_discrepancies',
        description: `${discrepancies.length} invoices with payment discrepancies totalling €${discrepancyValue.toFixed(0)}`,
        estimatedWasteEur: Math.round(discrepancyValue),
        severity: discrepancyValue > 5000 ? 'high' : 'medium',
      });
    }

    // 4. No routing optimization (always same supplier per category)
    const categorySupplierMap = new Map<string, Set<string>>();
    for (const o of orders) {
      const cat = o.category ?? 'general';
      if (!categorySupplierMap.has(cat)) categorySupplierMap.set(cat, new Set());
      categorySupplierMap.get(cat)!.add(o.supplierCode);
    }
    for (const [cat, supSet] of categorySupplierMap.entries()) {
      if (supSet.size === 1 && orders.filter((o) => o.category === cat).length > 5) {
        const catSpend = orders.filter((o) => o.category === cat).reduce((s, o) => s + o.amountEur, 0);
        inefficiencies.push({
          type: 'no_supplier_rotation',
          description: `${cat}: always using same supplier with no competitive comparison`,
          estimatedWasteEur: Math.round(catSpend * 0.06),
          severity: 'medium',
          category: cat,
        });
      }
    }

    // Generate savings opportunities
    const opportunities: SavingsOpportunity[] = [
      {
        title: 'Enable Autonomous Routing for Low-Risk Orders',
        description: 'Auto-route orders under €5,000 to optimal supplier based on global reliability scores',
        potentialSavingEur: Math.round(totalSpend * 0.04),
        confidencePct: 87,
        effort: 'immediate',
        action: 'Set execution policy maxAutoExecuteRiskScore=35',
      },
      {
        title: 'Activate Margin Protection Engine',
        description: 'Block orders where system detects margin below 12% floor — prevent margin erosion',
        potentialSavingEur: Math.round(totalSpend * 0.025),
        confidencePct: 94,
        effort: 'immediate',
        action: 'Enable margin_floor_pct=12 in financial policy',
      },
      {
        title: 'Multi-Supplier Routing for Top Categories',
        description: 'Introduce competitive routing across verified suppliers to reduce concentration risk',
        potentialSavingEur: Math.round(totalSpend * 0.06),
        confidencePct: 76,
        effort: 'short_term',
        action: 'Configure supplier routing matrix for each category',
      },
      {
        title: 'Shipping Route Optimization',
        description: 'Switch 40% of EU shipments to lower-cost carrier based on global route intelligence',
        potentialSavingEur: Math.round(totalSpend * 0.02),
        confidencePct: 82,
        effort: 'immediate',
        action: 'Use DHL/DPD for intra-EU routes via logistics engine',
      },
    ];

    // Supplier risk report
    const supplierRiskReport: Record<string, object> = {};
    for (const [code, spend] of supplierSpend.entries()) {
      const pct = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
      const supplierOrders = orders.filter((o) => o.supplierCode === code);
      const avgDelivery = supplierOrders.length > 0
        ? supplierOrders.reduce((s, o) => s + (o.deliveryDays ?? 7), 0) / supplierOrders.length
        : 7;
      supplierRiskReport[code] = {
        spendEur: Math.round(spend),
        spendPct: Math.round(pct * 10) / 10,
        orderCount: supplierOrders.length,
        avgDeliveryDays: Math.round(avgDelivery * 10) / 10,
        riskLevel: pct > 60 ? 'high' : pct > 40 ? 'medium' : 'low',
      };
    }

    const totalSavingsPotential = opportunities.reduce((s, o) => s + o.potentialSavingEur, 0);
    const rawDataSummary = {
      supplierCount: suppliers.length || supplierSpend.size,
      orderCount: orders.length,
      invoiceCount: invoices.length,
      totalSpendEur: Math.round(totalSpend),
      dateRange: orders.length > 0 ? {
        from: orders.reduce((m, o) => o.date < m ? o.date : m, orders[0].date),
        to: orders.reduce((m, o) => o.date > m ? o.date : m, orders[0].date),
      } : null,
    };

    return this.db.onboardingSession.update({
      where: { id: sessionId },
      data: {
        status: 'complete',
        rawDataSummary: rawDataSummary as unknown as object,
        inefficiencies: inefficiencies as unknown as object,
        savingsOpportunities: opportunities as unknown as object,
        supplierRiskReport: supplierRiskReport as unknown as object,
        totalSavingsPotentialEur: totalSavingsPotential,
        completedAt: new Date(),
      },
    });
  }

  async getSession(sessionId: string): Promise<any | null> {
    return this.db.onboardingSession.findUnique({ where: { id: sessionId } });
  }

  async listSessions(tenantId?: string): Promise<any[]> {
    const tenantHash = tenantId
      ? createHash('sha256').update(tenantId + 'onboard-2026').digest('hex').slice(0, 16)
      : undefined;
    return this.db.onboardingSession.findMany({
      where: tenantHash ? { tenantHash } : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
