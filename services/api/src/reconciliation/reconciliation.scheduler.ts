import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReconciliationService } from './reconciliation.service';

// How long a lock is considered valid before it can be stolen by another replica.
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  private hourlyTimer: NodeJS.Timeout | null = null;
  private nightlyTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
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
      'ReconciliationScheduler initialised — hourly every 60 min, nightly every 24 h (with distributed lock)',
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
   * Acquires a DB-level distributed lock for the given lockKey.
   * Returns true if this replica won the lock (should proceed).
   * Returns false if another replica already holds it.
   *
   * Uses the EventLog table (always present) to store lock state.
   * Lock TTL prevents permanent hold if a replica crashes mid-run.
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
    const now = new Date();
    const ttlThreshold = new Date(now.getTime() - LOCK_TTL_MS);

    try {
      // Check if a live (non-expired) lock already exists
      const existing = await this.prisma.eventLog.findFirst({
        where: {
          event: `scheduler.lock.${lockKey}`,
          createdAt: { gt: ttlThreshold },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        this.logger.debug(`Lock held by another replica: ${lockKey}`);
        return false;
      }

      // Create new lock
      await this.prisma.eventLog.create({
        data: {
          event: `scheduler.lock.${lockKey}`,
          entity: 'scheduler',
          entityId: lockKey,
          actorType: 'system',
          payload: { acquiredAt: now.toISOString(), pid: process.pid },
        },
      });

      return true;
    } catch (err) {
      // If lock acquisition fails, default to running (single-replica safety)
      this.logger.warn(`Lock acquisition error for ${lockKey}, proceeding anyway: ${(err as Error).message}`);
      return true;
    }
  }

  /**
   * Runs every hour.
   * Uses distributed lock so only one replica runs per interval.
   */
  async runHourlyReconciliation(): Promise<void> {
    const locked = await this.acquireLock('reconciliation.hourly');
    if (!locked) return;

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
   * Runs nightly.
   * Uses distributed lock so only one replica runs per interval.
   */
  async runNightlyReconciliation(): Promise<void> {
    const locked = await this.acquireLock('reconciliation.nightly');
    if (!locked) return;

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
