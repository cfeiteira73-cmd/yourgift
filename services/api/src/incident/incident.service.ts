import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export type IncidentSeverity = 'SEV0' | 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface CreateIncidentInput {
  title: string;
  severity: IncidentSeverity;
  affectedServices: string[];
  description?: string;
  source?: string;
  tenantId?: string;
  blastRadius?: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentFilters {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class IncidentService implements OnModuleInit {
  private readonly logger = new Logger(IncidentService.name);

  // Sliding-window counters: key → timestamps[]
  private readonly failureWindow = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.subscribeToEventBus();
  }

  // ── Event-bus subscriptions ──────────────────────────────────────────────

  private subscribeToEventBus(): void {
    this.eventBus.on('queue.failed', (payload: { queue?: string }) => {
      this.handleQueueFailure(payload.queue ?? 'unknown').catch((err: Error) =>
        this.logger.error('queue.failed handler error', err.stack),
      );
    });

    this.eventBus.on('payment.failed', (payload: { orderId?: string; tenantId?: string }) => {
      this.handleRecurringPaymentFailure(payload).catch((err: Error) =>
        this.logger.error('payment.failed handler error', err.stack),
      );
    });

    this.eventBus.on('auth.spike', (payload: Record<string, unknown>) => {
      this.autoCreateIncident({
        title: 'Auth spike detected',
        severity: 'SEV2',
        affectedServices: ['auth'],
        source: 'event-bus',
        description: 'Elevated authentication failure rate detected',
        metadata: payload,
      }).catch((err: Error) =>
        this.logger.error('auth.spike handler error', err.stack),
      );
    });

    this.eventBus.on('workflow.stalled', (payload: { definitionName?: string }) => {
      this.autoCreateIncident({
        title: `Workflow stalled: ${payload.definitionName ?? 'unknown'}`,
        severity: 'SEV2',
        affectedServices: ['workflows'],
        source: 'event-bus',
        description: 'A workflow instance has stalled without completing',
        metadata: payload as Record<string, unknown>,
      }).catch((err: Error) =>
        this.logger.error('workflow.stalled handler error', err.stack),
      );
    });

    this.eventBus.on('supplier.degraded', (payload: { supplier?: string }) => {
      this.autoCreateIncident({
        title: `Supplier degraded: ${payload.supplier ?? 'unknown'}`,
        severity: 'SEV2',
        affectedServices: ['suppliers', 'procurement'],
        source: 'event-bus',
        description: 'Supplier reliability score has dropped below threshold',
        metadata: payload as Record<string, unknown>,
      }).catch((err: Error) =>
        this.logger.error('supplier.degraded handler error', err.stack),
      );
    });

    this.eventBus.on('reconciliation.critical_drift', (payload: Record<string, unknown>) => {
      this.autoCreateSev0Incident('Critical reconciliation drift detected', [
        'reconciliation',
        'ledger',
      ]).catch((err: Error) =>
        this.logger.error('reconciliation.critical_drift handler error', err.stack),
      );
      void payload;
    });

    this.eventBus.on('sre.critical_system_alert', (payload: Record<string, unknown>) => {
      this.autoCreateSev0Incident('SRE critical system alert', [
        'api-gateway',
        'queue',
      ]).catch((err: Error) =>
        this.logger.error('sre.critical_system_alert handler error', err.stack),
      );
      void payload;
    });

    this.eventBus.on('financial-replay.anomaly', (payload: Record<string, unknown>) => {
      this.autoCreateSev0Incident('Financial replay anomaly', [
        'ledger',
        'reconciliation',
      ]).catch((err: Error) =>
        this.logger.error('financial-replay.anomaly handler error', err.stack),
      );
      void payload;
    });
  }

  private async handleQueueFailure(queue: string): Promise<void> {
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const key = `queue:${queue}`;

    const timestamps = (this.failureWindow.get(key) ?? []).filter(
      (t) => now - t < windowMs,
    );
    timestamps.push(now);
    this.failureWindow.set(key, timestamps);

    if (timestamps.length >= 10) {
      this.failureWindow.set(key, []); // reset window
      await this.autoCreateIncident({
        title: `High queue failure rate: ${queue}`,
        severity: 'SEV2',
        affectedServices: [queue],
        source: 'event-bus',
        description: `> 10 job failures in the last 5 minutes on queue "${queue}"`,
        metadata: { queue, failureCount: timestamps.length },
      });
    }
  }

  private async handleRecurringPaymentFailure(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const key = 'payment:failures';
    const windowMs = 5 * 60 * 1000;
    const now = Date.now();

    const timestamps = (this.failureWindow.get(key) ?? []).filter(
      (t) => now - t < windowMs,
    );
    timestamps.push(now);
    this.failureWindow.set(key, timestamps);

    if (timestamps.length >= 3) {
      this.failureWindow.set(key, []);
      await this.autoCreateIncident({
        title: 'Recurring payment failures',
        severity: 'SEV1',
        affectedServices: ['payments', 'stripe'],
        source: 'event-bus',
        description: 'Multiple payment failures detected in short window',
        metadata: { ...payload, failureCount: timestamps.length },
      });
    }
  }

  /**
   * Auto-create an incident only if no open incident with same affected services
   * exists in the last 30 minutes (deduplication).
   */
  private async autoCreateIncident(input: CreateIncidentInput): Promise<void> {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await this.prisma.incident.findFirst({
      where: {
        status: { in: ['open', 'investigating', 'mitigating'] },
        affectedServices: { hasSome: input.affectedServices },
        startedAt: { gte: since },
      },
    });

    if (existing) {
      await this.addEvent(
        existing.id,
        'auto_correlated',
        `Auto-correlated event: ${input.title}`,
        input.metadata,
      );
      return;
    }

    await this.createIncident(input);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Auto-create a SEV0 incident (complete system outage or financial data corruption).
   * Logs a CRITICAL-prefixed error, then delegates to autoCreateIncident for
   * deduplication before persisting. Emits 'incident.sev0_created' after creation.
   * Errors are never propagated — callers must not crash on SEV0 creation failure.
   */
  async autoCreateSev0Incident(
    title: string,
    affectedServices: string[],
  ): Promise<void> {
    this.logger.error(
      `CRITICAL [SEV0] ${title} — affected: ${affectedServices.join(', ')}`,
    );

    try {
      await this.autoCreateIncident({
        title,
        severity: 'SEV0',
        affectedServices,
        source: 'event-bus',
        description: `SEV0 auto-created: ${title}`,
      });

      this.eventBus.emit('incident.sev0_created', {
        title,
        affectedServices,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist SEV0 incident "${title}"`,
        (err as Error).stack,
      );
    }
  }

  async createIncident(input: CreateIncidentInput): Promise<unknown> {
    const incident = await this.prisma.incident.create({
      data: {
        title: input.title,
        severity: input.severity,
        affectedServices: input.affectedServices,
        description: input.description ?? null,
        source: input.source ?? 'manual',
        tenantId: input.tenantId ?? null,
        blastRadius: input.blastRadius ?? 'unknown',
        metadata: (input.metadata ?? {}) as object,
        status: 'open',
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'created',
        message: `Incident created: ${input.title}`,
        metadata: { severity: input.severity, source: input.source ?? 'manual' } as object,
      },
    });

    this.logger.warn(
      `Incident created [${incident.severity}] ${incident.id}: ${incident.title}`,
    );
    return incident;
  }

  async updateStatus(
    id: string,
    status: IncidentStatus,
    actor?: string,
  ): Promise<unknown> {
    const now = new Date();
    const existing = await this.prisma.incident.findUniqueOrThrow({ where: { id } });

    const resolvedAt = status === 'resolved' ? now : undefined;
    const mitigatedAt = status === 'mitigating' ? now : undefined;
    let mttrMinutes: number | undefined;

    if (status === 'resolved') {
      mttrMinutes = Math.round(
        (now.getTime() - new Date(existing.startedAt).getTime()) / 60000,
      );
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status,
        ...(resolvedAt ? { resolvedAt, resolvedBy: actor } : {}),
        ...(mitigatedAt ? { mitigatedAt } : {}),
        ...(mttrMinutes !== undefined ? { mttrMinutes } : {}),
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: id,
        eventType: 'status_changed',
        actor: actor ?? null,
        message: `Status changed to ${status}`,
        metadata: { previousStatus: existing.status, newStatus: status, mttrMinutes } as object,
      },
    });

    return updated;
  }

  async addEvent(
    incidentId: string,
    eventType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.prisma.incidentEvent.create({
      data: {
        incidentId,
        eventType,
        message,
        metadata: (metadata ?? {}) as object,
      },
    });
  }

  async getIncidents(filters: IncidentFilters): Promise<unknown[]> {
    return this.prisma.incident.findMany({
      where: {
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      include: { timeline: { orderBy: { occurredAt: 'asc' } } },
      orderBy: { startedAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async getIncidentById(id: string): Promise<unknown> {
    return this.prisma.incident.findUniqueOrThrow({
      where: { id },
      include: { timeline: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  async getStats(): Promise<Record<string, number>> {
    const severities: IncidentSeverity[] = ['SEV0', 'SEV1', 'SEV2', 'SEV3', 'SEV4'];
    const results = await Promise.all(
      severities.map((sev) =>
        this.prisma.incident.count({
          where: { severity: sev, status: { in: ['open', 'investigating', 'mitigating'] } },
        }),
      ),
    );
    return Object.fromEntries(
      severities.map((sev, i) => [sev, results[i]]),
    );
  }

  async autoGroupIncidents(): Promise<void> {
    const windowMs = 30 * 60 * 1000;
    const since = new Date(Date.now() - windowMs);

    const openIncidents = await this.prisma.incident.findMany({
      where: {
        status: { in: ['open', 'investigating'] },
        startedAt: { gte: since },
      },
      orderBy: { startedAt: 'asc' },
    });

    // Group by overlapping affectedServices
    const grouped = new Map<string, string[]>();
    for (const inc of openIncidents) {
      const key = [...inc.affectedServices].sort().join(',');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(inc.id);
    }

    for (const [, ids] of grouped) {
      if (ids.length > 1) {
        const primary = ids[0];
        for (const id of ids.slice(1)) {
          await this.addEvent(
            primary,
            'grouped',
            `Auto-grouped incident ${id} into this incident`,
          );
          await this.updateStatus(id, 'closed', 'system:auto-group');
        }
      }
    }
  }
}
