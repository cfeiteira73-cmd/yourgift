import { Module } from '@nestjs/common';
import { EmailWorker } from './email.worker';
import { PdfWorker } from './pdf.worker';
import { SupplierSyncWorker } from './supplier-sync.worker';
import { FinancialWorker } from './financial.worker';
import { NotificationsModule } from '../../notifications/notifications.module';
import { QueueModule } from '../queue.module';

/**
 * WorkersModule
 *
 * Aggregates all BullMQ workers.
 * Imported in AppModule so workers start after QueueModule is fully ready.
 *
 * QueueModule is @Global() and exports REDIS_CONNECTION + DlqService,
 * so they are available here without any circular dependency.
 */
@Module({
  imports: [NotificationsModule, QueueModule],
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
