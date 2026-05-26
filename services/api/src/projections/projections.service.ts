import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class ProjectionsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // Subscribe to all order events to update the order projection
    const orderEvents = [
      'order.created',
      'order.status_changed',
      'order.paid',
      'order.approved',
      'order.shipped',
      'order.delivered',
      'order.cancelled',
      'order.fulfillment_started',
    ];

    for (const eventType of orderEvents) {
      this.events.on(eventType, async (payload: Record<string, unknown>) => {
        const orderId = (payload['orderId'] ?? payload['_streamId']) as string | undefined;
        if (orderId) {
          await this.updateOrderProjection(orderId, eventType, payload).catch((err) =>
            this.logger.error(`Failed to update order projection for ${orderId}: ${err}`),
          );
        }
      });
    }
  }

  /** Update (or create) the order projection from the latest DB state */
  async updateOrderProjection(
    orderId: string,
    lastEventType: string,
    eventPayload: Record<string, unknown>,
  ): Promise<void> {
    void eventPayload; // referenced by event bus but not needed for DB read

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    // Get latest event sequence
    const latestEvent = await this.prisma.procurementEvent.findFirst({
      where: { streamId: orderId },
      orderBy: { sequenceNum: 'desc' },
    });

    await this.prisma.orderProjection.upsert({
      where: { id: orderId },
      create: {
        id: orderId,
        ref: order.ref,
        clientId: order.clientId,
        companyId: order.companyId ?? undefined,
        departmentId: order.departmentId ?? undefined,
        campaignId: order.campaignId ?? undefined,
        status: order.status,
        currency: order.currency,
        supplier: order.supplier ?? undefined,
        supplierOrderId: order.supplierOrderId ?? undefined,
        totalAmount: order.totalAmount ?? undefined,
        marginAmount: order.marginAmount ?? undefined,
        itemCount: order.items.length,
        shippingAddress: order.shippingAddress ?? undefined,
        trackingNumber: order.trackingNumber ?? undefined,
        approvedAt: order.approvedAt ?? undefined,
        shippedAt: order.shippedAt ?? undefined,
        deliveredAt: order.deliveredAt ?? undefined,
        lastEventType,
        lastEventAt: new Date(),
        eventSequence: latestEvent?.sequenceNum ?? 0,
      },
      update: {
        status: order.status,
        supplier: order.supplier ?? undefined,
        supplierOrderId: order.supplierOrderId ?? undefined,
        totalAmount: order.totalAmount ?? undefined,
        marginAmount: order.marginAmount ?? undefined,
        itemCount: order.items.length,
        trackingNumber: order.trackingNumber ?? undefined,
        approvedAt: order.approvedAt ?? undefined,
        shippedAt: order.shippedAt ?? undefined,
        deliveredAt: order.deliveredAt ?? undefined,
        lastEventType,
        lastEventAt: new Date(),
        eventSequence: latestEvent?.sequenceNum ?? 0,
      },
    });

    // Snapshot every 10 events
    const seq = latestEvent?.sequenceNum ?? 0;
    if (seq > 0 && seq % 10 === 0) {
      await this.takeSnapshot(
        orderId,
        'order',
        order as unknown as Record<string, unknown>,
        seq,
      );
    }
  }

  /** Take an aggregate snapshot */
  async takeSnapshot(
    aggregateId: string,
    aggregateType: string,
    state: Record<string, unknown>,
    lastSequenceNum: number,
  ): Promise<void> {
    const existing = await this.prisma.aggregateSnapshot.findUnique({
      where: { aggregateId_aggregateType: { aggregateId, aggregateType } },
    });

    await this.prisma.aggregateSnapshot.upsert({
      where: { aggregateId_aggregateType: { aggregateId, aggregateType } },
      create: {
        aggregateId,
        aggregateType,
        state: state as object,
        lastSequenceNum,
        snapshotVersion: 1,
      },
      update: {
        state: state as object,
        lastSequenceNum,
        snapshotVersion: (existing?.snapshotVersion ?? 0) + 1,
        takenAt: new Date(),
      },
    });
  }

  /** Get a snapshot for an aggregate */
  async getSnapshot(aggregateId: string, aggregateType: string) {
    return this.prisma.aggregateSnapshot.findUnique({
      where: { aggregateId_aggregateType: { aggregateId, aggregateType } },
    });
  }

  /** Rebuild all order projections from scratch (async, tracked) */
  async rebuildOrderProjections(): Promise<{ logId: string }> {
    const log = await this.prisma.projectionRebuildLog.create({
      data: { projectionName: 'order_projections', status: 'running' },
    });

    // Run async (don't await)
    void this.runRebuild(log.id);
    return { logId: log.id };
  }

  private async runRebuild(logId: string): Promise<void> {
    let eventsProcessed = 0;
    try {
      // Clear existing projections
      await this.prisma.orderProjection.deleteMany();

      // Get all orders and rebuild
      const orders = await this.prisma.order.findMany({
        include: { items: true },
      });

      for (const order of orders) {
        const latestEvent = await this.prisma.procurementEvent.findFirst({
          where: { streamId: order.id },
          orderBy: { sequenceNum: 'desc' },
        });

        await this.prisma.orderProjection.create({
          data: {
            id: order.id,
            ref: order.ref,
            clientId: order.clientId,
            companyId: order.companyId ?? undefined,
            departmentId: order.departmentId ?? undefined,
            campaignId: order.campaignId ?? undefined,
            status: order.status,
            currency: order.currency,
            supplier: order.supplier ?? undefined,
            supplierOrderId: order.supplierOrderId ?? undefined,
            totalAmount: order.totalAmount ?? undefined,
            marginAmount: order.marginAmount ?? undefined,
            itemCount: order.items.length,
            shippingAddress: order.shippingAddress ?? undefined,
            trackingNumber: order.trackingNumber ?? undefined,
            approvedAt: order.approvedAt ?? undefined,
            shippedAt: order.shippedAt ?? undefined,
            deliveredAt: order.deliveredAt ?? undefined,
            lastEventType: latestEvent?.eventType ?? 'order.created',
            lastEventAt: latestEvent?.appliedAt ?? order.createdAt,
            eventSequence: latestEvent?.sequenceNum ?? 0,
          },
        });
        eventsProcessed++;
      }

      await this.prisma.projectionRebuildLog.update({
        where: { id: logId },
        data: { status: 'completed', eventsProcessed, completedAt: new Date() },
      });

      this.logger.log(`Order projection rebuild complete: ${eventsProcessed} orders`);
    } catch (err) {
      await this.prisma.projectionRebuildLog.update({
        where: { id: logId },
        data: { status: 'failed', error: String(err), completedAt: new Date() },
      });
      this.logger.error(`Projection rebuild failed: ${err}`);
    }
  }

  /** Query order projections (fast read model) */
  async queryOrderProjections(filters: {
    tenantId?: string;
    status?: string;
    clientId?: string;
    companyId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.tenantId) where['tenantId'] = filters.tenantId;
    if (filters.status) where['status'] = filters.status;
    if (filters.clientId) where['clientId'] = filters.clientId;
    if (filters.companyId) where['companyId'] = filters.companyId;

    const [projections, total] = await Promise.all([
      this.prisma.orderProjection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      this.prisma.orderProjection.count({ where }),
    ]);

    return { projections, total };
  }

  /** Get projection system health */
  async getHealth() {
    const [
      totalProjections,
      totalSnapshots,
      recentRebuild,
      eventStreamSize,
    ] = await Promise.all([
      this.prisma.orderProjection.count(),
      this.prisma.aggregateSnapshot.count(),
      this.prisma.projectionRebuildLog.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.procurementEvent.count(),
    ]);

    return {
      orderProjections: totalProjections,
      snapshots: totalSnapshots,
      eventStreamSize,
      lastRebuild: recentRebuild,
    };
  }

  /** Get rebuild logs */
  async getRebuildLogs(limit = 20) {
    return this.prisma.projectionRebuildLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
