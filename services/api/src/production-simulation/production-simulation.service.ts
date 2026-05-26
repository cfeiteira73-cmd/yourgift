import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma } from '@prisma/client';

export type SimulationScenario =
  | 'supplier_rejects_file'
  | 'delayed_production'
  | 'lost_shipment_event'
  | 'duplicate_webhook_payment'
  | 'refund_during_production'
  | 'corrupted_upload'
  | 'partial_production_failure';

export interface SimulationResult {
  scenario: SimulationScenario;
  orderId: string;
  success: boolean;
  dbChanges: string[];
  eventsEmitted: string[];
  summary: string;
}

const VALID_SCENARIOS: SimulationScenario[] = [
  'supplier_rejects_file',
  'delayed_production',
  'lost_shipment_event',
  'duplicate_webhook_payment',
  'refund_during_production',
  'corrupted_upload',
  'partial_production_failure',
];

@Injectable()
export class ProductionSimulationService {
  private readonly logger = new Logger(ProductionSimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async runScenario(scenario: SimulationScenario, orderId: string): Promise<SimulationResult> {
    if (!VALID_SCENARIOS.includes(scenario)) {
      throw new BadRequestException(`Unknown scenario: ${scenario}`);
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    this.logger.log(`Running simulation: ${scenario} on order ${orderId}`);

    switch (scenario) {
      case 'supplier_rejects_file': return this.supplierRejectsFile(orderId, order.clientId);
      case 'delayed_production': return this.delayedProduction(orderId, order.clientId);
      case 'lost_shipment_event': return this.lostShipmentEvent(orderId, order.clientId);
      case 'duplicate_webhook_payment': return this.duplicateWebhookPayment(orderId);
      case 'refund_during_production': return this.refundDuringProduction(orderId, order.clientId);
      case 'corrupted_upload': return this.corruptedUpload(orderId);
      case 'partial_production_failure': return this.partialProductionFailure(orderId, order.clientId);
    }
  }

  async listScenarios(): Promise<{ scenario: SimulationScenario; description: string }[]> {
    return [
      { scenario: 'supplier_rejects_file', description: 'Supplier rejects artwork — job fails, support ticket created' },
      { scenario: 'delayed_production', description: 'Production takes >48h — SLA breach simulated' },
      { scenario: 'lost_shipment_event', description: 'Shipment tracked then goes silent — delay flag triggered' },
      { scenario: 'duplicate_webhook_payment', description: 'Same payment webhook received twice — idempotency tested' },
      { scenario: 'refund_during_production', description: 'Refund requested while job in_production — conflict logged' },
      { scenario: 'corrupted_upload', description: 'Artwork marked corrupted — validation failure path' },
      { scenario: 'partial_production_failure', description: 'Job fails mid-run — retry queue tested' },
    ];
  }

  private async supplierRejectsFile(orderId: string, clientId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Create a failed production job
    const job = await this.prisma.productionJob.create({
      data: {
        orderId,
        idempotencyKey: `sim-supplier-reject-${orderId}-${Date.now()}`,
        status: 'failed',
        provider: 'printful',
        failedAt: new Date(),
        notes: '[SIMULATION] Supplier rejected file: DPI below threshold',
        retryCount: 1,
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`ProductionJob created (status=failed, id=${job.id})`);

    // Create support ticket
    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId,
        category: 'production_issue',
        title: '[SIM] Supplier rejected artwork file',
        description: 'Printful rejected the uploaded file — DPI was below 300. Customer needs to re-upload.',
        status: 'open',
        escalationLevel: 'L1',
        metadata: { simulation: true, jobId: job.id } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`SupportTicket created (id=${ticket.id})`);

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: job.id,
        event: 'simulation.supplier_rejects_file',
        orderId,
        payload: { simulation: true, ticketId: ticket.id } as object,
      },
    });
    dbChanges.push('EventLog entry written');

    this.eventBus.emit('simulation.supplier_rejects_file', { orderId, jobId: job.id });
    eventsEmitted.push('simulation.supplier_rejects_file');

    return {
      scenario: 'supplier_rejects_file',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Job ${job.id} marked failed, ticket ${ticket.id} created`,
    };
  }

  private async delayedProduction(orderId: string, clientId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Create job with start time 3 days ago (SLA = 48h = breached)
    const startedAt = new Date(Date.now() - 3 * 86_400_000);
    const job = await this.prisma.productionJob.create({
      data: {
        orderId,
        idempotencyKey: `sim-delayed-${orderId}-${Date.now()}`,
        status: 'in_production',
        provider: 'printful',
        startedAt,
        slaHours: 48,
        notes: '[SIMULATION] Deliberately delayed production job',
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`ProductionJob created (status=in_production, started 3d ago, id=${job.id})`);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId,
        category: 'production_issue',
        title: '[SIM] SLA breach — production delayed >48h',
        description: 'Production job has exceeded SLA of 48 hours. Escalating to supplier.',
        status: 'in_progress',
        escalationLevel: 'L2',
        metadata: { simulation: true, jobId: job.id } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`SupportTicket created (L2, id=${ticket.id})`);

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: job.id,
        event: 'simulation.delayed_production',
        orderId,
        payload: { simulation: true, slaBreached: true, hoursElapsed: 72 } as object,
      },
    });
    dbChanges.push('EventLog entry written');

    this.eventBus.emit('simulation.delayed_production', { orderId, jobId: job.id });
    eventsEmitted.push('simulation.delayed_production');

    return {
      scenario: 'delayed_production',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Job ${job.id} in_production for 3 days (SLA=48h breached), ticket ${ticket.id} created at L2`,
    };
  }

