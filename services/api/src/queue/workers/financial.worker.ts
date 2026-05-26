import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';

interface FinancialAggregationJobData {
  tenantId: string;
  period: string; // e.g. '2026-05'
}

interface InvoiceLifecycleJobData {
  invoiceId: string;
  tenantId: string;
  event: 'created' | 'sent' | 'paid' | 'overdue' | 'disputed';
}

/**
 * Financial Aggregation + Invoice Lifecycle Workers
 *
 * Aggregation: rolls up spend, margin, savings for a tenant/period.
 * Invoice: drives the invoice state machine (created→sent→paid|overdue|disputed).
 */
@Injectable()
export class FinancialWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinancialWorker.name);
  private aggregationWorker: Worker;
  private invoiceWorker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
  ) {}

  onModuleInit(): void {
    // ── Financial aggregation ─────────────────────────────────────────────
    this.aggregationWorker = new Worker(
      QUEUE_NAMES.FINANCIAL_AGGREGATION,
      async (job: Job<FinancialAggregationJobData>) => this.processAggregation(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 2, // Heavy DB work — keep low
      },
    );

    this.aggregationWorker.on('completed', (job) => {
      this.logger.log(`Financial aggregation done: tenant=${job.data.tenantId} period=${job.data.period}`);
    });

    this.aggregationWorker.on('failed', async (job, err) => {
      this.logger.error(`Financial aggregation failed: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.FINANCIAL_AGGREGATION,
          originalJobName: 'aggregate',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    // ── Invoice lifecycle ─────────────────────────────────────────────────
    this.invoiceWorker = new Worker(
      QUEUE_NAMES.INVOICE_LIFECYCLE,
      async (job: Job<InvoiceLifecycleJobData>) => this.processInvoiceEvent(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 10,
      },
    );

    this.invoiceWorker.on('completed', (job) => {
      this.logger.debug(`Invoice event processed: ${job.data.invoiceId} → ${job.data.event}`);
    });

    this.invoiceWorker.on('failed', async (job, err) => {
      this.logger.error(`Invoice lifecycle failed [${job?.data?.invoiceId}]: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.INVOICE_LIFECYCLE,
          originalJobName: 'invoice-event',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    this.logger.log('Financial workers started (aggregation + invoice lifecycle)');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.aggregationWorker?.close(),
      this.invoiceWorker?.close(),
    ]);
  }

  private async processAggregation(job: Job<FinancialAggregationJobData>): Promise<void> {
    const { tenantId, period } = job.data;
    this.logger.debug(`Aggregating financials: tenant=${tenantId} period=${period}`);

    // ── Implement in FinancialModule ──────────────────────────────────────
    // await this.financialService.aggregatePeriod(tenantId, period);
    // Writes: total_spend, total_savings, margin_avg, savings_rate to FinancialPeriod table
    this.logger.log(`[FINANCIAL_AGGREGATION] tenant=${tenantId} period=${period}`);
  }

  private async processInvoiceEvent(job: Job<InvoiceLifecycleJobData>): Promise<void> {
    const { invoiceId, tenantId, event } = job.data;
    this.logger.debug(`Invoice event: ${invoiceId} → ${event}`);

    // ── State machine: drive invoice through lifecycle ────────────────────
    // switch (event) {
    //   case 'created':  await this.invoiceService.onCreated(invoiceId, tenantId); break;
    //   case 'sent':     await this.invoiceService.onSent(invoiceId); break;
    //   case 'paid':     await this.invoiceService.onPaid(invoiceId); break;
    //   case 'overdue':  await this.invoiceService.onOverdue(invoiceId); break;
    //   case 'disputed': await this.invoiceService.onDisputed(invoiceId); break;
    // }
    this.logger.log(`[INVOICE] id=${invoiceId} event=${event} tenant=${tenantId}`);
  }
}
