// FILE: services/api/src/lifecycle/customer-lifecycle.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Exported types ──────────────────────────────────────────────────────────

export type LifecycleState = 'new' | 'active' | 'loyal' | 'at_risk' | 'churned' | 'recovered';

export interface CustomerLifecycleState {
  clientId: string;
  email: string;
  currentState: LifecycleState;
  previousState: LifecycleState | null;
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  ltv: number;
  churnRisk: number;
  recommendedAction: string;
  evaluatedAt: Date;
}

export interface ChurnReport {
  total: number;
  new: number;
  active: number;
  loyal: number;
  atRisk: number;
  churned: number;
  recovered: number;
  churnRate: number;
  avgLtv: number;
  revenueAtRisk: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MS_DAY = 24 * 60 * 60 * 1000;
const LOYAL_AVG_ORDER_THRESHOLD = 200; // EUR
const LOYAL_MIN_ORDERS = 5;
const ACTIVE_THRESHOLD_DAYS = 60;
const LOYAL_THRESHOLD_DAYS = 90;
const AT_RISK_MIN_DAYS = 60;
const AT_RISK_MAX_DAYS = 180;
const CHURN_THRESHOLD_DAYS = 180;
const NEW_REGISTRATION_CHURN_DAYS = 30;

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerLifecycleService {
  private readonly logger = new Logger(CustomerLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Evaluate a single client ────────────────────────────────────────────

  async evaluateClient(clientId: string): Promise<CustomerLifecycleState> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        orders: {
          where: { status: { in: ['paid', 'delivered', 'shipped', 'producing', 'approved'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, totalAmount: true, createdAt: true, status: true },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const now = new Date();
    const orders = client.orders;
    const orderCount = orders.length;
    const totalSpent = parseFloat(
      orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0).toFixed(2),
    );
    const avgOrderValue =
      orderCount > 0 ? parseFloat((totalSpent / orderCount).toFixed(2)) : 0;

    const lastOrder = orders[0] ?? null;
    const daysSinceLastOrder = lastOrder
      ? Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / MS_DAY)
      : null;

    const daysSinceRegistration = Math.floor(
      (now.getTime() - client.createdAt.getTime()) / MS_DAY,
    );

    const currentState = this.computeState(
      orderCount,
      daysSinceLastOrder,
      daysSinceRegistration,
      avgOrderValue,
    );

    const churnRisk = this.computeChurnRisk(daysSinceLastOrder, orderCount, daysSinceRegistration);
    const recommendedAction = this.recommendAction(currentState, churnRisk, avgOrderValue);

    return {
      clientId,
      email: client.email,
      currentState,
      previousState: null, // caller can compare against stored state
      orderCount,
      totalSpent,
      avgOrderValue,
      daysSinceLastOrder,
      ltv: totalSpent, // simple LTV = totalSpent
      churnRisk,
      recommendedAction,
      evaluatedAt: now,
    };
  }

  // ── State machine ───────────────────────────────────────────────────────

  private computeState(
    orderCount: number,
    daysSinceLastOrder: number | null,
    daysSinceRegistration: number,
    avgOrderValue: number,
  ): LifecycleState {
    const days = daysSinceLastOrder;

    // churned: no orders and registered > 30 days ago
    if (orderCount === 0 && daysSinceRegistration > NEW_REGISTRATION_CHURN_DAYS) {
      return 'churned';
    }

    // new: 0 orders or 1 order < 30 days old
    if (orderCount === 0) {
      return 'new';
    }
    if (orderCount === 1 && days !== null && days < NEW_REGISTRATION_CHURN_DAYS) {
      return 'new';
    }

    // churned: last order > 180 days ago
    if (days !== null && days > CHURN_THRESHOLD_DAYS) {
      return 'churned';
    }

    // loyal: 5+ orders, last order < 90 days, avg order value > 200
    if (
      orderCount >= LOYAL_MIN_ORDERS &&
      days !== null &&
      days < LOYAL_THRESHOLD_DAYS &&
      avgOrderValue > LOYAL_AVG_ORDER_THRESHOLD
    ) {
      return 'loyal';
    }

    // at_risk: last order 60-180 days ago
    if (
      days !== null &&
      days >= AT_RISK_MIN_DAYS &&
      days <= AT_RISK_MAX_DAYS
    ) {
      return 'at_risk';
    }

    // recovered: was churned (last order was > 180 days), now placed order < 30 days
    // We detect this by checking if there was a gap > 180 days before the most recent order
    // This requires prior state tracking; as a heuristic we check orderCount > 1 and
    // days < 30 but there's a gap in order history (simplified: rely on evaluateAllClients
    // to emit the event; here we just mark based on current data)
    if (days !== null && days < NEW_REGISTRATION_CHURN_DAYS && orderCount > 1) {
      return 'recovered';
    }

    // active: 2+ orders OR last order < 60 days ago
    if (orderCount >= 2 || (days !== null && days < ACTIVE_THRESHOLD_DAYS)) {
      return 'active';
    }

    return 'new';
  }

  // ── Churn risk score ────────────────────────────────────────────────────

  private computeChurnRisk(
    daysSinceLastOrder: number | null,
    orderCount: number,
    daysSinceRegistration: number,
  ): number {
    if (orderCount === 0) {
      // No orders yet — risk increases with registration age
      const riskFromRegistration = Math.min(1, daysSinceRegistration / CHURN_THRESHOLD_DAYS);
      return parseFloat(riskFromRegistration.toFixed(2));
    }

    const days = daysSinceLastOrder ?? 0;

    // Recency score: 0 = just ordered, 1 = churned
    const recencyScore = Math.min(1, days / CHURN_THRESHOLD_DAYS);

    // Frequency score: more orders = lower risk
    const frequencyScore = Math.max(0, 1 - orderCount / 10);

    // Weighted combination: recency is 70%, frequency is 30%
    const raw = recencyScore * 0.7 + frequencyScore * 0.3;
    return parseFloat(Math.min(1, raw).toFixed(2));
  }

  // ── Recommended action ──────────────────────────────────────────────────

  private recommendAction(
    state: LifecycleState,
    churnRisk: number,
    avgOrderValue: number,
  ): string {
    switch (state) {
      case 'new':
        return 'send_onboarding_sequence';
      case 'active':
        return avgOrderValue > 300 ? 'upsell_premium' : 'upsell';
      case 'loyal':
        return 'loyalty_reward';
      case 'at_risk':
        return churnRisk > 0.7 ? 'send_win_back_email_urgent' : 'send_win_back_email';
      case 'churned':
        return 'send_win_back_email';
      case 'recovered':
        return 'send_welcome_back_offer';
      default:
        return 'no_action';
    }
  }

  // ── Evaluate all clients ────────────────────────────────────────────────

  async evaluateAllClients(tenantId?: string): Promise<CustomerLifecycleState[]> {
    const clients = await this.prisma.client.findMany({
      where: tenantId ? { tenantId } : {},
      select: { id: true },
    });

    const results: CustomerLifecycleState[] = [];

    for (const { id } of clients) {
      try {
        const state = await this.evaluateClient(id);
        results.push(state);

        // Emit lifecycle transition events
        if (state.currentState === 'at_risk') {
          this.eventBus.emit('lifecycle.client.became_at_risk', {
            clientId: id,
            email: state.email,
            churnRisk: state.churnRisk,
            daysSinceLastOrder: state.daysSinceLastOrder,
            evaluatedAt: state.evaluatedAt.toISOString(),
          });
        } else if (state.currentState === 'churned') {
          this.eventBus.emit('lifecycle.client.churned', {
            clientId: id,
            email: state.email,
            ltv: state.ltv,
            evaluatedAt: state.evaluatedAt.toISOString(),
          });
        } else if (state.currentState === 'recovered') {
          this.eventBus.emit('lifecycle.client.recovered', {
            clientId: id,
            email: state.email,
            evaluatedAt: state.evaluatedAt.toISOString(),
          });
        }
      } catch (err) {
        this.logger.warn(
          `evaluateAllClients: failed to evaluate client ${id}: ${(err as Error).message}`,
        );
      }
    }

    return results;
  }

  // ── Churn report ────────────────────────────────────────────────────────

  async getChurnReport(tenantId?: string): Promise<ChurnReport> {
    const states = await this.evaluateAllClients(tenantId);

    const total = states.length;

    const countByState = (s: LifecycleState) => states.filter((c) => c.currentState === s).length;

    const newCount = countByState('new');
    const active = countByState('active');
    const loyal = countByState('loyal');
    const atRisk = countByState('at_risk');
    const churned = countByState('churned');
    const recovered = countByState('recovered');

    const churnRate =
      total > 0 ? parseFloat(((churned / total) * 100).toFixed(2)) : 0;
    const avgLtv =
      total > 0
        ? parseFloat((states.reduce((s, c) => s + c.ltv, 0) / total).toFixed(2))
        : 0;

    // Revenue at risk = totalSpent of at_risk clients (they might churn)
    const revenueAtRisk = parseFloat(
      states
        .filter((c) => c.currentState === 'at_risk')
        .reduce((s, c) => s + c.totalSpent, 0)
        .toFixed(2),
    );

    return {
      total,
      new: newCount,
      active,
      loyal,
      atRisk,
      churned,
      recovered,
      churnRate,
      avgLtv,
      revenueAtRisk,
    };
  }

  // ── Scheduled weekly evaluation ─────────────────────────────────────────

  async scheduleWeeklyEvaluation(): Promise<void> {
    this.logger.log('Running weekly lifecycle evaluation for all clients...');

    try {
      const results = await this.evaluateAllClients();

      this.eventBus.emit('lifecycle.weekly_evaluation.completed', {
        evaluatedAt: new Date().toISOString(),
        totalClients: results.length,
        stateSummary: {
          new: results.filter((c) => c.currentState === 'new').length,
          active: results.filter((c) => c.currentState === 'active').length,
          loyal: results.filter((c) => c.currentState === 'loyal').length,
          atRisk: results.filter((c) => c.currentState === 'at_risk').length,
          churned: results.filter((c) => c.currentState === 'churned').length,
          recovered: results.filter((c) => c.currentState === 'recovered').length,
        },
      });

      this.logger.log(
        `Weekly lifecycle evaluation complete — ${results.length} clients evaluated`,
      );
    } catch (err) {
      this.logger.error('scheduleWeeklyEvaluation failed', (err as Error).stack);
    }
  }
}
