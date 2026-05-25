import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MetricsService } from '../observability/metrics.service';
import { QueueService } from '../queue/queue.service';
import { EventBusService } from '../events/event-bus.service';

export interface RemediationAction {
  id: string;
  triggeredAt: Date;
  trigger: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
}

export interface SystemHealthSnapshot {
  timestamp: Date;
  sloBreaches: Array<{
    endpoint: string;
    p95Ms: number;
    p99Ms: number;
    level: 'warning' | 'critical';
  }>;
  queueAlerts: Array<{ name: string; waiting: number; status: string }>;
  activeRemediations: number;
  systemStatus: 'healthy' | 'degraded' | 'critical';
}

@Injectable()
export class AutoRemediationService implements OnModuleInit {
  private readonly logger = new Logger(AutoRemediationService.name);

  private readonly actions: RemediationAction[] = [];
  private degradedMode = false;
  private readonly throttledEndpoints = new Set<string>();

  /** Cached state from the last health check tick */
  private lastSnapshot: SystemHealthSnapshot = {
    timestamp: new Date(),
    sloBreaches: [],
    queueAlerts: [],
    activeRemediations: 0,
    systemStatus: 'healthy',
  };

  constructor(
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    setInterval(() => {
      void this.runHealthCheck();
    }, 30_000);
  }

  // ── Core health-check tick ────────────────────────────────────────────────

  private async runHealthCheck(): Promise<void> {
    const sloBreaches = this.metrics.getSloBreaches();
    const queueMetrics = await this.queue.getQueueMetrics();

    // Handle latency breaches
    for (const breach of sloBreaches) {
      if (breach.p99 > 800 && !this.throttledEndpoints.has(breach.endpoint)) {
        this.activateThrottle(breach.endpoint);
      }
    }

    // Handle critical queues
    const criticalQueues = queueMetrics.filter((q) => q.status === 'critical');
    for (const q of criticalQueues) {
      this.activateDegradedIngestion(q.name);
    }

    if (criticalQueues.length > 3) {
      this.emitCriticalSystemAlert();
    }

    // Compute system status
    let systemStatus: SystemHealthSnapshot['systemStatus'] = 'healthy';
    if (criticalQueues.length > 0 || sloBreaches.some((b) => b.severity === 'critical')) {
      systemStatus = 'critical';
    } else if (
      sloBreaches.length > 0 ||
      queueMetrics.some((q) => q.status === 'degraded') ||
      this.degradedMode
    ) {
      systemStatus = 'degraded';
    }

    this.lastSnapshot = {
      timestamp: new Date(),
      sloBreaches: sloBreaches.map((b) => ({
        endpoint: b.endpoint,
        p95Ms: b.p95,
        p99Ms: b.p99,
        level: b.severity,
      })),
      queueAlerts: criticalQueues.map((q) => ({
        name: q.name,
        waiting: q.waiting,
        status: q.status,
      })),
      activeRemediations: this.actions.filter((a) => !a.resolved).length,
      systemStatus,
    };

    this.logger.log(
      `[SRE] Health check — status=${systemStatus} sloBreaches=${sloBreaches.length} ` +
        `criticalQueues=${criticalQueues.length} throttled=${this.throttledEndpoints.size} ` +
        `degraded=${this.degradedMode}`,
    );
  }

  // ── Throttle management ──────────────────────────────────────────────────

  activateThrottle(endpoint: string): void {
    this.throttledEndpoints.add(endpoint);
    this.logger.warn(`[SRE] Throttle activated for endpoint: ${endpoint}`);

    this.recordAction({
      trigger: `p99 breach on ${endpoint}`,
      action: 'throttle activated',
      severity: 'warning',
    });

    this.eventBus.emit('sre.throttle_activated', { endpoint });
  }

  deactivateThrottle(endpoint: string): void {
    this.throttledEndpoints.delete(endpoint);
    this.logger.log(`[SRE] Throttle deactivated for endpoint: ${endpoint}`);

    this.recordAction({
      trigger: `manual deactivation for ${endpoint}`,
      action: 'throttle deactivated',
      severity: 'info',
    });
  }

  // ── Degraded ingestion management ────────────────────────────────────────

  activateDegradedIngestion(queueName: string): void {
    this.degradedMode = true;
    this.logger.warn(`[SRE] Degraded ingestion mode activated — queue: ${queueName}`);

    this.recordAction({
      trigger: `queue ${queueName} critical`,
      action: 'degraded ingestion mode',
      severity: 'critical',
    });

    this.eventBus.emit('sre.degraded_mode_activated', { queueName });
  }

  deactivateDegradedIngestion(): void {
    this.degradedMode = false;
    this.logger.log('[SRE] Degraded ingestion mode deactivated');

    this.recordAction({
      trigger: 'manual deactivation',
      action: 'degraded mode deactivated',
      severity: 'info',
    });
  }

  // ── Critical alert ───────────────────────────────────────────────────────

  private emitCriticalSystemAlert(): void {
    const snapshot = this.lastSnapshot;
    this.logger.error(
      `[SRE] CRITICAL SYSTEM ALERT — ${snapshot.queueAlerts.length} critical queues ` +
        `sloBreaches=${snapshot.sloBreaches.length}`,
    );
    this.eventBus.emit('sre.critical_system_alert', snapshot);
  }

  // ── Public query API ─────────────────────────────────────────────────────

  isThrottled(endpoint: string): boolean {
    return this.throttledEndpoints.has(endpoint);
  }

  isDegradedMode(): boolean {
    return this.degradedMode;
  }

  getHealthSnapshot(): SystemHealthSnapshot {
    return this.lastSnapshot;
  }

  getRemediationHistory(limit = 50): RemediationAction[] {
    return this.actions.slice(-limit);
  }

  // ── Action recording ─────────────────────────────────────────────────────

  recordAction(
    action: Omit<RemediationAction, 'id' | 'triggeredAt' | 'resolved'>,
  ): void {
    const entry: RemediationAction = {
      id: `rem-${Date.now()}`,
      triggeredAt: new Date(),
      resolved: false,
      ...action,
    };

    this.actions.push(entry);

    // Trim to last 500
    if (this.actions.length > 500) {
      this.actions.splice(0, this.actions.length - 500);
    }
  }
}
