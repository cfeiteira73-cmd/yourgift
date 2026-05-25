import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { ReconciliationService } from './reconciliation.service';

@Injectable()
export class ReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  private hourlyTimer: NodeJS.Timeout | null = null;
  private nightlyTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.hourlyTimer = setInterval(
      () => {
        this.runHourlyReconciliation().catch((err: Error) => {
          this.logger.error('Unhandled error in hourly reconciliation interval', err.stack);
        });
      },
      60 * 60 * 1000,
    );

    this.nightlyTimer = setInterval(
      () => {
        this.runNightlyReconciliation().catch((err: Error) => {
          this.logger.error('Unhandled error in nightly reconciliation interval', err.stack);
        });
      },
      24 * 60 * 60 * 1000,
    );

    this.logger.log(
      'ReconciliationScheduler initialised — hourly every 60 min, nightly every 24 h',
    );
  }

  onModuleDestroy(): void {
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
      this.hourlyTimer = null;
    }
    if (this.nightlyTimer) {
      clearInterval(this.nightlyTimer);
      this.nightlyTimer = null;
    }
  }

  /**
   * Runs every hour.
   * Calls getDriftStatus() and emits 'reconciliation.hourly_complete'.
   * Errors are caught and logged — never crash the process.
   */
  async runHourlyReconciliation(): Promise<void> {
    this.logger.log('Starting hourly reconciliation drift check');
    try {
      const results = await this.reconciliationService.getDriftStatus();

      const criticalCount = results.filter((r) => r.status === 'critical').length;
      const warningCount = results.filter((r) => r.status === 'warning').length;

      this.logger.log(
        `Hourly reconciliation complete — tenants: ${results.length}, critical: ${criticalCount}, warning: ${warningCount}`,
      );

      this.eventBus.emit('reconciliation.hourly_complete', {
        tenants: results.length,
        criticalCount,
        warningCount,
        results,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        'Hourly reconciliation drift check failed',
        (err as Error).stack,
      );
    }
  }

  /**
   * Runs nightly at approximately 02:00 (offset from startup; for exact 02:00
   * scheduling upgrade to @nestjs/schedule with @Cron('0 2 * * *')).
   * Calls getDriftStatus() for all tenants and emits 'reconciliation.nightly_complete'.
   * Errors are caught and logged — never crash the process.
   */
  async runNightlyReconciliation(): Promise<void> {
    this.logger.log('Starting nightly full reconciliation drift check');
    try {
      const results = await this.reconciliationService.getDriftStatus();

      const criticalCount = results.filter((r) => r.status === 'critical').length;
      const warningCount = results.filter((r) => r.status === 'warning').length;
      const cleanCount = results.filter((r) => r.status === 'clean').length;

      this.logger.log(
        `Nightly reconciliation complete — tenants: ${results.length}, critical: ${criticalCount}, warning: ${warningCount}, clean: ${cleanCount}`,
      );

      this.eventBus.emit('reconciliation.nightly_complete', {
        tenants: results.length,
        criticalCount,
        warningCount,
        cleanCount,
        results,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        'Nightly reconciliation drift check failed',
        (err as Error).stack,
      );
    }
  }
}
