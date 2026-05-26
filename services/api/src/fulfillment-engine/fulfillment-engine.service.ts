import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ---------- Shared payload types ----------

export interface OrderItemPayload {
  productRef: string;
  variantSku: string;
  quantity: number;
  technique: string | null;
  artworkUrl: string | null;
}

export interface ExternalJobResult {
  externalJobId: string;
  estimatedCompletionDate: Date | null;
  status: string;
  providerResponse: Record<string, unknown>;
}

export interface ExternalJobStatus {
  externalJobId: string;
  status: string;
  location?: string;
  updatedAt: Date;
}

export interface ShipmentEvent {
  timestamp: Date;
  location: string;
  description: string;
}

export interface ShipmentStatusResult {
  trackingNumber: string;
  carrier: string;
  status: string;
  events: ShipmentEvent[];
  estimatedDelivery: Date | null;
}

// ---------- Provider interface ----------

export interface IFulfillmentProvider {
  name: string;
  createJob(
    orderId: string,
    orderItems: OrderItemPayload[],
    metadata: Record<string, unknown>,
  ): Promise<ExternalJobResult>;
  updateStatus(externalJobId: string): Promise<ExternalJobStatus>;
  cancelJob(externalJobId: string): Promise<{ cancelled: boolean; reason?: string }>;
  trackShipment(trackingNumber: string): Promise<ShipmentStatusResult>;
}

// ---------- Return types ----------

export interface DispatchResult {
  orderId: string;
  providerName: string;
  externalJobId: string;
  estimatedCompletion: Date | null;
  dispatchedAt: Date;
}

export interface SLAReport {
  total: number;
  breached: number;
  healthy: number;
  avgAgeHours: number;
  criticalJobs: string[];
}

export interface BatchSummary {
  ordersAwaitingProduction: number;
  ordersInProduction: number;
  ordersShipped: number;
  productionJobsByStatus: Record<string, number>;
  supplierBreakdown: Record<string, number>;
}

// ---------- Manual provider implementation ----------

class ManualFulfillmentProvider implements IFulfillmentProvider {
  name = 'manual';

  constructor(private readonly prisma: PrismaService) {}

  async createJob(
    orderId: string,
    items: OrderItemPayload[],
    metadata: Record<string, unknown>,
  ): Promise<ExternalJobResult> {
    const externalJobId = `manual-${orderId}-${Date.now()}`;

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'fulfillment.manual.job.created',
        orderId,
        payload: { items, metadata } as object,
      },
    });

    return {
      externalJobId,
      estimatedCompletionDate: new Date(Date.now() + 5 * 86_400_000),
      status: 'created',
      providerResponse: {},
    };
  }

  async updateStatus(externalJobId: string): Promise<ExternalJobStatus> {
    return {
      externalJobId,
      status: 'unknown',
      updatedAt: new Date(),
    };
  }

  async cancelJob(_externalJobId: string): Promise<{ cancelled: boolean; reason?: string }> {
    return { cancelled: true };
  }

  async trackShipment(trackingNumber: string): Promise<ShipmentStatusResult> {
    return {
      trackingNumber,
      carrier: 'manual',
      status: 'unknown',
      events: [],
      estimatedDelivery: null,
    };
  }
}

// ---------- Main service ----------

