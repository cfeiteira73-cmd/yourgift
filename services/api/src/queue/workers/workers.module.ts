import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailWorker } from './email.worker';
import { PdfWorker } from './pdf.worker';
import { SupplierSyncWorker } from './supplier-sync.worker';
import { FinancialWorker } from './financial.worker';
import { NotificationsModule } from '../../notifications/notifications.module';

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
 */
@Module({
  imports: [ConfigModule, NotificationsModule],
  providers: [
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
