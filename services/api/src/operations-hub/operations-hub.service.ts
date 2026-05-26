import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

const VALID_ORDER_STATUSES = new Set([
  'paid',
  'approved',
  'producing',
  'shipped',
  'delivered',
  'cancelled',
]);

export interface OperationsDashboard {
  generatedAt: Date;
  production: {
    pending: number;
    inProduction: number;
    failed: number;
    slaBreached: number;
  };
  shipments: { delayed: number };
  support: { pendingRefunds: number; openTickets: number; l3Escalated: number };
  orders: { highRisk: number };
  system: { failedJobsLast1h: number };
  attentionRequired: boolean;
  criticalItems: string[];
}

export interface PendingActionsReport {
  failedJobs: Array<{
    id: string;
    orderId: string;
    order: { ref: string; clientId: string };
    status: string;
    priority: number;
    retryCount: number;
    failedAt: Date | null;
  }>;
  escalatedTickets: Array<{
    id: string;
    clientId: string;
    orderId: string | null;
    category: string;
    title: string;
    escalationLevel: string;
    createdAt: Date;
  }>;
  slaBreachedJobs: Array<{
    id: string;
    orderId: string;
    created_at: Date;
    sla_hours: number;
  }>;
}

@Injectable()
export class OperationsHubService {
  private readonly logger = new Logger(OperationsHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(): Promise<OperationsDashboard> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const oneHourAgo = new Date(Date.now() - 3_600_000);

    const [
      pendingProductionJobs,
      inProductionJobs,
      failedProductionJobs,
      slaBreachedResult,
      delayedShipments,
      pendingRefunds,
      openTickets,
      highRiskOrders,
      failedJobsLast1h,
      L3EscalatedTickets,
    ] = await Promise.all([
      // 1
      this.prisma.productionJob.count({
        where: { status: { in: ['queued', 'requeued'] } },
      }),
      // 2
      this.prisma.productionJob.count({
        where: { status: 'in_production' },
      }),
      // 3
      this.prisma.productionJob.count({
        where: { status: 'failed' },
      }),
      // 4 — SLA breached: created_at + sla_hours < NOW and not completed/cancelled
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM production_jobs
        WHERE status NOT IN ('completed', 'cancelled')
          AND (created_at + (sla_hours * INTERVAL '1 hour')) < NOW()
      `,
      // 5
      this.prisma.order.count({
        where: {
          shippedAt: { not: null, lt: sevenDaysAgo },
          deliveredAt: null,
        },
      }),
      // 6
      this.prisma.supportTicket.count({
        where: {
          category: 'refund_request',
          status: { in: ['open', 'in_progress'] },
        },
      }),
      // 7
      this.prisma.supportTicket.count({
        where: { status: { in: ['open', 'escalated'] } },
      }),
      // 8
      this.prisma.order.count({
        where: { status: 'paid', stripePaymentId: null },
      }),
      // 9
      this.prisma.job.count({
        where: { status: 'failed', createdAt: { gte: oneHourAgo } },
      }),
      // 10
      this.prisma.supportTicket.count({
        where: {
          escalationLevel: 'L3',
          status: { not: 'resolved' },
        },
      }),
    ]);

    const slaBreachedJobs = Number(slaBreachedResult[0]?.count ?? 0);

    const criticalItems: string[] = [];
    if (failedProductionJobs > 0)
      criticalItems.push(`${failedProductionJobs} production jobs failed`);
    if (slaBreachedJobs > 0)
      criticalItems.push(`${slaBreachedJobs} production jobs breached SLA`);
    if (delayedShipments > 0)
      criticalItems.push(`${delayedShipments} shipments delayed > 7 days`);
    if (pendingRefunds > 0)
      criticalItems.push(`${pendingRefunds} refund requests pending`);
    if (L3EscalatedTickets > 0)
      criticalItems.push(
        `${L3EscalatedTickets} L3 escalated tickets require financial override`,
      );
    if (highRiskOrders > 0)
      criticalItems.push(`${highRiskOrders} paid orders missing Stripe ID`);

    return {
      generatedAt: new Date(),
      production: {
        pending: pendingProductionJobs,
        inProduction: inProductionJobs,
        failed: failedProductionJobs,
        slaBreached: slaBreachedJobs,
      },
      shipments: { delayed: delayedShipments },
      support: {
        pendingRefunds,
        openTickets,
        l3Escalated: L3EscalatedTickets,
      },
      orders: { highRisk: highRiskOrders },
      system: { failedJobsLast1h },
      attentionRequired: criticalItems.length > 0,
      criticalItems,
    };
  }

  // ── Manual Override Order Status ──────────────────────────────────────────

  async manualOverrideOrderStatus(
    orderId: string,
    newStatus: string,
    reason: string,
    adminId: string,
  ) {
    if (!VALID_ORDER_STATUSES.has(newStatus)) {
      throw new BadRequestException(
        `Invalid order status "${newStatus}". Valid statuses: ${[...VALID_ORDER_STATUSES].join(', ')}.`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const previousStatus = order.status;
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'admin.order.status_override',
        actorId: adminId,
        actorType: 'admin',
        orderId: orderId,
        payload: { previousStatus, newStatus, reason } as object,
      },
    });

    this.events.emit('admin.order.overridden', {
      orderId,
      previousStatus,
      newStatus,
      reason,
      adminId,
    });

    this.logger.log(
      `Admin ${adminId} overrode order ${orderId} status: ${previousStatus} → ${newStatus}`,
    );
    return updated;
  }

  // ── Manual Cancel Order ───────────────────────────────────────────────────

  async manualCancelOrder(
    orderId: string,
    reason: string,
    adminId: string,
  ): Promise<{ cancelled: boolean; orderId: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status === 'cancelled') {
      throw new BadRequestException(`Order ${orderId} is already cancelled`);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'admin.order.cancelled',
        actorId: adminId,
        actorType: 'admin',
        orderId: orderId,
        payload: { reason, previousStatus: order.status } as object,
      },
    });

    this.events.emit('order.cancelled', { orderId, reason, adminId });

    this.logger.log(`Admin ${adminId} cancelled order ${orderId}: ${reason}`);
    return { cancelled: true, orderId };
  }

  // ── Requeue Failed Production Job ─────────────────────────────────────────

  async requeueFailedProductionJob(
    jobId: string,
    adminId: string,
    priority?: number,
  ) {
    const job = await this.prisma.productionJob.findUnique({
      where: { id: jobId },
      include: { order: { select: { ref: true, clientId: true } } },
    });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }
    if (job.status !== 'failed') {
      throw new BadRequestException(
        `ProductionJob ${jobId} is not in "failed" status (current: "${job.status}")`,
      );
    }

    const newIdempotencyKey = `prod-${job.orderId}-admin-requeue-${Date.now()}`;

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        status: 'requeued',
        retryCount: job.retryCount + 1,
        priority: priority ?? job.priority,
        idempotencyKey: newIdempotencyKey,
        failedAt: null,
      },
      include: { order: { select: { ref: true, clientId: true } } },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'admin.production_job.requeued',
        actorId: adminId,
        actorType: 'admin',
        payload: {
          jobId,
          reason: 'manual admin requeue',
          adminId,
          newIdempotencyKey,
        } as object,
      },
    });

    this.events.emit('production.job.requeued', { jobId, adminId });

    this.logger.log(`Admin ${adminId} requeued production job ${jobId}`);
    return updated;
  }

  // ── Force Complete Production Job ─────────────────────────────────────────

  async forceCompleteProductionJob(
    jobId: string,
    adminId: string,
    notes: string,
  ) {
    const job = await this.prisma.productionJob.findUnique({
      where: { id: jobId },
      include: { order: { select: { ref: true, clientId: true } } },
    });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        notes: `[ADMIN OVERRIDE] ${notes}`,
      },
      include: { order: { select: { ref: true, clientId: true } } },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'admin.production_job.force_completed',
        actorId: adminId,
        actorType: 'admin',
        payload: { jobId, adminId, notes } as object,
      },
    });

    this.events.emit('production.job.completed', { jobId, adminId, forced: true });

    this.logger.log(`Admin ${adminId} force-completed production job ${jobId}`);
    return updated;
  }

  // ── Retry Failed Shipment ─────────────────────────────────────────────────

  async retryFailedShipment(
    orderId: string,
    newTrackingNumber: string,
    carrier: string,
    adminId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (!order.shippedAt) {
      throw new BadRequestException(
        `Order ${orderId} has no shippedAt date — cannot retry shipment`,
      );
    }

    const shipmentEvent = await this.prisma.shipmentEvent.create({
      data: {
        orderId,
        event: 'dispatched',
        carrier,
        trackingNumber: newTrackingNumber,
        description: `Shipment retry dispatched by admin ${adminId}`,
        occurredAt: new Date(),
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { trackingNumber: newTrackingNumber },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'admin.shipment.retried',
        actorId: adminId,
        actorType: 'admin',
        orderId: orderId,
        payload: { orderId, newTrackingNumber, carrier, adminId } as object,
      },
    });

    this.events.emit('shipment.event.recorded', {
      orderId,
      event: 'dispatched',
      trackingNumber: newTrackingNumber,
    });

    this.logger.log(
      `Admin ${adminId} retried shipment for order ${orderId} — tracking: ${newTrackingNumber}`,
    );
    return shipmentEvent;
  }

  // ── Pending Actions ───────────────────────────────────────────────────────

  async getPendingActions(): Promise<PendingActionsReport> {
    const [failedJobs, escalatedTickets, slaBreachedJobs] = await Promise.all([
      this.prisma.productionJob.findMany({
        where: { status: 'failed' },
        orderBy: { failedAt: 'asc' },
        take: 20,
        include: { order: { select: { ref: true, clientId: true } } },
      }),
      this.prisma.supportTicket.findMany({
        where: { escalationLevel: 'L3', status: { not: 'resolved' } },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          id: true,
          clientId: true,
          orderId: true,
          category: true,
          title: true,
          escalationLevel: true,
          createdAt: true,
        },
      }),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          order_id: string;
          created_at: Date;
          sla_hours: number;
        }>
      >`
        SELECT id, order_id, created_at, sla_hours
        FROM production_jobs
        WHERE status NOT IN ('completed', 'cancelled')
          AND (created_at + (sla_hours * INTERVAL '1 hour')) < NOW()
        ORDER BY created_at ASC
        LIMIT 20
      `,
    ]);

    return {
      failedJobs: failedJobs as PendingActionsReport['failedJobs'],
      escalatedTickets,
      slaBreachedJobs: slaBreachedJobs.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        created_at: row.created_at,
        sla_hours: Number(row.sla_hours),
      })),
    };
  }
}