@Injectable()
export class FulfillmentEngineService {
  private readonly providers: Map<string, IFulfillmentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.providers = new Map();
    this.providers.set('manual', new ManualFulfillmentProvider(this.prisma));
  }

  getProvider(name: string): IFulfillmentProvider | null {
    return this.providers.get(name) ?? null;
  }

  registerProvider(provider: IFulfillmentProvider): void {
    this.providers.set(provider.name, provider);
  }

  listProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  async dispatchOrder(orderId: string, providerName = 'manual'): Promise<DispatchResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        artworks: { where: { status: 'approved' } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const provider = this.getProvider(providerName);

    if (!provider) {
      throw new NotFoundException(`Fulfillment provider '${providerName}' is not registered`);
    }

    const approvedArtwork = order.artworks.find((a) => a.mockupUrl !== null) ?? order.artworks[0] ?? null;

    const orderItems: OrderItemPayload[] = order.items.map((item) => ({
      productRef: item.productId,
      variantSku: item.variantId ?? '',
      quantity: item.quantity,
      technique: item.technique ?? null,
      artworkUrl: approvedArtwork?.mockupUrl ?? null,
    }));

    const result = await provider.createJob(orderId, orderItems, {
      orderRef: order.ref,
      totalAmount: order.totalAmount,
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        supplierOrderId: result.externalJobId,
        supplier: providerName,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: orderId,
        event: 'order.dispatched_to_fulfillment',
        orderId,
        payload: {
          provider: providerName,
          externalJobId: result.externalJobId,
        } as object,
      },
    });

    this.eventBus.emit('order.dispatched', {
      orderId,
      providerName,
      externalJobId: result.externalJobId,
    });

    return {
      orderId,
      providerName,
      externalJobId: result.externalJobId,
      estimatedCompletion: result.estimatedCompletionDate,
      dispatchedAt: new Date(),
    };
  }

  async getSLAStatus(): Promise<SLAReport> {
    const allActiveJobs = await this.prisma.productionJob.findMany({
      where: { status: { in: ['queued', 'in_production', 'requeued'] } },
    });

    const now = Date.now();
    const criticalJobs: string[] = [];
    let totalAgeMs = 0;

    for (const job of allActiveJobs) {
      const slaDeadline = job.createdAt.getTime() + job.slaHours * 3_600_000;
      totalAgeMs += now - job.createdAt.getTime();

      if (now > slaDeadline) {
        criticalJobs.push(job.id);
      }
    }

    const total = allActiveJobs.length;
    const breached = criticalJobs.length;
    const healthy = total - breached;
    const avgAgeHours = total > 0 ? totalAgeMs / total / 3_600_000 : 0;

    return { total, breached, healthy, avgAgeHours, criticalJobs };
  }

  async getBatchSummary(): Promise<BatchSummary> {
    // Orders awaiting production: paid orders with no ProductionJob
    const [
      paidOrderIds,
      productionJobsByStatus,
      shippedCount,
      supplierGroups,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: 'paid' },
        select: { id: true },
      }),
      this.prisma.productionJob.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.order.count({ where: { shippedAt: { not: null } } }),
      this.prisma.order.groupBy({
        by: ['supplier'],
        _count: { id: true },
        where: { supplier: { not: null } },
      }),
    ]);

    // Orders in production: have a ProductionJob with status='in_production'
    const inProductionCount = await this.prisma.productionJob.count({
      where: { status: 'in_production' },
    });

    // Paid orders with no associated ProductionJob
    const paidIds = paidOrderIds.map((o) => o.id);
    let awaitingProduction = 0;

    if (paidIds.length > 0) {
      const jobsForPaidOrders = await this.prisma.productionJob.findMany({
        where: { orderId: { in: paidIds } },
        select: { orderId: true },
      });
      const ordersWithJob = new Set(jobsForPaidOrders.map((j) => j.orderId));
      awaitingProduction = paidIds.filter((id) => !ordersWithJob.has(id)).length;
    }

    const productionJobsByStatusMap: Record<string, number> = {};
    for (const group of productionJobsByStatus) {
      productionJobsByStatusMap[group.status] = group._count.id;
    }

    const supplierBreakdown: Record<string, number> = {};
    for (const group of supplierGroups) {
      if (group.supplier) {
        supplierBreakdown[group.supplier] = group._count.id;
      }
    }

    return {
      ordersAwaitingProduction: awaitingProduction,
      ordersInProduction: inProductionCount,
      ordersShipped: shippedCount,
      productionJobsByStatus: productionJobsByStatusMap,
      supplierBreakdown,
    };
  }
}
