import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface LearningEventParams {
  tenantId: string;
  eventType: 'order_completed' | 'delivery_failed' | 'margin_achieved' | 'approval_override' | 'delay_event' | 'cost_spike';
  supplierCode?: string;
  routeKey?: string;        // "DE->FR"
  category?: string;
  outcome: 'success' | 'failure' | 'partial';
  marginImpactPct?: number;
  deliveryVarianceDays?: number;
  costVariancePct?: number;
  region?: string;
}

@Injectable()
export class NetworkLearningService implements OnModuleInit {
  private get db(): any { return this.prisma; }

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    // Listen to order completion events to trigger learning
    this.eventBus.on('order.completed', async (payload: any) => {
      try {
        await this.recordLearningEvent({
          tenantId: payload.tenantId ?? 'unknown',
          eventType: 'order_completed',
          supplierCode: payload.supplierCode,
          routeKey: payload.routeKey,
          category: payload.category,
          outcome: 'success',
          marginImpactPct: payload.marginPct,
          region: payload.region,
        });
      } catch { }
    });

    this.eventBus.on('margin.alert.triggered', async (payload: any) => {
      try {
        await this.recordLearningEvent({
          tenantId: payload.tenantId ?? 'unknown',
          eventType: 'cost_spike',
          supplierCode: payload.supplierCode,
          category: payload.category,
          outcome: 'partial',
          marginImpactPct: payload.marginPct,
          costVariancePct: payload.driftPct,
          region: payload.region,
        });
      } catch { }
    });
  }

  hashTenant(tenantId: string): string {
    return createHash('sha256').update(tenantId + 'din-salt-2026').digest('hex').slice(0, 16);
  }

  async recordLearningEvent(params: LearningEventParams): Promise<void> {
    const tenantHash = this.hashTenant(params.tenantId);

    const event = await this.db.networkLearningEvent.create({
      data: {
        tenantHash,
        eventType: params.eventType,
        supplierCode: params.supplierCode ?? null,
        routeKey: params.routeKey ?? null,
        category: params.category ?? null,
        outcome: params.outcome,
        marginImpactPct: params.marginImpactPct ?? null,
        deliveryVarianceDays: params.deliveryVarianceDays ?? null,
        costVariancePct: params.costVariancePct ?? null,
        region: params.region ?? null,
      },
    });

    // Async update aggregates (fire and forget)
    this.processLearningEvent(event).catch(() => {});
  }

  private async processLearningEvent(event: any): Promise<void> {
    // Update supplier global score if applicable
    if (event.supplierCode) {
      await this.updateSupplierScore(event.supplierCode, event);
    }
    // Update route intelligence if applicable
    if (event.routeKey) {
      await this.updateRouteIntelligence(event.routeKey, event);
    }
    // Update category intelligence if applicable
    if (event.category && event.region) {
      await this.updateCategoryIntelligence(event.category, event.region, event);
    }
  }

  private async updateSupplierScore(supplierCode: string, event: any): Promise<void> {
    const existing = await this.db.supplierGlobalScore.findUnique({ where: { supplierCode } });
    if (!existing) return;

    const isFailure = event.outcome === 'failure';
    const totalEvents = existing.totalEvents + 1;
    const currentFailureRate = Number(existing.failureProbabilityPct);
    const newFailureRate = isFailure
      ? Math.min(99, (currentFailureRate * (totalEvents - 1) + 100) / totalEvents)
      : Math.max(0, (currentFailureRate * (totalEvents - 1)) / totalEvents);

    const currentMargin = Number(existing.avgMarginContributionPct);
    const newMargin = event.marginImpactPct != null
      ? (currentMargin * (totalEvents - 1) + event.marginImpactPct) / totalEvents
      : currentMargin;

    // Reliability = 100 - failureProbability, smoothed
    const newReliability = Math.min(100, Math.max(0, 100 - newFailureRate));

    await this.db.supplierGlobalScore.update({
      where: { supplierCode },
      data: {
        globalReliabilityScore: Math.round(newReliability * 100) / 100,
        failureProbabilityPct: Math.round(newFailureRate * 100) / 100,
        avgMarginContributionPct: Math.round(newMargin * 10000) / 10000,
        totalEvents,
        lastUpdatedAt: new Date(),
      },
    });
  }

  private async updateRouteIntelligence(routeKey: string, event: any): Promise<void> {
    const parts = routeKey.split('->');
    if (parts.length !== 3) return; // expect "DE->FR->dhl"
    const [originCountry, destinationCountry, carrierCode] = parts;

    const existing = await this.db.routeIntelligence.findFirst({
      where: { originCountry, destinationCountry, carrierCode },
    });
    if (!existing) return;

    const totalShipments = existing.totalShipments + 1;
    const isOnTime = event.deliveryVarianceDays != null ? event.deliveryVarianceDays <= 0 : true;
    const currentOTD = Number(existing.onTimeDeliveryRatePct);
    const newOTD = (currentOTD * (totalShipments - 1) + (isOnTime ? 100 : 0)) / totalShipments;

    const currentVariance = Number(existing.transitVarianceDays);
    const newVariance = event.deliveryVarianceDays != null
      ? (currentVariance * (totalShipments - 1) + Math.abs(event.deliveryVarianceDays)) / totalShipments
      : currentVariance;

    const currentVolatility = Number(existing.costVolatilityPct);
    const newVolatility = event.costVariancePct != null
      ? (currentVolatility * (totalShipments - 1) + Math.abs(event.costVariancePct)) / totalShipments
      : currentVolatility;

    await this.db.routeIntelligence.update({
      where: { id: existing.id },
      data: {
        onTimeDeliveryRatePct: Math.round(newOTD * 100) / 100,
        transitVarianceDays: Math.round(newVariance * 100) / 100,
        costVolatilityPct: Math.round(newVolatility * 100) / 100,
        totalShipments,
        lastUpdatedAt: new Date(),
      },
    });
  }

  private async updateCategoryIntelligence(category: string, region: string, event: any): Promise<void> {
    const existing = await this.db.categoryIntelligence.findFirst({
      where: { category, region },
    });
    if (!existing) return;

    const totalOrders = existing.totalOrders + 1;
    const currentMargin = Number(existing.avgMarginPct);
    const newMargin = event.marginImpactPct != null
      ? (currentMargin * (totalOrders - 1) + event.marginImpactPct) / totalOrders
      : currentMargin;

    await this.db.categoryIntelligence.update({
      where: { id: existing.id },
      data: {
        avgMarginPct: Math.round(newMargin * 10000) / 10000,
        totalOrders,
        lastUpdatedAt: new Date(),
      },
    });
  }

  async getNetworkStats(): Promise<{
    totalLearningEvents: number;
    uniqueSuppliersCovered: number;
    uniqueRoutesCovered: number;
    categoriesCovered: number;
    avgGlobalReliability: number;
    networkHealthScore: number;
  }> {
    const [totalEvents, suppliers, routes, categories, reliabilityAgg] = await Promise.all([
      this.db.networkLearningEvent.count(),
      this.db.supplierGlobalScore.count(),
      this.db.routeIntelligence.count(),
      this.db.categoryIntelligence.count(),
      this.db.supplierGlobalScore.aggregate({ _avg: { globalReliabilityScore: true } }),
    ]);

    const avgReliability = Number(reliabilityAgg._avg.globalReliabilityScore ?? 85);
    const networkHealth = Math.min(100, Math.round(
      (avgReliability * 0.4) +
      (Math.min(suppliers / 20, 1) * 30) +
      (Math.min(routes / 50, 1) * 20) +
      (Math.min(totalEvents / 1000, 1) * 10)
    ));

    return {
      totalLearningEvents: totalEvents,
      uniqueSuppliersCovered: suppliers,
      uniqueRoutesCovered: routes,
      categoriesCovered: categories,
      avgGlobalReliability: Math.round(avgReliability * 10) / 10,
      networkHealthScore: networkHealth,
    };
  }
}
