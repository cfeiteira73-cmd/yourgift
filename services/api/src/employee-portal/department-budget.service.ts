import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { DepartmentBudget } from '@prisma/client';

@Injectable()
export class DepartmentBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async setBudget(params: {
    tenantId: string;
    companyId: string;
    department: string;
    fiscalYear: number;
    fiscalQuarter?: number;
    totalBudget: number;
    currency?: string;
    alertThreshold?: number;
  }): Promise<DepartmentBudget> {
    return this.prisma.departmentBudget.upsert({
      where: {
        tenantId_companyId_department_fiscalYear_fiscalQuarter: {
          tenantId: params.tenantId,
          companyId: params.companyId,
          department: params.department,
          fiscalYear: params.fiscalYear,
          fiscalQuarter: (params.fiscalQuarter ?? null) as number,
        },
      },
      create: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        department: params.department,
        fiscalYear: params.fiscalYear,
        fiscalQuarter: params.fiscalQuarter ?? null,
        totalBudget: params.totalBudget,
        currency: params.currency ?? 'EUR',
        alertThreshold: params.alertThreshold ?? 80,
      },
      update: {
        totalBudget: params.totalBudget,
        currency: params.currency ?? 'EUR',
        alertThreshold: params.alertThreshold ?? 80,
      },
    });
  }

  async recordSpend(
    tenantId: string,
    companyId: string,
    department: string,
    amount: number,
    fiscalYear: number,
  ): Promise<void> {
    const budget = await this.prisma.departmentBudget.findFirst({
      where: { tenantId, companyId, department, fiscalYear },
    });

    if (!budget) return;

    const newSpent = Number(budget.spent) + amount;
    const utilization = (newSpent / Number(budget.totalBudget)) * 100;
    const threshold = Number(budget.alertThreshold);
    const prevUtilization =
      (Number(budget.spent) / Number(budget.totalBudget)) * 100;

    await this.prisma.departmentBudget.update({
      where: { id: budget.id },
      data: { spent: newSpent },
    });

    if (prevUtilization < threshold && utilization >= threshold) {
      this.events.emit('budget.threshold.exceeded', {
        budgetId: budget.id,
        tenantId,
        companyId,
        department,
        utilizationPct: utilization,
        threshold,
      });
    }
  }

  async getBudgets(tenantId: string, fiscalYear?: number): Promise<DepartmentBudget[]> {
    return this.prisma.departmentBudget.findMany({
      where: {
        tenantId,
        ...(fiscalYear ? { fiscalYear } : {}),
      },
      orderBy: [{ fiscalYear: 'desc' }, { department: 'asc' }],
    });
  }

  async getBudgetSummary(tenantId: string): Promise<{
    totalBudget: number;
    totalSpent: number;
    utilizationPct: number;
    atRisk: Array<{ department: string; utilizationPct: number }>;
    byDepartment: DepartmentBudget[];
  }> {
    const budgets = await this.prisma.departmentBudget.findMany({
      where: { tenantId },
      orderBy: { department: 'asc' },
    });

    const totalBudget = budgets.reduce((s, b) => s + Number(b.totalBudget), 0);
    const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
    const utilizationPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const atRisk = budgets
      .map((b) => ({
        department: b.department,
        utilizationPct:
          Number(b.totalBudget) > 0
            ? (Number(b.spent) / Number(b.totalBudget)) * 100
            : 0,
      }))
      .filter((b) => b.utilizationPct >= 80)
      .sort((a, b) => b.utilizationPct - a.utilizationPct);

    return { totalBudget, totalSpent, utilizationPct, atRisk, byDepartment: budgets };
  }
}