  private async lostShipmentEvent(orderId: string, clientId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Dispatch event 10 days ago
    const dispatchedAt = new Date(Date.now() - 10 * 86_400_000);
    await this.prisma.shipmentEvent.create({
      data: {
        orderId,
        event: 'dispatched',
        carrier: 'CTT',
        trackingNumber: `SIM-${Date.now()}`,
        location: 'Lisboa Hub',
        description: '[SIMULATION] Package dispatched',
        occurredAt: dispatchedAt,
        recordedAt: new Date(),
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push('ShipmentEvent created (dispatched, 10d ago)');

    // In-transit 8 days ago
    await this.prisma.shipmentEvent.create({
      data: {
        orderId,
        event: 'in_transit',
        carrier: 'CTT',
        location: 'Porto Sorting',
        description: '[SIMULATION] In transit',
        occurredAt: new Date(Date.now() - 8 * 86_400_000),
        recordedAt: new Date(),
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push('ShipmentEvent created (in_transit, 8d ago)');

    // Update order shippedAt
    await this.prisma.order.update({ where: { id: orderId }, data: { shippedAt: dispatchedAt } });
    dbChanges.push('Order.shippedAt set to 10 days ago');

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId,
        category: 'shipping_delay',
        title: '[SIM] Shipment lost — no tracking update for 8 days',
        description: 'Package dispatched 10 days ago, last tracked 8 days ago. No delivery confirmation.',
        status: 'open',
        escalationLevel: 'L2',
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`SupportTicket created (L2, id=${ticket.id})`);

    this.eventBus.emit('simulation.lost_shipment', { orderId });
    eventsEmitted.push('simulation.lost_shipment');

    return {
      scenario: 'lost_shipment_event',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Shipment tracked 8 days ago, now silent — ticket ${ticket.id} created`,
    };
  }

  private async duplicateWebhookPayment(orderId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Write two eventLog entries simulating the same stripe payment_intent.succeeded
    const eventId = `evt_sim_${Date.now()}`;

    await this.prisma.eventLog.create({
      data: {
        entity: 'stripe_webhook',
        entityId: eventId,
        event: 'payment_intent.succeeded',
        orderId,
        payload: { simulation: true, attempt: 1, stripeEventId: eventId } as object,
      },
    });
    dbChanges.push(`EventLog[1] for stripe event ${eventId}`);

    await this.prisma.eventLog.create({
      data: {
        entity: 'stripe_webhook',
        entityId: `${eventId}-dup`,
        event: 'payment_intent.succeeded',
        orderId,
        payload: { simulation: true, attempt: 2, stripeEventId: eventId, duplicate: true } as object,
      },
    });
    dbChanges.push(`EventLog[2] duplicate for stripe event ${eventId}`);

    this.eventBus.emit('simulation.duplicate_webhook', { orderId, eventId });
    eventsEmitted.push('simulation.duplicate_webhook');

    return {
      scenario: 'duplicate_webhook_payment',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Duplicate webhook logged — idempotency layer should prevent double-processing`,
    };
  }

  private async refundDuringProduction(orderId: string, clientId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Create in_production job
    const job = await this.prisma.productionJob.create({
      data: {
        orderId,
        idempotencyKey: `sim-refund-conflict-${orderId}-${Date.now()}`,
        status: 'in_production',
        provider: 'manual',
        startedAt: new Date(Date.now() - 3_600_000),
        metadata: { simulation: true } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`ProductionJob created (in_production, id=${job.id})`);

    // Create refund request (stripeRefundId required — use a simulation placeholder)
    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        stripeRefundId: `sim_refund_${Date.now()}`,
        amount: 0,
        reason: '[SIMULATION] Customer requested refund while production active',
        status: 'pending',
      },
    });
    dbChanges.push(`Refund created (pending, id=${refund.id})`);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId,
        category: 'refund_request',
        title: '[SIM] Refund requested — production in progress',
        description: 'Customer requested refund but production job is already in_production. Manual intervention needed.',
        status: 'open',
        escalationLevel: 'L2',
        metadata: { simulation: true, jobId: job.id, refundId: refund.id } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`SupportTicket created (L2, id=${ticket.id})`);

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: job.id,
        event: 'simulation.refund_during_production',
        orderId,
        payload: { simulation: true, refundId: refund.id } as object,
      },
    });
    dbChanges.push('EventLog written');

    this.eventBus.emit('simulation.refund_during_production', { orderId, jobId: job.id });
    eventsEmitted.push('simulation.refund_during_production');

    return {
      scenario: 'refund_during_production',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Production job ${job.id} active + refund ${refund.id} pending — conflict requires manual resolution`,
    };
  }

  private async corruptedUpload(orderId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Find or create an artwork for this order
    let artwork = await this.prisma.artwork.findFirst({ where: { orderId } });

    if (!artwork) {
      artwork = await this.prisma.artwork.create({
        data: {
          orderId,
          filename: 'corrupted_upload_sim.png',
          originalUrl: 'https://placeholder/corrupted',
          s3Key: `sim/corrupted/${Date.now()}.png`,
          mimeType: 'image/png',
          sizeBytes: 0,
          status: 'rejected',
        },
      });
      dbChanges.push(`Artwork created (rejected, id=${artwork.id})`);
    } else {
      await this.prisma.artwork.update({ where: { id: artwork.id }, data: { status: 'rejected' } });
      dbChanges.push(`Artwork ${artwork.id} status → rejected`);
    }

    await this.prisma.eventLog.create({
      data: {
        entity: 'artwork',
        entityId: artwork.id,
        event: 'simulation.corrupted_upload',
        orderId,
        payload: { simulation: true, reason: 'File integrity check failed — zero-byte or truncated' } as object,
      },
    });
    dbChanges.push('EventLog written');

    this.eventBus.emit('simulation.corrupted_upload', { orderId, artworkId: artwork.id });
    eventsEmitted.push('simulation.corrupted_upload');

    return {
      scenario: 'corrupted_upload',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Artwork ${artwork.id} marked rejected — upload corruption simulated`,
    };
  }

