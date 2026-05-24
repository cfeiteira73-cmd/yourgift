import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';
import { EmailJobData } from '../queue.service';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Email Worker
 *
 * Processes jobs from the 'email' queue.
 * Delegates to NotificationsService → Resend REST API.
 *
 * Job shape: EmailJobData
 *   to        — recipient or array of recipients
 *   subject   — email subject
 *   template  — template name (used to build branded HTML)
 *   variables — key-value pairs injected into the email body
 *   from?     — override from address
 *   replyTo?  — reply-to header
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
    private readonly notifications: NotificationsService,
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
    const { to, subject, template, variables, from } = job.data;

    this.logger.debug(`Processing email job ${job.id}: ${subject} → ${JSON.stringify(to)}`);

    await this.notifications.sendFromTemplate(to, subject, template, variables, from);

    this.logger.log(`Email delivered: job=${job.id} template=${template} to=${JSON.stringify(to)}`);
  }
}
