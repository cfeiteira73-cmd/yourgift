import { Injectable, Inject, Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Dead Letter Queue Service
 *
 * Handles failed jobs that exhausted all retry attempts.
 * Provides replay capabilities for operational recovery.
 */
@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @Inject(`QUEUE_${QUEUE_NAMES.DLQ.toUpperCase().replace(/-/g, '_')}`)
    private readonly dlqQueue: Queue,

    @Inject(`QUEUE_${QUEUE_NAMES.DLQ_REPLAY.toUpperCase().replace(/-/g, '_')}`)
    private readonly replayQueue: Queue,
  ) {}

  /**
   * Send a failed job to the DLQ for manual inspection and replay.
   */
  async capture(params: {
    originalQueue: string;
    originalJobName: string;
    data: unknown;
    error: Error;
    jobId?: string;
  }): Promise<void> {
    const { originalQueue, originalJobName, data, error, jobId } = params;

    try {
      await this.dlqQueue.add('captured-failure', {
        originalQueue,
        originalJobName,
        jobId,
        data,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        capturedAt: new Date().toISOString(),
        status: 'pending-review',
      });

      this.logger.warn(
        `DLQ captured: [${originalQueue}] ${originalJobName} (jobId=${jobId ?? 'n/a'}) — ${error.message}`,
      );
    } catch (dlqErr) {
      this.logger.error(`Failed to write to DLQ: ${(dlqErr as Error).message}`);
    }
  }

  /**
   * List all items in the DLQ.
   */
  async list(limit = 50): Promise<DlqItem[]> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'failed'], 0, limit);
    return jobs.map((job) => ({
      id: job.id ?? 'unknown',
      ...job.data as Omit<DlqItem, 'id'>,
    }));
  }

  /**
   * Replay a specific DLQ item by re-enqueuing it to its original queue.
   * Used for operational recovery after bug fixes.
   */
  async replay(dlqJobId: string): Promise<void> {
    const job = await Job.fromId(this.dlqQueue, dlqJobId);
    if (!job) throw new Error(`DLQ job ${dlqJobId} not found`);

    await this.replayQueue.add('replay', {
      ...job.data,
      replayedAt: new Date().toISOString(),
      replaySource: 'manual',
    });

    // Mark as replayed in DLQ
    await job.updateData({ ...job.data, status: 'replayed', replayedAt: new Date().toISOString() });

    this.logger.log(`DLQ replay initiated for job ${dlqJobId} → queue: ${(job.data as DlqItem).originalQueue}`);
  }

  /**
   * Replay all pending DLQ items for a specific original queue.
   */
  async replayQueue_byOriginal(originalQueue: string): Promise<number> {
    const jobs = await this.dlqQueue.getJobs(['waiting']);
    const targets = jobs.filter((j) => (j.data as DlqItem).originalQueue === originalQueue);

    await Promise.allSettled(targets.map((j) => this.replay(j.id ?? '')));

    this.logger.log(`Replayed ${targets.length} DLQ items for queue: ${originalQueue}`);
    return targets.length;
  }
}

export interface DlqItem {
  id: string;
  originalQueue: string;
  originalJobName: string;
  jobId?: string;
  data: unknown;
  error: { name: string; message: string; stack?: string };
  capturedAt: string;
  status: 'pending-review' | 'replayed' | 'dismissed';
  replayedAt?: string;
}
