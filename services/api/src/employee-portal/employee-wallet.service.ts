import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EmployeeWallet, WalletTransaction } from '@prisma/client';

@Injectable()
export class EmployeeWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async grantAllowance(
    walletId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.employeeWallet.findUniqueOrThrow({ where: { id: walletId } });
      const newBalance = Number(wallet.balance) + amount;

      await tx.employeeWallet.update({
        where: { id: walletId },
        data: {
          balance: newBalance,
          totalGranted: Number(wallet.totalGranted) + amount,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          type: 'credit',
          amount,
          balanceAfter: newBalance,
          description,
          referenceType: 'allowance_grant',
        },
      });
    });

    this.events.emit('wallet.allowance.granted', { walletId, amount });
  }

  async spend(
    walletId: string,
    amount: number,
    description: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.employeeWallet.findUniqueOrThrow({ where: { id: walletId } });
      const currentBalance = Number(wallet.balance);

      if (currentBalance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = currentBalance - amount;

      await tx.employeeWallet.update({
        where: { id: walletId },
        data: {
          balance: newBalance,
          totalSpent: Number(wallet.totalSpent) + amount,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          type: 'debit',
          amount,
          balanceAfter: newBalance,
          description,
          referenceId: referenceId ?? null,
          referenceType: referenceType ?? null,
        },
      });
    });
  }

  async getOrCreateWallet(params: {
    companyId: string;
    tenantId: string;
    employeeEmail: string;
    employeeName: string;
    department?: string;
  }): Promise<EmployeeWallet> {
    const existing = await this.prisma.employeeWallet.findUnique({
      where: {
        companyId_employeeEmail: {
          companyId: params.companyId,
          employeeEmail: params.employeeEmail,
        },
      },
    });

    if (existing) return existing;

    return this.prisma.employeeWallet.create({
      data: {
        companyId: params.companyId,
        tenantId: params.tenantId,
        employeeEmail: params.employeeEmail,
        employeeName: params.employeeName,
        department: params.department ?? null,
      },
    });
  }

  async getWallet(walletId: string): Promise<EmployeeWallet & { transactions: WalletTransaction[] }> {
    return this.prisma.employeeWallet.findUniqueOrThrow({
      where: { id: walletId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async getCompanyWallets(companyId: string, tenantId: string): Promise<EmployeeWallet[]> {
    return this.prisma.employeeWallet.findMany({
      where: { companyId, tenantId },
      orderBy: { employeeName: 'asc' },
    });
  }

  async getPlatformStats(): Promise<{
    totalWallets: number;
    totalBalance: number;
    totalGranted: number;
    totalSpent: number;
    byDepartment: Array<{ department: string; balance: number; spent: number }>;
  }> {
    const wallets = await this.prisma.employeeWallet.findMany({
      where: { isActive: true },
    });

    const totalWallets = wallets.length;
    const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
    const totalGranted = wallets.reduce((s, w) => s + Number(w.totalGranted), 0);
    const totalSpent = wallets.reduce((s, w) => s + Number(w.totalSpent), 0);

    const deptMap = new Map<string, { balance: number; spent: number }>();
    for (const w of wallets) {
      const dept = w.department ?? 'Unknown';
      const prev = deptMap.get(dept) ?? { balance: 0, spent: 0 };
      deptMap.set(dept, {
        balance: prev.balance + Number(w.balance),
        spent: prev.spent + Number(w.totalSpent),
      });
    }

    const byDepartment = Array.from(deptMap.entries()).map(([department, vals]) => ({
      department,
      balance: vals.balance,
      spent: vals.spent,
    }));

    return { totalWallets, totalBalance, totalGranted, totalSpent, byDepartment };
  }
}
