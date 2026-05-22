import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

type ActionType = 'send_notification' | 'create_job' | 'update_status' | 'flag_review';
type Condition = { field: string; op: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne'; value: unknown };

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);
  private readonly WATCHED_EVENTS = [
    'order.created', 'order.paid', 'order.approved',
    'order.shipped', 'order.delivered', 'order.cancelled',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    for (const eventType of this.WATCHED_EVENTS) {
      this.events.on(eventType, (payload: Record<string, unknown>) => {
        void this.evaluate(eventType, payload);
      });
    }
    this.logger.log(`Automation engine watching ${this.WATCHED_EVENTS.length} event types`);
  }

  private matchesCondition(payload: Record<string, unknown>, condition: Condition): boolean {
    if (!condition.field) return true; // empty condition = always match
    const val = payload[condition.field];
    const num = Number(val);
    const cmp = Number(condition.value);
    switch (condition.op) {
      case 'gt':  return num > cmp;
      case 'lt':  return num < cmp;
      case 'gte': return num >= cmp;
      case 'lte': return num <= cmp;
      case 'eq':  return val === condition.value;
      case 'ne':  return val !== condition.value;
      default: return true;
    }
  }

  private async evaluate(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { triggerEvent: eventType, isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (!rules.length) return;

    for (const rule of rules) {
      const condition = rule.conditions as Condition;
      const matches = !condition.field || this.matchesCondition(payload, condition);

      if (!matches) {
        await this.prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            triggerPayload: payload as object,
            status: 'skipped',
            result: { reason: 'condition_not_met' },
          },
        });
        continue;
      }

      try {
        const result = await this.executeAction(
          rule.actionType as ActionType,
          rule.actionConfig as Record<string, unknown>,
          payload,
        );
        await this.prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            triggerPayload: payload as object,
            status: 'success',
            result: result as object,
          },
        });
        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() },
        });
        this.logger.log(`Rule "${rule.name}" executed for ${eventType}`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await this.prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            triggerPayload: payload as object,
            status: 'failed',
            result: {},
            error,
          },
        });
        this.logger.error(`Rule "${rule.name}" failed: ${error}`);
      }
    }
  }

  private async executeAction(
    actionType: ActionType,
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (actionType) {
      case 'send_notification':
        this.events.emit('notification.send', { ...config, payload });
        return { sent: true, channel: config['channel'] };

      case 'create_job':
        // Enqueue via jobs table directly (avoid circular dep with JobsService)
        await this.prisma.job.create({
          data: {
            type: String(config['jobType']),
            payload: payload as object,
            scheduledAt: new Date(),
          },
        });
        return { jobCreated: true, jobType: config['jobType'] };

      case 'update_status':
        if (payload['orderId'] || payload['_streamId']) {
          const id = String(payload['orderId'] ?? payload['_streamId']);
          await this.prisma.order.update({
            where: { id },
            data: { status: String(config['newStatus']) },
          });
          return { updated: true, newStatus: config['newStatus'] };
        }
        return { updated: false, reason: 'no_order_id' };

      case 'flag_review':
        this.events.emit('order.flagged', { ...payload, flagReason: config['reason'] });
        return { flagged: true, reason: config['reason'] };

      default:
        return { unknown: true };
    }
  }

  async getRules(): Promise<unknown[]> {
    return this.prisma.automationRule.findMany({ orderBy: { priority: 'desc' } });
  }

  async getExecutions(limit = 50) {
    return this.prisma.automationExecution.findMany({
      orderBy: { executedAt: 'desc' },
      take: limit,
      include: { rule: { select: { name: true, actionType: true } } },
    });
  }

  async getStats() {
    const [total, active, executions] = await Promise.all([
      this.prisma.automationRule.count(),
      this.prisma.automationRule.count({ where: { isActive: true } }),
      this.prisma.automationExecution.groupBy({ by: ['status'], _count: { id: true } }),
    ]);
    const execMap = Object.fromEntries(executions.map(e => [e.status, e._count.id]));
    return { totalRules: total, activeRules: active, executions: execMap };
  }

  async toggleRule(id: string, isActive: boolean) {
    return this.prisma.automationRule.update({ where: { id }, data: { isActive } });
  }
}
