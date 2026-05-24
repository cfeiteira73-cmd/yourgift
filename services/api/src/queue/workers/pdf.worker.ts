import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';
import { PdfJobData } from '../queue.service';

/**
 * PDF Generation Worker
 *
 * Processes jobs from the 'pdf-generation' queue.
 * Generates PDFs for invoices, ROI reports, procurement scorecards.
 */
@Injectable()
export class PdfWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.PDF_GENERATION,
      async (job: Job<PdfJobData>) => this.processPdf(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 2, // PDFs are CPU-intensive
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`PDF generated: job ${job.id} type=${job.data.type} entity=${job.data.entityId}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`PDF job ${job?.id} failed: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.PDF_GENERATION,
          originalJobName: job?.name ?? 'generate-pdf',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    this.logger.log('PDF worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processPdf(job: Job<PdfJobData>): Promise<void> {
    const { type, tenantId, entityId, outputPath } = job.data;

    this.logger.debug(`Generating PDF: type=${type} entity=${entityId} tenant=${tenantId}`);

    // ── PDF generation logic ──────────────────────────────────────────────
    // Example:
    // const html = await this.templatesService.render(type, { tenantId, entityId });
    // const buffer = await this.puppeteerService.htmlToPdf(html);
    // await this.s3Service.upload(`${outputPath ?? `pdfs/${tenantId}/${entityId}`}.pdf`, buffer);

    this.logger.log(`[PDF] type=${type} tenant=${tenantId} entity=${entityId} path=${outputPath ?? 'auto'}`);
    // TODO: inject PuppeteerService / PdfService and generate
  }
}
