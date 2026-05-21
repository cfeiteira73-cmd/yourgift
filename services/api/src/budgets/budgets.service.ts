import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { Budget, Prisma } from '@prisma/client';

export interface BudgetAvailability {
  available: boolean;
  remaining: number;
  budget: Budget | null;
}

export interface DepartmentSpend {
  departmentId: string | null;
  departmentName: string | null;
  limitAmount: number;
  spentAmount: number;
  utilization: number;
}

export interface SpendAnalytics {
  totalLimit: number;
  totalSpent: number;
  utilization: number;
  byDepartment: DepartmentSpend[];
}

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {
    this.events.on('order.paid', this.onOrderPaid.bind(this));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async create(dto: CreateBudgetDto) {
    const budget = await this.prisma.budget.create({
      data: {
        companyId: dto.companyId,
        departmentId: dto.departmentId ?? null,
        name: dto.name,
        period: dto.period,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        limitAmount: dto.limitAmount,
        alertThreshold: dto.alertThreshold ?? 0.8,
        spentAmount: 0,
        isActive: true,
        alertSent: false,
      },
      include: { company: true, department: true },
    });

    await this.logEvent('budget', budget.id, 'budget.created', 'system', 'system', {
      companyId: dto.companyId,
      name: dto.name,
      limitAmount: dto.limitAmount,
    });

    this.events.emit('budget.created', budget);
    return budget;
  }

  async findForCompany(companyId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { companyId },
      include: { department: true },
      orderBy: { periodStart: 'desc' },
    });

    return budgets.map((b) => ({
      ...b,
      remaining: parseFloat((b.limitAmount - b.spentAmount).toFixed(2)),
      utilizationPct: parseFloat(((b.spentAmount / b.limitAmount) * 100).toFixed(1)),
    }));
  }

  async checkAvailability(
    companyId: string,
    departmentId: string | null,
    amount: number,
  ): Promise<BudgetAvailability> {
    const budget = await this.findActiveBudget(companyId, departmentId);
    if (!budget) {
      return { available: true, remaining: Infinity, budget: null };
    }

    const remaining = parseFloat((budget.limitAmount - budget.spentAmount).toFixed(2));
    return {
      available: remaining >= amount,
      remaining,
      budget,
    };
  }

  async deductSpend(
    companyId: string,
    departmentId: string | null,
    amount: number,
    orderId: string,
  ) {
    const budget = await this.findActiveBudget(companyId, departmentId);
    if (!budget) return null; // No active budget — no deduction needed

    const newSpent = parseFloat((budget.spentAmount + amount).toFixed(2));
    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { spentAmount: newSpent },
    });

    await this.logEvent('budget', budget.id, 'budget.deducted', 'system', 'system', {
      orderId,
      amount,
      newSpent,
    });

    // Check alert threshold
    const utilization = newSpent / budget.limitAmount;
    if (utilization >= budget.alertThreshold && !budget.alertSent) {
      await this.prisma.budget.update({
        where: { id: budget.id },
        data: { alertSent: true },
      });

      await this.logEvent('budget', budget.id, 'budget.alert', 'system', 'system', {
        utilization: parseFloat((utilization * 100).toFixed(1)),
        threshold: budget.alertThreshold * 100,
      });

      this.events.emit('budget.alert', {
        budget: updated,
        utilization,
        companyId,
        departmentId,
      });
    }

    return updated;
  }

  async getSpendAnalytics(companyId: string): Promise<SpendAnalytics> {
    const budgets = await this.prisma.budget.findMany({
      where: { companyId, isActive: true },
      include: { department: true },
    });

    const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spentAmount, 0);
    const utilization =
      totalLimit > 0
        ? parseFloat(((totalSpent / totalLimit) * 100).toFixed(1))
        : 0;

    const byDepartment: DepartmentSpend[] = budgets.map((b) => ({
      departmentId: b.departmentId,
      departmentName: (b as any).department?.name ?? null,
      limitAmount: b.limitAmount,
      spentAmount: b.spentAmount,
      utilization:
        b.limitAmount > 0
          ? parseFloat(((b.spentAmount / b.limitAmount) * 100).toFixed(1))
          : 0,
    }));

    return {
      totalLimit: parseFloat(totalLimit.toFixed(2)),
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      utilization,
      byDepartment,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findActiveBudget(
    companyId: string,
    departmentId: string | null,
  ): Promise<Budget | null> {
    const now = new Date();
    // Prefer department-scoped budget, fall back to company-wide
    const candidates = await this.prisma.budget.findMany({
      where: {
        companyId,
        isActive: true,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        departmentId: departmentId
          ? { in: [departmentId, null as unknown as string] }
          : null,
      },
      orderBy: [
        // Department-scoped first
        { departmentId: 'desc' },
        { periodStart: 'desc' },
      ],
    });

    if (candidates.length === 0 && departmentId) {
      // Fallback to company-wide budget
      return this.prisma.budget.findFirst({
        where: {
          companyId,
          isActive: true,
          departmentId: null,
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
        orderBy: { periodStart: 'desc' },
      });
    }

    return candidates[0] ?? null;
  }

  private async onOrderPaid(order: {
    id: string;
    companyId?: string;
    departmentId?: string;
    totalAmount?: number;
  }) {
    if (!order.companyId || !order.totalAmount) return;
    await this.deductSpend(
      order.companyId,
      order.departmentId ?? null,
      order.totalAmount,
      order.id,
    );
  }

  private async logEvent(
    entity: string,
    entityId: string,
    event: string,
    actorId: string,
    actorType: string,
    payload: Prisma.InputJsonValue,
  ) {
    await this.prisma.eventLog.create({
      data: { entity, entityId, event, actorId, actorType, payload, orderId: null },
    });
  }
}
