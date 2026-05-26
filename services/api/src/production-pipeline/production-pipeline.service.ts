import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, ProductionJob, Artwork } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

export interface ProductionJobCreateInput {
  orderId: string;
  priority?: number;
  provider?: string;
  slaHours?: number;
  notes?: string;
}

export interface ProductionJobSummary {
  id: string;
  orderId: string;
  status: string;
  priority: number;
  provider: string | null;
  slaHours: number;
  retryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  slaDeadline: Date;
  slaBreached: boolean;
  order?: {
    ref: string;
    clientId: string;
    totalAmount: number | null;
  };
}

@Injectable()
export class ProductionPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async createProductionJob(input: ProductionJobCreateInput): Promise<ProductionJob> {
    const baseKey = `prod-${input.orderId}`;

    // Check for existing job with base idempotency key
    const existingJob = await this.prisma.productionJob.findFirst({
      where: { idempotencyKey: baseKey },
    });

    if (existingJob) {
      if (existingJob.status === 'completed' || existingJob.status === 'in_production') {
        throw new ConflictException('Production already running for this order');
      }
    }

    // Verify order exists and is paid
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }

    if (order.status !== 'paid') {
      throw new BadRequestException(
        `Order ${input.orderId} is not in 'paid' status (current: ${order.status})`,
      );
    }

    // Determine idempotency key
    let idempotencyKey = baseKey;
    if (existingJob && (existingJob.status === 'failed' || existingJob.status === 'cancelled')) {
      idempotencyKey = `prod-${input.orderId}-retry-${Date.now()}`;
    }

    const job = await this.prisma.productionJob.create({
      data: {
        orderId: input.orderId,
        idempotencyKey,
        status: 'queued',
        priority: input.priority ?? 5,
        provider: input.provider ?? null,
        slaHours: input.slaHours ?? 48,
        notes: input.notes ?? null,
        metadata: {},
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: job.id,
        event: 'production_job.queued',
        orderId: input.orderId,
        payload: { priority: job.priority, provider: job.provider } as object,
      },
    });

    this.eventBus.emit('production.job.queued', { jobId: job.id, orderId: input.orderId });

    return job;
  }

  async startJob(jobId: string): Promise<ProductionJob> {
    const job = await this.prisma.productionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }

    if (job.status !== 'queued' && job.status !== 'requeued') {
      throw new BadRequestException(
        `Job ${jobId} cannot be started from status '${job.status}'. Expected 'queued' or 'requeued'.`,
      );
    }

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        status: 'in_production',
        startedAt: new Date(),
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'production_job.started',
        orderId: job.orderId,
        payload: { previousStatus: job.status } as object,
      },
    });

    this.eventBus.emit('production.job.started', { jobId, orderId: job.orderId });

    return updated;
  }

  async completeJob(jobId: string, externalJobId?: string, notes?: string): Promise<ProductionJob> {
    const job = await this.prisma.productionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }

    if (job.status !== 'in_production') {
      throw new BadRequestException(
        `Job ${jobId} cannot be completed from status '${job.status}'. Expected 'in_production'.`,
      );
    }

    const updateData: Prisma.ProductionJobUpdateInput = {
      status: 'completed',
      completedAt: new Date(),
    };

    if (externalJobId !== undefined) {
      updateData.externalJobId = externalJobId;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: updateData,
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'production_job.completed',
        orderId: job.orderId,
        payload: { externalJobId: externalJobId ?? null, notes: notes ?? null } as object,
      },
    });

    this.eventBus.emit('production.job.completed', { jobId, orderId: job.orderId });

    return updated;
  }

  async failJob(jobId: string, reason: string): Promise<ProductionJob> {
    const job = await this.prisma.productionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        notes: reason,
        retryCount: { increment: 1 },
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'production_job.failed',
        orderId: job.orderId,
        payload: { reason } as object,
      },
    });

    this.eventBus.emit('production.job.failed', { jobId, orderId: job.orderId, reason });

    return updated;
  }

  async requeueJob(jobId: string, priority?: number): Promise<ProductionJob> {
    const job = await this.prisma.productionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`ProductionJob ${jobId} not found`);
    }

    if (job.status !== 'failed') {
      throw new BadRequestException(
        `Job ${jobId} cannot be requeued from status '${job.status}'. Expected 'failed'.`,
      );
    }

    const newRetryCount = job.retryCount + 1;
    const newKey = `prod-${job.orderId}-retry-${newRetryCount}`;

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        status: 'requeued',
        failedAt: null,
        notes: null,
        priority: priority ?? job.priority,
        idempotencyKey: newKey,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'production_job',
        entityId: jobId,
        event: 'production_job.requeued',
        orderId: job.orderId,
        payload: { newKey, priority: updated.priority } as object,
      },
    });

    this.eventBus.emit('production.job.requeued', { jobId, orderId: job.orderId });

    return updated;
  }

  async getQueue(status?: string): Promise<ProductionJobSummary[]> {
    const where: Prisma.ProductionJobWhereInput = status
      ? { status }
      : { status: { in: ['queued', 'requeued', 'in_production'] } };

    const jobs = await this.prisma.productionJob.findMany({
      where,
      include: {
        order: {
          select: {
            ref: true,
            clientId: true,
            totalAmount: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    return jobs.map((job) => {
      const slaDeadline = new Date(job.createdAt.getTime() + job.slaHours * 3_600_000);
      const slaBreached =
        Date.now() > slaDeadline.getTime() &&
        !['completed', 'cancelled'].includes(job.status);

      return {
        id: job.id,
        orderId: job.orderId,
        status: job.status,
        priority: job.priority,
        provider: job.provider,
        slaHours: job.slaHours,
        retryCount: job.retryCount,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        slaDeadline,
        slaBreached,
        order: job.order,
      };
    });
  }

  async getJobById(jobId: string): Promise<ProductionJob & { order: object }> {
    return this.prisma.productionJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { order: true },
    }) as Promise<ProductionJob & { order: object }>;
  }

  async validateArtworkForProduction(
    orderId: string,
  ): Promise<{ ready: boolean; artworks: Artwork[]; issues: string[] }> {
    const artworks = await this.prisma.artwork.findMany({ where: { orderId } });

    const issues: string[] = [];

    if (artworks.length === 0) {
      issues.push('No artwork uploaded');
    } else {
      for (const artwork of artworks) {
        if (artwork.status !== 'approved') {
          issues.push(`Artwork not yet approved: ${artwork.filename}`);
        }
      }
    }

    return {
      ready: issues.length === 0,
      artworks,
      issues,
    };
  }
}
