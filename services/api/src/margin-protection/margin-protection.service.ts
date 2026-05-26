import { Injectable } from '@nestjs/common';
import {
  MarginRule,
  MarginAlert,
  CostSnapshot,
  ProfitabilitySimulation,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface MarginCheckResult {
  isViable: boolean;
  actualMarginPct: number;
  action: 'pass' | 'warn' | 'block' | 'flag';
  triggeredRules: Array<{
    ruleName: string;
    floor: number;
    threshold: number;
    action: string;
  }>;
  alertId?: string;
}

export interface PLSimulation {
  grossRevenue: number;
  productCost: number;
  shippingCost: number;
  printCost: number;
  platformFee: number;
  fulfillmentFee: number;
  totalCost: number;
  grossMargin: number;
  grossMarginPct: number;
  netMargin: number;
  netMarginPct: number;
  isViable: boolean;
  riskLevel: 'safe' | 'warning' | 'critical';
}

const ACTION_RANK: Record<'pass' | 'warn' | 'flag' | 'block', number> = {
  pass: 0,
  warn: 1,
  flag: 2,
  block: 3,
};

function stricterAction(
  a: 'pass' | 'warn' | 'block' | 'flag',
  b: 'pass' | 'warn' | 'block' | 'flag',
): 'pass' | 'warn' | 'block' | 'flag' {
  return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}

@Injectable()
export class MarginProtectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async checkMargin(params: {
    referenceId: string;
    referenceType: string;
    salePrice: number;
    totalCost: number;
    supplierName?: string;
    category?: string;
    tenantId?: string;
  }): Promise<MarginCheckResult> {
    const {
      referenceId,
      referenceType,
      salePrice,
      totalCost,
      supplierName,
      category,
      tenantId = 'default',
    } = params;

    const allRules = await this.prisma.marginRule.findMany({
      where: { isActive: true },
    });

    // Filter applicable rules
    const applicableRules = allRules.filter((rule) => {
      if (rule.scope === 'global') return true;
      if (rule.scope === 'supplier' && supplierName && rule.scopeValue === supplierName) return true;
      if (rule.scope === 'category' && category && rule.scopeValue === category) return true;
      if (rule.scope === 'tenant' && rule.scopeValue === tenantId) return true;
      return false;
    });

    const actualMarginPct =
      salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0;

    const triggeredRules: MarginCheckResult['triggeredRules'] = [];
    let worstAction: 'pass' | 'warn' | 'block' | 'flag' = 'pass';
    let worstRuleId: string | undefined;
    let worstSeverity: 'info' | 'warning' | 'critical' = 'info';

    for (const rule of applicableRules) {
      const minMargin = Number(rule.minMarginPct);
      const warnThreshold = Number(rule.warningThresholdPct);

      if (actualMarginPct < minMargin) {
        // Below hard floor
        const ruleAction = rule.action as 'warn' | 'block' | 'flag';

        triggeredRules.push({
          ruleName: rule.name,
          floor: minMargin,
          threshold: warnThreshold,
          action: ruleAction,
        });

        const prevAction = worstAction;
        worstAction = stricterAction(worstAction, ruleAction);
        if (ACTION_RANK[ruleAction] >= ACTION_RANK[prevAction]) {
          worstRuleId = rule.id;
        }
        worstSeverity = 'critical';
      } else if (actualMarginPct < warnThreshold) {
        // Below warning threshold but above floor
        triggeredRules.push({
          ruleName: rule.name,
          floor: minMargin,
          threshold: warnThreshold,
          action: 'warn',
        });

        worstAction = stricterAction(worstAction, 'warn');
        if (worstSeverity !== 'critical') {
          worstSeverity = 'warning';
          worstRuleId = rule.id;
        }
      }
    }

    let alertId: string | undefined;

    if (triggeredRules.length > 0) {
      // Determine action taken label
      const actionTaken =
        worstAction === 'block'
          ? 'blocked'
          : worstAction === 'flag'
            ? 'flagged'
            : 'warned';

      const minMarginRule =
        applicableRules.find((r) => r.id === worstRuleId) ?? applicableRules[0];
      const expectedMarginPct = minMarginRule
        ? Number(minMarginRule.minMarginPct)
        : 0;

      const alert = await this.prisma.marginAlert.create({
        data: {
          ruleId: worstRuleId ?? null,
          referenceId,
          referenceType,
          tenantId,
          supplierName: supplierName ?? null,
          category: category ?? null,
          salePrice,
          totalCost,
          expectedMarginPct,
          actualMarginPct,
          marginGapPct: Math.max(0, expectedMarginPct - actualMarginPct),
          severity: worstSeverity,
          actionTaken,
          isResolved: false,
        },
      });

      alertId = alert.id;

      if (worstSeverity === 'critical') {
        this.events.emit('margin.alert.triggered', {
          alertId: alert.id,
          referenceId,
          referenceType,
          actualMarginPct,
          supplierName,
          tenantId,
        });
      }
    }

    return {
      isViable: worstAction !== 'block',
      actualMarginPct,
      action: worstAction,
      triggeredRules,
      alertId,
    };
  }

  simulatePL(params: {
    salePrice: number;
    productCost: number;
    shippingCost?: number;
    printCost?: number;
    platformFeePct?: number;
    fulfillmentPct?: number;
    quantity?: number;
  }): PLSimulation {
    const {
      salePrice,
      productCost,
      shippingCost = 0,
      printCost = 0,
      platformFeePct = 8,
      fulfillmentPct = 12,
      quantity = 1,
    } = params;

    const grossRevenue = salePrice * quantity;
    const platformFee = (grossRevenue * platformFeePct) / 100;
    const fulfillmentFee = (grossRevenue * fulfillmentPct) / 100;
    const variableCostPerUnit = productCost + shippingCost + printCost;
    const totalCost = variableCostPerUnit * quantity + platformFee + fulfillmentFee;
    const grossMargin = grossRevenue - variableCostPerUnit * quantity;
    const grossMarginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
    const netMargin = grossRevenue - totalCost;
    const netMarginPct = grossRevenue > 0 ? (netMargin / grossRevenue) * 100 : 0;

    const riskLevel: 'safe' | 'warning' | 'critical' =
      netMarginPct < 10 ? 'critical' : netMarginPct < 18 ? 'warning' : 'safe';

    return {
      grossRevenue,
      productCost,
      shippingCost,
      printCost,
      platformFee,
      fulfillmentFee,
      totalCost,
      grossMargin,
      grossMarginPct,
      netMargin,
      netMarginPct,
      isViable: netMarginPct >= 8,
      riskLevel,
    };
  }

  async saveSimulation(
    params: {
      name?: string;
      tenantId?: string;
      salePrice: number;
      productCost: number;
      shippingCost: number;
      printCost: number;
      platformFeePct: number;
      fulfillmentPct: number;
      quantity: number;
      currency?: string;
    } & PLSimulation,
  ): Promise<ProfitabilitySimulation> {
    const { name, tenantId = 'default', currency = 'EUR', ...rest } = params;

    return this.prisma.profitabilitySimulation.create({
      data: {
        tenantId,
        name: name ?? null,
        salePrice: rest.salePrice,
        productCost: rest.productCost,
        shippingCost: rest.shippingCost,
        printCost: rest.printCost,
        platformFeePct: rest.platformFeePct,
        fulfillmentPct: rest.fulfillmentPct,
        quantity: rest.quantity,
        currency,
        grossRevenue: rest.grossRevenue,
        totalCost: rest.totalCost,
        grossMargin: rest.grossMargin,
        grossMarginPct: rest.grossMarginPct,
        platformFee: rest.platformFee,
        fulfillmentFee: rest.fulfillmentFee,
        netMargin: rest.netMargin,
        netMarginPct: rest.netMarginPct,
        isViable: rest.isViable,
        riskLevel: rest.riskLevel,
      },
    });
  }

  async detectCostDrift(supplierName: string): Promise<
    Array<{
      category: string;
      currentCost: number;
      previousCost: number;
      changePct: number;
      driftSeverity: 'stable' | 'drift' | 'spike';
    }>
  > {
    // Get last 2 snapshots per category for this supplier
    const snapshots = await this.prisma.costSnapshot.findMany({
      where: { supplierName },
      orderBy: { snapshotDate: 'desc' },
    });

    // Group by category+productRef
    const grouped = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      const key = `${snap.category}||${snap.productRef ?? ''}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(snap);
    }

    const results: Array<{
      category: string;
      currentCost: number;
      previousCost: number;
      changePct: number;
      driftSeverity: 'stable' | 'drift' | 'spike';
    }> = [];

    for (const [, items] of grouped) {
      if (items.length < 2) continue;
      const current = items[0];
      const previous = items[1];
      const currentCost = Number(current.unitCost);
      const previousCost = Number(previous.unitCost);
      const changePct =
        previousCost > 0
          ? ((currentCost - previousCost) / previousCost) * 100
          : 0;
      const absChange = Math.abs(changePct);
      const driftSeverity: 'stable' | 'drift' | 'spike' =
        absChange < 5 ? 'stable' : absChange < 15 ? 'drift' : 'spike';

      results.push({
        category: current.category,
        currentCost,
        previousCost,
        changePct,
        driftSeverity,
      });
    }

    return results;
  }

  async recordCostSnapshot(params: {
    supplierName: string;
    category: string;
    productRef?: string;
    unitCost: number;
    currency?: string;
    source?: string;
    notes?: string;
  }): Promise<CostSnapshot> {
    const {
      supplierName,
      category,
      productRef,
      unitCost,
      currency = 'EUR',
      source = 'manual',
      notes,
    } = params;

    // Find prior snapshot for change pct
    const prior = await this.prisma.costSnapshot.findFirst({
      where: {
        supplierName,
        category,
        productRef: (productRef ?? null) as string,
      },
      orderBy: { snapshotDate: 'desc' },
    });

    const changePctVsPrior =
      prior && Number(prior.unitCost) > 0
        ? ((unitCost - Number(prior.unitCost)) / Number(prior.unitCost)) * 100
        : null;

    return this.prisma.costSnapshot.create({
      data: {
        supplierName,
        category,
        productRef: (productRef ?? null) as string,
        unitCost,
        currency,
        snapshotDate: new Date(),
        source,
        changePctVsPrior: changePctVsPrior !== null ? changePctVsPrior : undefined,
        notes: notes ?? null,
      },
    });
  }

  async getActiveAlerts(tenantId?: string): Promise<MarginAlert[]> {
    const results = await this.prisma.marginAlert.findMany({
      where: {
        isResolved: false,
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return results;
  }

  async resolveAlert(alertId: string, note?: string): Promise<void> {
    await this.prisma.marginAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolutionNote: note ?? null,
        resolvedAt: new Date(),
      },
    });
  }

  async getRules(): Promise<MarginRule[]> {
    return this.prisma.marginRule.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertRule(params: {
    id?: string;
    name: string;
    scope: string;
    scopeValue?: string;
    minMarginPct: number;
    warningThresholdPct: number;
    action: string;
    tenantId?: string;
  }): Promise<MarginRule> {
    const {
      id,
      name,
      scope,
      scopeValue,
      minMarginPct,
      warningThresholdPct,
      action,
      tenantId = 'default',
    } = params;

    if (id) {
      return this.prisma.marginRule.update({
        where: { id },
        data: {
          name,
          scope,
          scopeValue: (scopeValue ?? null) as string,
          minMarginPct,
          warningThresholdPct,
          action,
          tenantId,
        },
      });
    }

    return this.prisma.marginRule.create({
      data: {
        name,
        scope,
        scopeValue: (scopeValue ?? null) as string,
        minMarginPct,
        warningThresholdPct,
        action,
        tenantId,
      },
    });
  }

  async getCostHistory(
    supplierName?: string,
    limit = 50,
  ): Promise<CostSnapshot[]> {
    return this.prisma.costSnapshot.findMany({
      where: supplierName ? { supplierName } : undefined,
      orderBy: { snapshotDate: 'desc' },
      take: limit,
    });
  }

  async getHealthSummary(): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    avgMarginPct: number;
    riskOrders: number;
    bySupplier: Array<{
      supplier: string;
      alertCount: number;
      avgMarginPct: number;
    }>;
  }> {
    const [totalAlerts, criticalAlerts, recentAlerts] =
      await Promise.all([
        this.prisma.marginAlert.count({ where: { isResolved: false } }),
        this.prisma.marginAlert.count({
          where: { isResolved: false, severity: 'critical' },
        }),
        this.prisma.marginAlert.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: { supplierName: true, actualMarginPct: true },
        }),
      ]);
    const riskOrders = criticalAlerts;

    const avgMarginPct =
      recentAlerts.length > 0
        ? recentAlerts.reduce((sum, a) => sum + Number(a.actualMarginPct), 0) /
          recentAlerts.length
        : 0;

    // Group by supplier
    const supplierMap = new Map<
      string,
      { count: number; totalMargin: number }
    >();
    for (const alert of recentAlerts) {
      const key = alert.supplierName ?? 'unknown';
      const existing = supplierMap.get(key) ?? { count: 0, totalMargin: 0 };
      supplierMap.set(key, {
        count: existing.count + 1,
        totalMargin: existing.totalMargin + Number(alert.actualMarginPct),
      });
    }

    const bySupplier = Array.from(supplierMap.entries()).map(([supplier, data]) => ({
      supplier,
      alertCount: data.count,
      avgMarginPct: data.count > 0 ? data.totalMargin / data.count : 0,
    }));

    return {
      totalAlerts,
      criticalAlerts,
      avgMarginPct,
      riskOrders,
      bySupplier,
    };
  }
}