  private async partialProductionFailure(orderId: string, clientId: string): Promise<SimulationResult> {
    const dbChanges: string[] = [];
    const eventsEmitted: string[] = [];

    // Create job, fail it, then requeue
    const job = await this.prisma.productionJob.create({
      data: {
        orderId,
        idempotencyKey: `sim-partial-fail-${orderId}-${Date.now()}`,
        status: 'failed',
        provider: 'printful',
        startedAt: new Date(Date.now() - 7_200_000),
        failedAt: new Date(),
        retryCount: 1,
        notes: '[SIMULATION] Partial failure — 1 of 3 items failed during print',
        metadata: { simulation: true, itemsFailed: 1, itemsTotal: 3 } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`ProductionJob created (failed, retryCount=1, id=${job.id})`);

    // Requeue it
    await this.prisma.productionJob.update({
      where: { id: job.id },
      data: {
        status: 'requeued',
        failedAt: null,
        notes: null,
        idempotencyKey: `sim-partial-fail-${orderId}-retry-2`,
      },
    });
    dbChanges.push(`ProductionJob ${job.id} requeued`);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        clientId,
        orderId,
        category: 'production_issue',
        title: '[SIM] Partial production failure — item 1 of 3 failed',
        description: 'Print job partially failed. Items 2 and 3 completed; item 1 is being reprocessed.',
        status: 'in_progress',
        escalationLevel: 'L1',
        metadata: { simulation: true, jobId: job.id } as Prisma.InputJsonValue,
      },
    });
    dbChanges.push(`SupportTicket created (L1, id=${ticket.id})`);

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: job.id,
        event: 'simulation.partial_production_failure',
        orderId,
        payload: { simulation: true, itemsFailed: 1, itemsTotal: 3, requeued: true } as object,
      },
    });
    dbChanges.push('EventLog written');

    this.eventBus.emit('simulation.partial_production_failure', { orderId, jobId: job.id });
    eventsEmitted.push('simulation.partial_production_failure');

    return {
      scenario: 'partial_production_failure',
      orderId,
      success: true,
      dbChanges,
      eventsEmitted,
      summary: `Job ${job.id} failed and requeued — ticket ${ticket.id} tracks partial item failure`,
    };
  }
}
