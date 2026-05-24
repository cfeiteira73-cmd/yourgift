import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';

interface SupplierSyncJobData {
  supplier: string;
}

interface ShippingSyncJobData {
  carrierId: string;
}

/**
 * Supplier & Shipping Sync Workers
 *
 * Processes catalog sync for Midocean, PF Concept, etc.
 * Shipping sync for DHL, DPD, GLS, UPS, FedEx.
 */
@Injectable()
export class SupplierSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplierSyncWorker.name);
  private supplierWorker: Worker;
  private shippingWorker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
  ) {}

  onModuleInit(): void {
    // ── Supplier catalog sync ─────────────────────────────────────────────
    this.supplierWorker = new Worker(
      QUEUE_NAMES.SUPPLIER_SYNC,
      async (job: Job<SupplierSyncJobData>) => this.processSupplierSync(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 3,
        limiter: { max: 10, duration: 60_000 }, // 10 syncs/min rate limit
      },
    );

    this.supplierWorker.on('completed', (job) => {
      this.logger.log(`Supplier sync complete: ${job.data.supplier} (job ${job.id})`);
    });

    this.supplierWorker.on('failed', async (job, err) => {
      this.logger.error(`Supplier sync failed [${job?.data?.supplier}]: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.SUPPLIER_SYNC,
          originalJobName: job?.name ?? 'sync-supplier',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    // ── Shipping / carrier sync ───────────────────────────────────────────
    this.shippingWorker = new Worker(
      QUEUE_NAMES.SHIPPING_SYNC,
      async (job: Job<ShippingSyncJobData>) => this.processShippingSync(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 5,
      },
    );

    this.shippingWorker.on('completed', (job) => {
      this.logger.log(`Shipping sync complete: carrier=${job.data.carrierId}`);
    });

    this.shippingWorker.on('failed', async (job, err) => {
      this.logger.error(`Shipping sync failed [${job?.data?.carrierId}]: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.SHIPPING_SYNC,
          originalJobName: job?.name ?? 'sync-carrier',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    this.logger.log('Supplier + Shipping sync workers started');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.supplierWorker?.close(),
      this.shippingWorker?.close(),
    ]);
  }

  private async processSupplierSync(job: Job<SupplierSyncJobData>): Promise<void> {
    const { supplier } = job.data;
    this.logger.debug(`Syncing supplier catalog: ${supplier}`);

    // ── Implement per-supplier sync ───────────────────────────────────────
    // switch (supplier) {
    //   case 'midocean': await this.midoceanService.syncCatalog(); break;
    //   case 'pfconcept': await this.pfConceptService.syncCatalog(); break;
    //   default: throw new Error(`Unknown supplier: ${supplier}`);
    // }
    this.logger.log(`[SUPPLIER_SYNC] supplier=${supplier} — implement in SuppliersModule`);
  }

  private async processShippingSync(job: Job<ShippingSyncJobData>): Promise<void> {
    const { carrierId } = job.data;
    this.logger.debug(`Syncing shipping rates: carrier=${carrierId}`);

    // ── Implement per-carrier rate sync ───────────────────────────────────
    // switch (carrierId) {
    //   case 'dhl':   await this.dhlService.refreshRates(); break;
    //   case 'dpd':   await this.dpdService.refreshRates(); break;
    //   case 'ups':   await this.upsService.refreshRates(); break;
    //   case 'fedex': await this.fedexService.refreshRates(); break;
    //   default: throw new Error(`Unknown carrier: ${carrierId}`);
    // }
    this.logger.log(`[SHIPPING_SYNC] carrier=${carrierId} — implement in LogisticsModule`);
  }
}
