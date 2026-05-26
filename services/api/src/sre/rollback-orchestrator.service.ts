import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MetricsService } from '../observability/metrics.service';
import { QueueService } from '../queue/queue.service';
import { EventBusService } from '../events/event-bus.service';
import { AutoRemediationService } from './auto-remediation.service';

export interface RollbackPlan {
  rollbackId: string;
  triggeredAt: Date;
  reason: string;
  targetVersion: string;
  steps: string[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  completedAt?: Date;
  errorMessage?: string;
}

const ROLLBACK_STEPS: string[] = [
  'pause-traffic',
  'verify-health',
  'switch-version',
  'run-migrations',
  'resume-traffic',
  'verify-recovery',
];

@Injectable()
export class RollbackOrchestratorService {
  private readonly logger = new Logger(RollbackOrchestratorService.name);
  private readonly plans = new Map<string, RollbackPlan>();

  constructor(
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
    private readonly autoRemediation: AutoRemediationService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Plan creation ─────────────────────────────────────────────────────────

  createRollbackPlan(reason: string, targetVersion: string): RollbackPlan {
    const rollbackId = `rollback-${Date.now()}`;
    const plan: RollbackPlan = {
      rollbackId,
      triggeredAt: new Date(),
      reason,
      targetVersion,
      steps: [...ROLLBACK_STEPS],
      status: 'pending',
    };

    this.plans.set(rollbackId, plan);
    this.logger.log(
      `[Rollback] Plan created rollbackId=${rollbackId} version=${targetVersion} reason="${reason}"`,
    );

    return plan;
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  async executeRollback(rollbackId: string): Promise<RollbackPlan> {
    const plan = this.plans.get(rollbackId);
    if (!plan) {
      throw new NotFoundException(`Rollback plan not found: ${rollbackId}`);
    }

    plan.status = 'executing';
    this.logger.log(`[Rollback] Executing plan ${rollbackId} — ${plan.steps.length} steps`);

    for (const step of plan.steps) {
      try {
        await this.executeStep(rollbackId, step);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        plan.status = 'failed';
        plan.errorMessage = `Step "${step}" failed: ${message}`;
        plan.completedAt = new Date();

        this.logger.error(
          `[Rollback] Plan ${rollbackId} FAILED at step "${step}": ${message}`,
        );

        this.eventBus.emit('sre.rollback_failed', {
          rollbackId,
          failedStep: step,
          reason: plan.reason,
          targetVersion: plan.targetVersion,
          errorMessage: plan.errorMessage,
        });

        return plan;
      }
    }

    plan.status = 'completed';
    plan.completedAt = new Date();

    this.logger.log(
      `[Rollback] Plan ${rollbackId} COMPLETED — version=${plan.targetVersion}`,
    );

    this.eventBus.emit('sre.rollback_completed', {
      rollbackId,
      targetVersion: plan.targetVersion,
      reason: plan.reason,
      completedAt: plan.completedAt,
    });

    return plan;
  }

  private async executeStep(rollbackId: string, step: string): Promise<void> {
    this.logger.log(`[Rollback] ${rollbackId} → executing step: ${step}`);
    // Simulated step execution — 100ms per step to represent real async work
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    this.logger.log(`[Rollback] ${rollbackId} → step complete: ${step}`);
  }

  // ── Deploy health validation ──────────────────────────────────────────────

  async validateDeployHealth(): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
    failedChecks: string[];
  }> {
    const [queueMetrics] = await Promise.all([this.queue.getQueueMetrics()]);

    const sloBreaches = this.metrics.getSloBreaches();
    const criticalBreaches = sloBreaches.filter((b) => b.severity === 'critical');

    const hasSloBreaches = criticalBreaches.length === 0;
    const hasNoQueueIssues = !queueMetrics.some((q) => q.status === 'critical');
    const isNotDegradedMode = !this.autoRemediation.isDegradedMode();

    const checks: Record<string, boolean> = {
      sloBreaches: hasSloBreaches,
      queueHealth: hasNoQueueIssues,
      degradedMode: isNotDegradedMode,
    };

    const failedChecks = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    const healthy = failedChecks.length === 0;

    this.logger.log(
      `[Rollback] Deploy health check — healthy=${healthy} failed=[${failedChecks.join(', ')}]`,
    );

    return { healthy, checks, failedChecks };
  }

  // ── Query API ─────────────────────────────────────────────────────────────

  getActivePlans(): RollbackPlan[] {
    return Array.from(this.plans.values()).filter(
      (p) => p.status === 'pending' || p.status === 'executing',
    );
  }
}
