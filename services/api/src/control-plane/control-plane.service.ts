import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { QueueService } from '../queue/queue.service';
import { AutoRemediationService } from '../sre/auto-remediation.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

export interface ServiceNode {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyP95Ms: number | null;
  errorRate: number;
  dependencies: string[];
  isThrottled: boolean;
  lastCheckedAt: Date;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'sync' | 'async' | 'queue';
  healthy: boolean;
}

export interface SystemHealthGraph {
  generatedAt: Date;
  nodes: ServiceNode[];
  edges: DependencyEdge[];
  systemStatus: 'healthy' | 'degraded' | 'critical';
  degradedServices: string[];
  criticalPaths: string[][];
}

export interface TenantImpact {
  tenantId: string;
  affectedWorkflows: number;
  estimatedRevenueAtRisk: number;
  activeOrders: number;
  queuedJobs: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface FinancialImpact {
  timestamp: Date;
  ordersAtRisk: number;
  revenueAtRiskEur: number;
  pendingReconciliationEur: number;
  driftDetected: boolean;
  driftAmountEur: number;
  affectedTenants: string[];
}

export interface ControlPlaneSummary {
  timestamp: Date;
  systemHealth: SystemHealthGraph;
  financialImpact: FinancialImpact;
  topAffectedTenants: TenantImpact[];
  activeIncidents: number;
  degradedMode: boolean;
  recommendedActions: string[];
}

const SERVICE_TOPOLOGY: Array<{
  name: string;
  dependencies: string[];
  type: 'sync' | 'async' | 'queue';
}> = [
  { name: 'api-gateway',    dependencies: [],                                    type: 'sync'  },
  { name: 'orders',         dependencies: ['prisma', 'stripe', 'queue'],          type: 'sync'  },
  { name: 'payments',       dependencies: ['stripe', 'ledger', 'queue'],          type: 'sync'  },
  { name: 'ledger',         dependencies: ['prisma'],                             type: 'sync'  },
  { name: 'reconciliation', dependencies: ['ledger', 'prisma'],                   type: 'async' },
  { name: 'rfq',            dependencies: ['prisma', 'queue', 'notifications'],   type: 'sync'  },
  { name: 'approvals',      dependencies: ['prisma', 'queue'],                    type: 'sync'  },
  { name: 'fulfillment',    dependencies: ['prisma', 'queue'],                    type: 'async' },
  { name: 'subscriptions',  dependencies: ['stripe', 'prisma'],                   type: 'sync'  },
  { name: 'queue',          dependencies: ['redis'],                              type: 'queue' },
  { name: 'stripe',         dependencies: [],                                    type: 'sync'  },
  { name: 'prisma',         dependencies: ['postgres'],                           type: 'sync'  },
  { name: 'redis',          dependencies: [],                                    type: 'sync'  },
  { name: 'postgres',       dependencies: [],                                    type: 'sync'  },
  { name: 'notifications',  dependencies: ['queue', 'prisma'],                   type: 'async' },
  { name: 'sre',            dependencies: ['queue', 'metrics'],                  type: 'async' },
  { name: 'metrics',        dependencies: [],                                    type: 'sync'  },
];

@Injectable()
export class ControlPlaneService {
  private readonly logger = new Logger(ControlPlaneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
    private readonly autoRemediation: AutoRemediationService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  // ── BFS path finder ───────────────────────────────────────────────────────

  private findPath(from: string, to: string): string[] | null {
    const adjacency = new Map<string, string[]>();
    for (const node of SERVICE_TOPOLOGY) {
      adjacency.set(node.name, node.dependencies);
    }

    const visited = new Set<string>();
    const queue: Array<string[]> = [[from]];

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1]!;

      if (current === to) return path;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const dep of adjacency.get(current) ?? []) {
        if (!visited.has(dep)) {
          queue.push([...path, dep]);
        }
      }
    }

