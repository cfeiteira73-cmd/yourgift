// ── Phases 9-10 — Makito Production & Shipment Tracking ───────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { MakitoService } from './makito.service';
import type { MakitoOrderStatus } from '@yourgift/makito';

export interface MakitoProductionStatus {
  orderId: string;
  ref: string;
  makitoOrderId: string;
  stage: MakitoOrderStatus;
  stageLabel: string;
  stageIndex: number;
  totalStages: number;
  progressPct: number;
  estimatedDelivery?: string;
  slaStatus: 'on_time' | 'at_risk' | 'breached';
  trackingNumber?: string;
  carrierCode?: string;
  trackingUrl?: string;
  lastUpdated: string;
  events: Array<{ timestamp: string; status: string; description: string; location?: string }>;
}

const PRODUCTION_STAGES: MakitoOrderStatus[] = [
  'RECEIVED',
  'CONFIRMED',
  'ARTWORK_REVIEW',
  'IN_PRODUCTION',
  'QUALITY_CONTROL',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
];

const STAGE_LABELS: Record<MakitoOrderStatus, string> = {
  RECEIVED: 'Received',
  CONFIRMED: 'Confirmed',
  ARTWORK_REVIEW: 'Artwork Review',
  IN_PRODUCTION: 'In Production',
  QUALITY_CONTROL: 'Quality Control',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On Hold',
};

// Expected hours per stage for SLA
const STAGE_SLA_HOURS: Partial<Record<MakitoOrderStatus, number>> = {
  RECEIVED: 4,
  CONFIRMED: 24,
  ARTWORK_REVIEW: 48,
  IN_PRODUCTION: 120,
  QUALITY_CONTROL: 24,
  PACKED: 12,
  SHIPPED: 72,
};

@Injectable()
export class MakitoTrackingService {
  private readonly logger = new Logger(MakitoTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly makito: MakitoService,
  ) {}

  async getProductionStatus(orderId: string): Promise<MakitoProductionStatus | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order || !order.items.some((i: any) => i.product?.supplier === 'makito')) {
      return null;
    }

    const makitoOrderId = (order as any).supplierOrderId;
    if (!makitoOrderId) {
      return this.buildStatusFromDb(order);
    }

    try {
      const [orderStatus, shipment] = await Promise.all([
        this.makito.getOrderStatus(makitoOrderId),
        this.makito.getShipmentTracking(makitoOrderId).catch(() => null),
      ]);

      const stage = orderStatus.status;
      const stageIndex = PRODUCTION_STAGES.indexOf(stage);
      const progressPct = stageIndex >= 0
        ? Math.round(((stageIndex + 1) / PRODUCTION_STAGES.length) * 100)
        : 0;

      // SLA check
      const hoursElapsed = (Date.now() - new Date((order as any).updatedAt).getTime()) / 3600000;
      const expectedHours = STAGE_SLA_HOURS[stage] ?? 24;
      const slaStatus: MakitoProductionStatus['slaStatus'] =
        hoursElapsed > expectedHours * 1.5 ? 'breached' :
        hoursElapsed > expectedHours ? 'at_risk' : 'on_time';

      // Update order in DB
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: this.mapStatus(stage),
          ...(orderStatus.trackingNumber ? { trackingNumber: orderStatus.trackingNumber } : {}),
        },
      });

      const status: MakitoProductionStatus = {
        orderId,
        ref: (order as any).ref,
        makitoOrderId,
        stage,
        stageLabel: STAGE_LABELS[stage] ?? stage,
        stageIndex: Math.max(0, stageIndex),
        totalStages: PRODUCTION_STAGES.length,
        progressPct,
        estimatedDelivery: orderStatus.estimatedDeliveryDate,
        slaStatus,
        trackingNumber: orderStatus.trackingNumber ?? shipment?.trackingNumber,
        carrierCode: orderStatus.carrierCode ?? shipment?.carrier,
        trackingUrl: orderStatus.trackingUrl ?? shipment?.carrierTrackingUrl,
        lastUpdated: orderStatus.updatedAt,
        events: shipment?.events ?? [],
      };

      // Emit stage change events
      if (stage === 'SHIPPED') {
        this.events.emit('makito.order.shipped', { orderId, trackingNumber: status.trackingNumber });
      } else if (stage === 'DELIVERED') {
        this.events.emit('makito.order.delivered', { orderId });
      }

      return status;
    } catch (err) {
      this.logger.warn(`Could not fetch live Makito status for ${makitoOrderId}: ${err}`);
      return this.buildStatusFromDb(order);
    }
  }

  /** Poll all active Makito orders and sync status */
  async pollActiveOrders(): Promise<{ updated: number; errors: string[] }> {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        supplier: 'makito',
        status: { notIn: ['delivered', 'cancelled'] },
        supplierOrderId: { not: null },
      },
      select: { id: true, supplierOrderId: true },
      take: 100,
    });

    let updated = 0;
    const errors: string[] = [];

    for (const order of activeOrders) {
      try {
        await this.getProductionStatus(order.id);
        updated++;
      } catch (err) {
        errors.push(`${order.id}: ${err}`);
      }
    }

    this.logger.log(`Makito tracking poll: ${updated} orders updated, ${errors.length} errors`);
    return { updated, errors };
  }

  /** Customer-facing timeline for portal */
  async getCustomerTimeline(orderId: string) {
    const status = await this.getProductionStatus(orderId);
    if (!status) return null;

    return {
      currentStage: status.stageLabel,
      progressPct: status.progressPct,
      estimatedDelivery: status.estimatedDelivery,
      tracking: status.trackingNumber
        ? { number: status.trackingNumber, carrier: status.carrierCode, url: status.trackingUrl }
        : null,
      stages: PRODUCTION_STAGES.map((s, i) => ({
        key: s,
        label: STAGE_LABELS[s],
        completed: i < status.stageIndex,
        active: i === status.stageIndex,
        pending: i > status.stageIndex,
      })),
      events: status.events.slice(0, 10),
    };
  }

  private buildStatusFromDb(order: any): MakitoProductionStatus {
    const dbStageMap: Record<string, MakitoOrderStatus> = {
      confirmed: 'CONFIRMED',
      producing: 'IN_PRODUCTION',
      shipped: 'SHIPPED',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
    };
    const stage: MakitoOrderStatus = dbStageMap[order.status] ?? 'RECEIVED';
    const stageIndex = PRODUCTION_STAGES.indexOf(stage);

    return {
      orderId: order.id,
      ref: order.ref,
      makitoOrderId: order.supplierOrderId ?? '',
      stage,
      stageLabel: STAGE_LABELS[stage],
      stageIndex: Math.max(0, stageIndex),
      totalStages: PRODUCTION_STAGES.length,
      progressPct: stageIndex >= 0 ? Math.round(((stageIndex + 1) / PRODUCTION_STAGES.length) * 100) : 0,
      slaStatus: 'on_time',
      lastUpdated: order.updatedAt?.toISOString() ?? new Date().toISOString(),
      events: [],
    };
  }

  private mapStatus(stage: MakitoOrderStatus): string {
    const map: Record<MakitoOrderStatus, string> = {
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
    return map[stage] ?? 'pending';
  }
}
