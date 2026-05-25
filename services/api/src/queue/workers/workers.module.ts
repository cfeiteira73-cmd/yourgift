import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionOptions } from 'bullmq';
import { EmailWorker } from './email.worker';
import { PdfWorker } from './pdf.worker';
import { SupplierSyncWorker } from './supplier-sync.worker';
import { FinancialWorker } from './financial.worker';
import { NotificationsModule } from '../../notifications/notifications.module';
import { QueueModule, REDIS_CONNECTION } from '../queue.module';

/**
 * WorkersModule
 *
 * Aggregates all BullMQ workers.
 * Import in QueueModule (or AppModule) to start all background processors.
 *
 * Each worker:
 *  - Starts on module init, shuts down gracefully on module destroy
 *  - Sends exhausted jobs to DLQ via DlqService
 *  - Uses prefix '{yourgift}' to stay isolated on shared Redis
 *
 * forwardRef breaks circular: QueueModule↔WorkersModule
 * (QueueModule provides DlqService which workers need)
 *
 * REDIS_CONNECTION is re-provided directly here via ConfigService to avoid a
 * custom-token resolution ordering failure that occurs when @Global() +
 * forwardRef() are combined — NestJS resolves the string token too late in
 * the circular boot sequence, causing "can't resolve dependencies at index [0]".
 */
@Module({
  imports: [ConfigModule, NotificationsModule, forwardRef(() => QueueModule)],
  providers: [
    // Re-provide REDIS_CONNECTION locally so the string token is available
    // immediately, without waiting for the forwardRef circular resolution.
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ConnectionOptions => {
        const url =
          config.get<string>('UPSTASH_REDIS_URL') ??
          config.get<string>('REDIS_URL') ??
          'redis://localhost:6379';
        return url.startsWith('rediss://')
          ? ({ url, tls: { rejectUnauthorized: false } } as ConnectionOptions)
          : ({ url } as ConnectionOptions);
      },
    },
    EmailWorker,
    PdfWorker,
    SupplierSyncWorker,
    FinancialWorker,
  ],
  exports: [
    EmailWorker,
    PdfWorker,
    SupplierSyncWorker,
    FinancialWorker,
  ],
})
export class WorkersModule {}
