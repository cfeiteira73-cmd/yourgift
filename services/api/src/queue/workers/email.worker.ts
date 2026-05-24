import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';
import { EmailJobData } from '../queue.service';

/**
 * Email Worker
 *
 * Processes jobs from the 'email' queue.
 * Delegates to NotificationsModule / Resend — kept here as a thin processor.
 *
 * Extend processEmail() to call your actual email service (Resend, SES, etc).
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job: Job<EmailJobData>) => this.processEmail(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Email sent: job ${job.id} → ${JSON.stringify(job.data.to)}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Email job ${job?.id} failed: ${err.message}`);
      // On final failure (no more retries), send to DLQ
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.EMAIL,
          originalJobName: job?.name ?? 'send-email',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    this.logger.log('Email worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, variables, from, replyTo } = job.data;

    this.logger.debug(`Processing email job ${job.id}: ${subject} → ${JSON.stringify(to)}`);

    // ── Delegate to your actual email service here ────────────────────────
    // Example: await this.resendService.send({ to, from, subject, html });
    //
    // For now: structured log so you can see the job is being processed
    this.logger.log(`[EMAIL] to=${JSON.stringify(to)} subject="${subject}" template=${template}`);
    // TODO: inject NotificationsService or ResendService and call send()
  }
}
