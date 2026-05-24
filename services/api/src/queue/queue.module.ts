import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue, Worker, QueueEvents, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES, QUEUE_RETRY_CONFIG, QueueName } from './queue.constants';
import { QueueService } from './queue.service';
import { DlqService } from './dlq.service';

/**
 * Factory token for the Redis connection shared across all queues.
 */
export const REDIS_CONNECTION = 'REDIS_CONNECTION';

/**
 * Factory function: returns BullMQ ConnectionOptions from env vars.
 * Supports both standard Redis (REDIS_URL) and Upstash (UPSTASH_REDIS_URL).
 */
function buildRedisConnection(configService: ConfigService): ConnectionOptions {
  const url =
    configService.get<string>('UPSTASH_REDIS_URL') ??
    configService.get<string>('REDIS_URL') ??
    'redis://localhost:6379';

  // Upstash uses TLS — detect by protocol
  if (url.startsWith('rediss://')) {
    return { url, tls: { rejectUnauthorized: false } } as ConnectionOptions;
  }

  return { url } as ConnectionOptions;
}

/**
 * Create all named queues as providers.
 */
const queueProviders = (Object.values(QUEUE_NAMES) as QueueName[]).map((name) => ({
  provide: `QUEUE_${name.toUpperCase().replace(/-/g, '_')}`,
  inject: [REDIS_CONNECTION],
  useFactory: (connection: ConnectionOptions) => {
    const retryKey = getRetryKey(name);
    const retry = QUEUE_RETRY_CONFIG[retryKey];
    return new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: retry.attempts,
        backoff: retry.backoff,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  },
}));

function getRetryKey(name: string): keyof typeof QUEUE_RETRY_CONFIG {
  if (name.includes('email') || name.includes('notification')) return 'email';
  if (name.includes('ai')) return 'ai';
  if (name.includes('procurement')) return 'procurement';
  if (name.includes('sync')) return 'sync';
  if (name.includes('financial') || name.includes('invoice')) return 'financial';
  if (name.includes('report') || name.includes('pdf') || name.includes('benchmark')) return 'report';
  return 'default';
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ConnectionOptions =>
        buildRedisConnection(configService),
    },
    ...queueProviders,
    QueueService,
    DlqService,
  ],
  exports: [
    REDIS_CONNECTION,
    QueueService,
    DlqService,
    ...queueProviders.map((p) => p.provide),
  ],
})
export class QueueModule {}
