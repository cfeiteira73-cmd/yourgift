import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BudgetStatus {
  allocationId: string;
  totalEur: number;
  reservedEur: number;
  committedEur: number;
  spentEur: number;
  availableEur: number;
  utilizationPct: number;
  sufficient: boolean;
}

@Injectable()
export class BudgetLedgerService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async createAllocation(params: {
    organizationId: string;
    period: string;
    totalEur: number;
    departmentId?: string;
    category?: string;
    currency?: string;
  }): Promise<any> {
    return this.db.budgetAllocation.create({
      data: {
        organizationId: params.organizationId,
        departmentId: params.departmentId ?? null,
        period: params.period,
        category: params.category ?? null,
        totalEur: params.totalEur,
        currency: params.currency ?? 'EUR',
      },
    });
  }

  async getStatus(allocationId: string): Promise<BudgetStatus> {
    const a = await this.db.budgetAllocation.findUnique({ where: { id: allocationId } });
    if (!a) throw new BadRequestException('Budget allocation not found');
    const total = Number(a.totalEur);
    const reserved = Number(a.reservedEur);
    const committed = Number(a.committedEur);
    const spent = Number(a.spentEur);
    const available = Math.max(0, total - reserved - committed - spent);
    return {
      allocationId,
      totalEur: total,
      reservedEur: reserved,
      committedEur: committed,
      spentEur: spent,
      availableEur: available,
      utilizationPct: total > 0 ? Math.round(((reserved + committed + spent) / total) * 1000) / 10 : 0,
      sufficient: available >= 0,
    };
  }

  async findAllocation(organizationId: string, period: string, departmentId?: string, category?: string): Promise<any | null> {
    return this.db.budgetAllocation.findFirst({
      where: {
        organizationId,
        period,
        departmentId: departmentId ?? null,
        category: category ?? null,
        isActive: true,
      },
    });
  }

  async checkAvailability(organizationId: string, period: string, amountEur: number, departmentId?: string): Promise<{ available: number; sufficient: boolean; allocationId?: string }> {
    const allocation = await this.findAllocation(organizationId, period, departmentId);
    if (!allocation) return { available: 0, sufficient: false };
    const status = await this.getStatus(allocation.id);
    return { available: status.availableEur, sufficient: status.availableEur >= amountEur, allocationId: allocation.id };
  }

  // RESERVE: hold budget against a pending request
  async reserve(allocationId: string, amountEur: number, referenceId: string, createdBy?: string): Promise<void> {
    const status = await this.getStatus(allocationId);
    if (status.availableEur < amountEur) {
      throw new BadRequestException(`Insufficient budget: available €${status.availableEur.toFixed(2)}, requested €${amountEur.toFixed(2)}`);
    }
    await this.db.budgetAllocation.update({
      where: { id: allocationId },
      data: { reservedEur: { increment: amountEur }, updatedAt: new Date() },
    });
    await this.db.budgetTransaction.create({
      data: { budgetAllocationId: allocationId, type: 'reserve', amountEur, referenceId, referenceType: 'procurement_request', createdBy: createdBy ?? null },
    });
  }

  // COMMIT: move from reserved → committed (order placed)
  async commit(allocationId: string, amountEur: number, referenceId: string, createdBy?: string): Promise<void> {
    await this.db.budgetAllocation.update({
      where: { id: allocationId },
      data: { reservedEur: { decrement: amountEur }, committedEur: { increment: amountEur }, updatedAt: new Date() },
    });
    await this.db.budgetTransaction.create({
      data: { budgetAllocationId: allocationId, type: 'commit', amountEur, referenceId, referenceType: 'procurement_request', createdBy: createdBy ?? null },
    });
  }

  // SPEND: move from committed → spent (invoice received)
  async spend(allocationId: string, amountEur: number, referenceId: string, createdBy?: string): Promise<void> {
    await this.db.budgetAllocation.update({
      where: { id: allocationId },
      data: { committedEur: { decrement: amountEur }, spentEur: { increment: amountEur }, updatedAt: new Date() },
    });
    await this.db.budgetTransaction.create({
      data: { budgetAllocationId: allocationId, type: 'spend', amountEur, referenceId, referenceType: 'procurement_request', createdBy: createdBy ?? null },
    });
  }

  // RELEASE: return reserved budget (request cancelled/rejected)
  async release(allocationId: string, amountEur: number, referenceId: string, createdBy?: string): Promise<void> {
    await this.db.budgetAllocation.update({
      where: { id: allocationId },
      data: { reservedEur: { decrement: amountEur }, updatedAt: new Date() },
    });
    await this.db.budgetTransaction.create({
      data: { budgetAllocationId: allocationId, type: 'release', amountEur, referenceId, referenceType: 'procurement_request', createdBy: createdBy ?? null },
    });
  }

  async getTransactions(allocationId: string, limit = 50): Promise<any[]> {
    return this.db.budgetTransaction.findMany({
      where: { budgetAllocationId: allocationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getOrgAllocations(organizationId: string): Promise<any[]> {
    return this.db.budgetAllocation.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
