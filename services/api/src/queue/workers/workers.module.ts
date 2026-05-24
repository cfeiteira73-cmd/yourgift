import { Module } from '@nestjs/common';
import { EmailWorker } from './email.worker';
import { PdfWorker } from './pdf.worker';
import { SupplierSyncWorker } from './supplier-sync.worker';
import { FinancialWorker } from './financial.worker';

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
