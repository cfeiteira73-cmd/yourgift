import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { ProcurementSimulatorService } from './procurement-simulator.service';

// Local type mirrors — Prisma client will be regenerated after migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DecisionCard = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProcurementStateSnapshot = any;

export interface DecisionCardResult {
  id: string;
  action: string;
  actionType: string;
  marginImpactEur: number | null;
  deliveryImpactDays: number | null;
  riskChangePct: number | null;
  finalMarginPct: number | null;
  riskScore: number;
  confidenceScore: number;
  riskLevel: string;
  reasoning: string;
  alternatives: AlternativeAction[];
  status: string;
  autoExecuted: boolean;
}

export interface AlternativeAction {
  action: string;
  marginImpact: number;
  deliveryDays: number;
  riskScore: number;
  confidence: number;
}

// Automation gravity thresholds
const AUTO_EXECUTE_THRESHOLD = 35; // riskScore < 35 → auto-execute
const MEDIUM_RISK_THRESHOLD = 65; // riskScore 35-65 → require approval
// riskScore > 65 → block + escalate

@Injectable()
export class DecisionEngineService implements OnModuleInit {
  private readonly logger = new Logger(DecisionEngineService.name);

  // Cast to any so Sprint-14 models are accessible before prisma generate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.prisma;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly simulator: ProcurementSimulatorService,
  ) {}

  onModuleInit() {
    // Listen to key procurement events and generate decision cards
    const triggerEvents = [
      'order.created',
      'margin.alert.triggered',
      'budget.threshold.exceeded',
      'procurement.plan.generated',
    ];
    for (const event of triggerEvents) {
      this.events.on(event, async (payload: Record<string, unknown>) => {
        await this.generateDecisionFromEvent(event, payload);
      });
    }

    // Snapshot system state every 5 minutes
    setInterval(() => void this.takeStateSnapshot(), 5 * 60 * 1000);

    this.logger.log('Procurement Decision Engine initialized');
  }

  // Generate a Decision Card from a system event
  async generateDecisionFromEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<DecisionCard | null> {
    try {
      let action = '';
      let actionType = '';
      let reasoning = '';
      let riskScore = 50;
      let confidenceScore = 70;
      let alternatives: AlternativeAction[] = [];

      if (eventType === 'order.created') {
        action = 'Route order to optimal supplier and confirm pricing';
        actionType = 'reroute_supplier';
        reasoning = `New order created. Routing engine should validate supplier selection and confirm margin compliance before production start.`;
        riskScore = 25;
        confidenceScore = 85;
        alternatives = [
          {
            action: 'Hold for manual review',
            marginImpact: 0,
            deliveryDays: 2,
            riskScore: 10,
            confidence: 95,
          },
          {
            action: 'Auto-route to cheapest supplier',
            marginImpact: 2.5,
            deliveryDays: -1,
            riskScore: 40,
            confidence: 65,
          },
        ];
      } else if (eventType === 'margin.alert.triggered') {
        const gap = Number(payload['marginGapPct'] ?? 5);
        action =
          gap > 10
            ? 'Block order — margin critically below floor'
            : 'Flag for pricing review before approval';
        actionType = gap > 10 ? 'block' : 'escalate';
        riskScore = Math.min(95, 50 + gap * 3);
        confidenceScore = 88;
        reasoning = `Margin alert: actual margin is ${gap.toFixed(1)}% below the defined floor. ${gap > 10 ? 'Order must be blocked.' : 'Pricing review required.'}`;
        alternatives = [
          {
            action: 'Increase sale price by 15%',
            marginImpact: 8,
            deliveryDays: 0,
            riskScore: 20,
            confidence: 80,
          },
          {
            action: 'Switch to lower-cost supplier',
            marginImpact: 5,
            deliveryDays: 2,
            riskScore: 35,
            confidence: 70,
          },
        ];
      } else if (eventType === 'budget.threshold.exceeded') {
        action = 'Lock department budget — threshold exceeded';
        actionType = 'block';
        riskScore = 70;
        confidenceScore = 92;
        reasoning = `Department budget has crossed the alert threshold. New procurement requests should be blocked until budget review.`;
        alternatives = [
          {
            action: 'Allow with CFO approval',
            marginImpact: 0,
            deliveryDays: 0,
            riskScore: 40,
            confidence: 75,
          },
          {
            action: 'Defer to next quarter',
            marginImpact: 0,
            deliveryDays: 30,
            riskScore: 20,
            confidence: 90,
          },
        ];
      } else if (eventType === 'procurement.plan.generated') {
        action = 'Review and approve AI-generated procurement plan';
        actionType = 'approve_workflow';
        riskScore = 30;
        confidenceScore = 78;
        reasoning = `AI Procurement Agent has generated a plan. Review the supplier selection, margin projections, and timeline before approving.`;
        alternatives = [
          {
            action: 'Auto-approve if margin > 18%',
            marginImpact: 0,
            deliveryDays: -1,
            riskScore: 25,
            confidence: 82,
          },
          {
            action: 'Request human specialist review',
            marginImpact: 0,
            deliveryDays: 1,
            riskScore: 10,
            confidence: 95,
          },
        ];
      } else {
        return null;
      }

      const riskLevel: 'low' | 'medium' | 'high' =
        riskScore < AUTO_EXECUTE_THRESHOLD
          ? 'low'
          : riskScore < MEDIUM_RISK_THRESHOLD
            ? 'medium'
            : 'high';

      // Auto-execute low-risk decisions
      const autoExecuted = riskScore < AUTO_EXECUTE_THRESHOLD;
      const status = autoExecuted ? 'auto_executed' : 'pending';

      const card = await this.db.decisionCard.create({
        data: {
          triggerType: eventType.split('.')[0] ?? 'system_event',
          triggerId: String(payload['id'] ?? payload['orderId'] ?? ''),
          triggerDescription: eventType,
          action,
          actionType,
          riskScore,
          confidenceScore,
          failureProbability: riskScore * 0.6,
          riskLevel,
          reasoning,
          alternatives: alternatives as unknown as object,
          autoExecuted,
          status,
          decidedAt: autoExecuted ? new Date() : null,
          decidedBy: autoExecuted ? 'system' : null,
        },
      });

      if (autoExecuted) {
        this.logger.log(`Auto-executed decision: ${action} (risk=${riskScore})`);
        this.events.emit('decision.auto_executed', { decisionId: card.id, action });
      } else {
        this.events.emit('decision.pending', { decisionId: card.id, riskLevel, action });
      }

      return card;
    } catch (err) {
      this.logger.error(`Failed to generate decision card for ${eventType}: ${err}`);
      return null;
    }
  }

  // Manually create a decision card (for API-driven simulation)
  async createDecision(params: {
    triggerType: string;
    triggerId?: string;
    action: string;
    actionType: string;
    reasoning: string;
    riskScore: number;
    confidenceScore: number;
    marginImpactEur?: number;
    deliveryImpactDays?: number;
    finalMarginPct?: number;
    alternatives?: AlternativeAction[];
    tenantId?: string;
  }): Promise<DecisionCard> {
    const riskLevel: 'low' | 'medium' | 'high' =
      params.riskScore < AUTO_EXECUTE_THRESHOLD
        ? 'low'
        : params.riskScore < MEDIUM_RISK_THRESHOLD
          ? 'medium'
          : 'high';
    const autoExecuted = params.riskScore < AUTO_EXECUTE_THRESHOLD;

    return this.db.decisionCard.create({
      data: {
        tenantId: params.tenantId ?? 'default',
        triggerType: params.triggerType,
        triggerId: params.triggerId ?? null,
        action: params.action,
        actionType: params.actionType,
        marginImpactEur: params.marginImpactEur ?? null,
        deliveryImpactDays: params.deliveryImpactDays ?? null,
        finalMarginPct: params.finalMarginPct ?? null,
        riskScore: params.riskScore,
        confidenceScore: params.confidenceScore,
        failureProbability: params.riskScore * 0.6,
        riskLevel,
        reasoning: params.reasoning,
        alternatives: (params.alternatives ?? []) as unknown as object,
        autoExecuted,
        status: autoExecuted ? 'auto_executed' : 'pending',
        decidedAt: autoExecuted ? new Date() : null,
        decidedBy: autoExecuted ? 'system' : null,
      },
    });
  }

  // Approve a pending decision
  async approveDecision(decisionId: string, approvedBy: string): Promise<void> {
    await this.db.decisionCard.update({
      where: { id: decisionId },
      data: { status: 'approved', decidedBy: approvedBy, decidedAt: new Date() },
    });
    this.events.emit('decision.approved', { decisionId, approvedBy });
  }

  // Reject a decision
  async rejectDecision(decisionId: string, rejectedBy: string): Promise<void> {
    await this.db.decisionCard.update({
      where: { id: decisionId },
      data: { status: 'rejected', decidedBy: rejectedBy, decidedAt: new Date() },
    });
  }

  // Get pending decisions (prioritized by risk)
  async getPendingDecisions(tenantId?: string): Promise<DecisionCard[]> {
    return this.db.decisionCard.findMany({
      where: {
        status: 'pending',
        ...(tenantId ? { tenantId } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
      take: 20,
    });
  }

  // Get all decisions with filters
  async getDecisions(filters: {
    status?: string;
    riskLevel?: string;
    limit?: number;
  }): Promise<DecisionCard[]> {
    return this.db.decisionCard.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  // Take a unified state snapshot
  async takeStateSnapshot(): Promise<ProcurementStateSnapshot> {
    const [
      openOrders,
      productionOrders,
      slaBreaches,
      pendingDecisions,
      autoExecutedToday,
      blockedDecisions,
      openAlerts,
      expansionSignals,
      supplierMatrix,
      marginAlerts,
    ] = await Promise.all([
      this.prisma.order
        .count({ where: { status: { notIn: ['delivered', 'cancelled'] } } })
        .catch(() => 0),
      this.prisma.order.count({ where: { status: 'producing' } }).catch(() => 0),
      this.prisma.productionStage.count({ where: { slaStatus: 'breach' } }).catch(() => 0),
      this.db.decisionCard.count({ where: { status: 'pending' } }),
      this.db.decisionCard.count({
        where: {
          status: 'auto_executed',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.db.decisionCard.count({ where: { status: 'rejected' } }),
      this.prisma.systemAlert.count({ where: { isResolved: false } }).catch(() => 0),
      this.prisma.expansionSignal.count({ where: { isActioned: false } }).catch(() => 0),
      this.prisma.supplierRoutingMatrix
        .findMany({ where: { isActive: true } })
        .catch(() => []),
      this.prisma.marginAlert
        .count({ where: { isResolved: false, severity: { in: ['critical', 'warning'] } } })
        .catch(() => 0),
    ]);

    const avgReliability =
      supplierMatrix.length > 0
        ? supplierMatrix.reduce(
            (s: number, m: { reliabilityScore: unknown }) =>
              s + Number(m.reliabilityScore),
            0,
          ) / supplierMatrix.length
        : 75;
    const degradedSuppliers = supplierMatrix.filter(
      (m: { reliabilityScore: unknown }) => Number(m.reliabilityScore) < 60,
    ).length;
    const supplierHealthScore = avgReliability;
    const activeAlerts = openAlerts + marginAlerts;
    const overallScore = Math.max(
      0,
      100 - slaBreaches * 10 - pendingDecisions * 2 - degradedSuppliers * 8 - marginAlerts * 5,
    );

    return this.db.procurementStateSnapshot.create({
      data: {
        totalOpenOrders: openOrders,
        ordersInProduction: productionOrders,
        slaBreaches,
        pendingDecisions,
        autoExecutedToday,
        blockedDecisions,
        activeAlerts,
        expansionOpportunities: expansionSignals,
        supplierHealthScore,
        degradedSuppliers,
        overallSystemScore: Math.min(100, overallScore),
      },
    });
  }

  // Get latest state snapshot
  async getLatestState(): Promise<ProcurementStateSnapshot | null> {
    return this.db.procurementStateSnapshot.findFirst({
      orderBy: { snapshotAt: 'desc' },
    });
  }

  // Get state history for trend visualization
  async getStateHistory(limit = 24): Promise<ProcurementStateSnapshot[]> {
    return this.db.procurementStateSnapshot.findMany({
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  // Get decision stats
  async getDecisionStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    autoExecuted: number;
    autoExecutionRate: number;
    avgRiskScore: number;
    byRiskLevel: Record<string, number>;
  }> {
    const [total, byStatus, byRisk, riskAvg] = await Promise.all([
      this.db.decisionCard.count(),
      this.db.decisionCard.groupBy({ by: ['status'], _count: { id: true } }),
      this.db.decisionCard.groupBy({ by: ['riskLevel'], _count: { id: true } }),
      this.db.decisionCard.aggregate({ _avg: { riskScore: true } }),
    ]);
    const statusMap = Object.fromEntries(byStatus.map((s: { status: string; _count: { id: number } }) => [s.status, s._count.id]));
    const riskMap = Object.fromEntries(byRisk.map((r: { riskLevel: string; _count: { id: number } }) => [r.riskLevel, r._count.id]));
    const autoExec = statusMap['auto_executed'] ?? 0;
    return {
      total,
      pending: statusMap['pending'] ?? 0,
      approved: statusMap['approved'] ?? 0,
      rejected: statusMap['rejected'] ?? 0,
      autoExecuted: autoExec,
      autoExecutionRate: total > 0 ? (autoExec / total) * 100 : 0,
      avgRiskScore: Number(riskAvg._avg.riskScore ?? 50),
      byRiskLevel: riskMap,
    };
  }
}