    return null;
  }

  // ── 1. buildSystemHealthGraph ─────────────────────────────────────────────

  async buildSystemHealthGraph(): Promise<SystemHealthGraph> {
    const [sloBreaches, queueMetrics] = await Promise.all([
      Promise.resolve(this.metrics.getSloBreaches()),
      this.queue.getQueueMetrics(),
    ]);

    const sloBreachMap = new Map(
      sloBreaches.map((b) => [b.endpoint, b]),
    );

    const queueCritical = queueMetrics.some((q) => q.status === 'critical');

    const now = new Date();
    const nodes: ServiceNode[] = SERVICE_TOPOLOGY.map((def) => {
      const isThrottled = this.autoRemediation.isThrottled(def.name);

      const sloKey = sloBreaches.find((b) => b.endpoint.includes(def.name));
      const sloBreach = sloKey ? sloBreachMap.get(sloKey.endpoint) : undefined;

      let status: ServiceNode['status'] = 'healthy';

      if (def.type === 'queue' && queueCritical) {
        status = 'degraded';
      } else if (isThrottled) {
        status = 'degraded';
      } else if (sloBreach?.severity === 'critical') {
        status = 'degraded';
      }

      const latencyInfo = this.metrics.getLatencyPercentiles(def.name, 'GET', 200);

      return {
        name: def.name,
        status,
        latencyP95Ms: latencyInfo?.p95 ?? null,
        errorRate: 0,
        dependencies: def.dependencies,
        isThrottled,
        lastCheckedAt: now,
      };
    });

    const nodeStatusMap = new Map(nodes.map((n) => [n.name, n.status]));

    const edges: DependencyEdge[] = [];
    for (const def of SERVICE_TOPOLOGY) {
      for (const dep of def.dependencies) {
        const fromStatus = nodeStatusMap.get(def.name) ?? 'unknown';
        const toStatus = nodeStatusMap.get(dep) ?? 'unknown';
        edges.push({
          from: def.name,
          to: dep,
          type: def.type,
          healthy: fromStatus === 'healthy' && toStatus === 'healthy',
        });
      }
    }

    const degradedServices = nodes
      .filter((n) => n.status === 'degraded' || n.status === 'down')
      .map((n) => n.name);

    let systemStatus: SystemHealthGraph['systemStatus'] = 'healthy';
    if (nodes.some((n) => n.status === 'down')) {
      systemStatus = 'critical';
    } else if (degradedServices.length > 0) {
      systemStatus = 'degraded';
    }

    const criticalPaths: string[][] = [];
    const pathToPostgres = this.findPath('api-gateway', 'postgres');
    if (pathToPostgres) criticalPaths.push(pathToPostgres);
    const pathToStripe = this.findPath('api-gateway', 'stripe');
    if (pathToStripe) criticalPaths.push(pathToStripe);

    return {
      generatedAt: now,
      nodes,
      edges,
      systemStatus,
      degradedServices,
      criticalPaths,
    };
  }

  // ── 2. getFinancialImpact ─────────────────────────────────────────────────

  async getFinancialImpact(): Promise<FinancialImpact> {
    const atRiskStatuses = ['pending', 'processing', 'paid'] as const;

    const [ordersAtRisk, revenueAggregate, driftEntries] = await Promise.all([
      this.prisma.order.count({
        where: { status: { in: [...atRiskStatuses] } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: [...atRiskStatuses] } },
      }),
      this.reconciliation.getDriftStatus(),
    ]);

    const revenueAtRiskEur = Number(revenueAggregate._sum.totalAmount ?? 0);

    const pendingEntries = driftEntries.filter(
      (e) => e.status === 'warning' || e.status === 'critical',
    );

    const pendingReconciliationEur = pendingEntries.reduce(
      (sum, e) => sum + Math.abs(e.drift),
      0,
    );

    const driftDetected = driftEntries.some((e) => e.status === 'critical');
    const driftAmountEur = driftEntries.reduce(
      (sum, e) => sum + Math.abs(e.drift),
      0,
    );

    const affectedTenants = driftEntries
      .filter((e) => e.status !== 'clean')
      .map((e) => e.tenantId);

    return {
      timestamp: new Date(),
      ordersAtRisk,
      revenueAtRiskEur,
      pendingReconciliationEur,
      driftDetected,
      driftAmountEur,
      affectedTenants,
    };
  }

  // ── 3. getTenantImpacts ───────────────────────────────────────────────────

  async getTenantImpacts(limit = 10): Promise<TenantImpact[]> {
    const activeStatuses = ['pending', 'processing'] as const;

    const grouped = await this.prisma.order.groupBy({
      by: ['tenantId'],
      where: { status: { in: [...activeStatuses] } },
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return grouped.map((row) => {
      const tenantId = row.tenantId ?? 'default';
      const activeOrders = row._count.id;
      const estimatedRevenueAtRisk = Number(row._sum.totalAmount ?? 0);

      let riskLevel: TenantImpact['riskLevel'] = 'low';
      if (activeOrders > 100) riskLevel = 'critical';
      else if (activeOrders > 20) riskLevel = 'high';
      else if (activeOrders > 5) riskLevel = 'medium';

      return {
        tenantId,
        affectedWorkflows: activeOrders,
        estimatedRevenueAtRisk,
        activeOrders,
        queuedJobs: 0,
        riskLevel,
      };
    });
  }

  // ── 4. getControlPlaneSummary ─────────────────────────────────────────────

  async getControlPlaneSummary(): Promise<ControlPlaneSummary> {
    const [systemHealth, financialImpact, topAffectedTenants] =
      await Promise.all([
        this.buildSystemHealthGraph(),
        this.getFinancialImpact(),
        this.getTenantImpacts(10),
      ]);

    let activeIncidents = 0;
    try {
      activeIncidents = await (this.prisma as unknown as {
        incident: { count: (args: { where: { status: { in: string[] } } }) => Promise<number> };
      }).incident.count({
        where: { status: { in: ['open', 'investigating', 'mitigating'] } },
      });
    } catch {
      // incident model not available — skip gracefully
    }

    const degradedMode = this.autoRemediation.isDegradedMode();

    const recommendedActions: string[] = [];

    if (degradedMode) {
      recommendedActions.push('Activate degraded ingestion on non-critical queues');
    }
    if (financialImpact.driftDetected) {
      recommendedActions.push('Run emergency reconciliation for affected tenants');
    }
    if (systemHealth.degradedServices.length > 3) {
      recommendedActions.push('Escalate to SEV1 incident');
    }
    if (financialImpact.revenueAtRiskEur > 50_000) {
      recommendedActions.push('Freeze new order acceptance pending stability');
    }

    return {
      timestamp: new Date(),
      systemHealth,
      financialImpact,
      topAffectedTenants,
      activeIncidents,
      degradedMode,
      recommendedActions,
    };
  }

  // ── 5. getDependencyTopologyGraph ─────────────────────────────────────────

  async getDependencyTopologyGraph(): Promise<{
    nodes: Array<{ id: string; label: string; status: string }>;
    edges: Array<{ source: string; target: string; type: string; healthy: boolean }>;
  }> {
    const graph = await this.buildSystemHealthGraph();

    const nodes = graph.nodes.map((n) => ({
      id: n.name,
      label: n.name,
      status: n.status,
    }));

    const edges = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      type: e.type,
      healthy: e.healthy,
    }));

    return { nodes, edges };
  }
}
