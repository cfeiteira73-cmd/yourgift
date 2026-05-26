import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AIInsight {
  id: string;
  type: 'warning' | 'opportunity' | 'critical' | 'info';
  title: string;
  body: string;
  action: string | null;
  actionHref: string | null;
  metric?: string;
  source: string;
  generatedAt: string;
}

@Injectable()
export class AIInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInsights(): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // 1. Check DLQ for critical buildup (status 'pending' = awaiting replay)
    const dlqCount = await this.prisma.eventDLQ.count({ where: { status: 'pending' } });
    if (dlqCount > 10) {
      insights.push({
        id: 'dlq-buildup',
        type: dlqCount > 50 ? 'critical' : 'warning',
        title: 'Event DLQ Buildup',
        body: `${dlqCount} events stuck in dead-letter queue. May indicate handler failures.`,
        action: 'Review DLQ',
        actionHref: '/event-platform',
        source: 'event-platform',
        generatedAt: new Date().toISOString(),
      });
    }

    // 2. Check budget anomalies
    const openAnomalies = await this.prisma.budgetAnomaly.count({
      where: { isAcknowledged: false },
    });
    if (openAnomalies > 0) {
      insights.push({
        id: 'budget-anomalies',
        type: 'warning',
        title: `${openAnomalies} Budget Anomalies Detected`,
        body: 'Unusual spending patterns detected. Review for potential overspend or fraud.',
        action: 'View Anomalies',
        actionHref: '/consolidation',
        source: 'financial',
        generatedAt: new Date().toISOString(),
      });
    }

    // 3. Check supplier learning outcomes — reliability drops (using `delta` field)
    const recentOutcomes = await this.prisma.learningOutcome.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const reliabilityDrops = recentOutcomes.filter((o) => Number(o.delta) < -3);
    if (reliabilityDrops.length > 0) {
      const worstOutcome = reliabilityDrops.reduce((a, b) =>
        Number(a.delta) < Number(b.delta) ? a : b,
      );
      insights.push({
        id: 'supplier-reliability',
        type: 'warning',
        title: 'Supplier Reliability Drop',
        body: `${reliabilityDrops.length} supplier(s) with declining reliability scores this week. Worst supplier ID: ${worstOutcome.supplierId ?? 'unknown'}.`,
        action: 'Review Routing',
        actionHref: '/automation',
        source: 'supplier-intelligence',
        generatedAt: new Date().toISOString(),
      });
    }

    // 4. Check failed workflows
    const failedWorkflows = await this.prisma.workflowInstance.count({
      where: { status: 'failed' },
    });
    if (failedWorkflows > 0) {
      insights.push({
        id: 'workflow-failures',
        type: failedWorkflows > 5 ? 'critical' : 'warning',
        title: `${failedWorkflows} Failed Workflow${failedWorkflows > 1 ? 's' : ''}`,
        body: 'One or more workflow instances have failed and require manual intervention.',
        action: 'Retry Workflows',
        actionHref: '/workflows',
        source: 'workflows',
        generatedAt: new Date().toISOString(),
      });
    }

    // 5. Check inventory depletion alerts
    const depletionAlerts = await this.prisma.inventoryForecast.count({
      where: { isAlertActive: true, alertSeverity: { in: ['critical', 'high'] } },
    });
    if (depletionAlerts > 0) {
      insights.push({
        id: 'inventory-depletion',
        type: 'opportunity',
        title: `${depletionAlerts} SKU${depletionAlerts > 1 ? 's' : ''} Near Depletion`,
        body: 'Items predicted to deplete within 14 days. Trigger reorder to avoid stockouts.',
        action: 'View Forecasts',
        actionHref: '/customer-success',
        source: 'inventory',
        generatedAt: new Date().toISOString(),
      });
    }

    // 6. Check expansion signals
    const expansionSignals = await this.prisma.expansionSignal.count({
      where: { isActioned: false },
    });
    if (expansionSignals > 0) {
      insights.push({
        id: 'expansion-signals',
        type: 'opportunity',
        title: `${expansionSignals} Expansion Signal${expansionSignals > 1 ? 's' : ''} Detected`,
        body: `Clients showing increased procurement activity. ${expansionSignals} upsell/expansion opportunities available.`,
        action: 'View Signals',
        actionHref: '/customer-success',
        source: 'customer-success',
        generatedAt: new Date().toISOString(),
      });
    }

    // 7. Check pending procurement requests
    const pendingRequests = await this.prisma.procurementRequest.count({
      where: { status: 'pending' },
    });
    if (pendingRequests > 0) {
      insights.push({
        id: 'pending-requests',
        type: pendingRequests > 20 ? 'warning' : 'info',
        title: `${pendingRequests} Pending Procurement Request${pendingRequests > 1 ? 's' : ''}`,
        body: 'Employee procurement requests awaiting approval. High urgency requests may be blocked.',
        action: 'Review Requests',
        actionHref: '/employee-portal',
        source: 'employee-portal',
        generatedAt: new Date().toISOString(),
      });
    }

    // 8. If nothing critical — positive signal
    if (insights.filter((i) => i.type === 'critical').length === 0 && insights.length < 3) {
      insights.push({
        id: 'system-healthy',
        type: 'info',
        title: 'Systems Operating Normally',
        body: 'No critical alerts detected. All core procurement workflows are running smoothly.',
        action: null,
        actionHref: null,
        source: 'system',
        generatedAt: new Date().toISOString(),
      });
    }

    return insights;
  }
}
