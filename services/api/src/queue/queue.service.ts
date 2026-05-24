import { Injectable, Inject, Logger } from '@nestjs/common';
import { Queue, Job, JobsOptions } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Central service for enqueuing jobs across all queues.
 * Provides a unified API with built-in logging and error handling.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(`QUEUE_${QUEUE_NAMES.EMAIL.toUpperCase().replace(/-/g, '_')}`)
    private readonly emailQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.AI_GENERATION.toUpperCase().replace(/-/g, '_')}`)
    private readonly aiGenerationQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.PROCUREMENT_WORKFLOW.toUpperCase().replace(/-/g, '_')}`)
    private readonly procurementWorkflowQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.SUPPLIER_SYNC.toUpperCase().replace(/-/g, '_')}`)
    private readonly supplierSyncQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.SHIPPING_SYNC.toUpperCase().replace(/-/g, '_')}`)
    private readonly shippingSyncQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.PDF_GENERATION.toUpperCase().replace(/-/g, '_')}`)
    private readonly pdfGenerationQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.FINANCIAL_AGGREGATION.toUpperCase().replace(/-/g, '_')}`)
    private readonly financialAggregationQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.DLQ.toUpperCase().replace(/-/g, '_')}`)
    private readonly dlqQueue: Queue,
  ) {}

  // ── Email ──────────────────────────────────────────────────────────────────

  async enqueueEmail(data: EmailJobData, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.emailQueue, 'send-email', data, opts);
  }

  async enqueueTransactionalEmail(data: EmailJobData): Promise<Job> {
    return this.enqueue(this.emailQueue, 'send-transactional', data, {
      priority: 1, // highest priority
    });
  }

  // ── AI ─────────────────────────────────────────────────────────────────────

  async enqueueAiGeneration(jobName: string, data: Record<string, unknown>, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.aiGenerationQueue, jobName, data, opts);
  }

  // ── Procurement ─────────────────────────────────────────────────────────────

  async enqueueProcurementWorkflow(data: ProcurementJobData, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.procurementWorkflowQueue, 'process-workflow', data, opts);
  }

  // ── Supplier Sync ───────────────────────────────────────────────────────────

  async enqueueSupplierSync(supplier: string, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.supplierSyncQueue, `sync-${supplier}`, { supplier }, {
      jobId: `supplier-sync-${supplier}-${Date.now()}`,
      ...opts,
    });
  }

  async enqueueShippingSync(carrierId: string, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.shippingSyncQueue, `sync-${carrierId}`, { carrierId }, opts);
  }

  // ── PDF & Reports ───────────────────────────────────────────────────────────

  async enqueuePdfGeneration(data: PdfJobData, opts?: JobsOptions): Promise<Job> {
    return this.enqueue(this.pdfGenerationQueue, 'generate-pdf', data, opts);
  }

  // ── Financial ──────────────────────────────────────────────────────────────

  async enqueueFinancialAggregation(tenantId: string, period: string): Promise<Job> {
    return this.enqueue(this.financialAggregationQueue, 'aggregate', { tenantId, period }, {
      jobId: `financial-${tenantId}-${period}`, // idempotent
    });
  }

  // ── DLQ ───────────────────────────────────────────────────────────────────

  async sendToDlq(originalQueue: string, originalJob: string, data: unknown, error: string): Promise<Job> {
    return this.enqueue(this.dlqQueue, 'dlq-item', {
      originalQueue,
      originalJob,
      data,
      error,
      failedAt: new Date().toISOString(),
    });
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async enqueue<T>(
    queue: Queue,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    try {
      const job = await queue.add(jobName, data, opts);
      this.logger.debug(`Enqueued [${queue.name}] ${jobName} → jobId=${job.id}`);
      return job;
    } catch (err) {
      this.logger.error(`Failed to enqueue [${queue.name}] ${jobName}: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Queue Stats (for monitoring endpoint) ────────────────────────────────

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queues: Record<string, Queue> = {
      [QUEUE_NAMES.EMAIL]: this.emailQueue,
      [QUEUE_NAMES.AI_GENERATION]: this.aiGenerationQueue,
      [QUEUE_NAMES.PROCUREMENT_WORKFLOW]: this.procurementWorkflowQueue,
      [QUEUE_NAMES.SUPPLIER_SYNC]: this.supplierSyncQueue,
      [QUEUE_NAMES.PDF_GENERATION]: this.pdfGenerationQueue,
      [QUEUE_NAMES.FINANCIAL_AGGREGATION]: this.financialAggregationQueue,
      [QUEUE_NAMES.DLQ]: this.dlqQueue,
    };

    const queue = queues[queueName];
    if (!queue) throw new Error(`Unknown queue: ${queueName}`);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { name: queueName, waiting, active, completed, failed, delayed };
  }

  async getAllQueueStats(): Promise<QueueStats[]> {
    const names = [
      QUEUE_NAMES.EMAIL,
      QUEUE_NAMES.AI_GENERATION,
      QUEUE_NAMES.PROCUREMENT_WORKFLOW,
      QUEUE_NAMES.SUPPLIER_SYNC,
      QUEUE_NAMES.PDF_GENERATION,
      QUEUE_NAMES.FINANCIAL_AGGREGATION,
      QUEUE_NAMES.DLQ,
    ];

    return Promise.all(names.map((n) => this.getQueueStats(n)));
  }
}

// ── Job Data Types ──────────────────────────────────────────────────────────

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  variables: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  tenantId?: string;
}

export interface ProcurementJobData {
  workflowId: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface PdfJobData {
  type: 'roi-report' | 'benchmark-report' | 'invoice' | 'procurement-scorecard';
  tenantId: string;
  entityId: string;
  outputPath?: string;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
