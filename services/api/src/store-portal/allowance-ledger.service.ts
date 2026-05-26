import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export type LedgerEntryType = 'credit' | 'debit' | 'adjustment' | 'refund' | 'reset';

@Injectable()
export class AllowanceLedgerService {
  private readonly logger = new Logger(AllowanceLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get current balance by reading the last ledger entry (source of truth) */
  async getBalance(employeeId: string): Promise<number> {
    const last = await this.prisma.allowanceLedgerEntry.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return last?.balance ?? 0;
  }

  /** Credit allowance (top-up by admin) */
  async credit(
    employeeId: string,
    storeId: string,
    amount: number,
    description: string,
    actorId?: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException('Credit amount must be positive');
    const currentBalance = await this.getBalance(employeeId);
    const newBalance = Math.round((currentBalance + amount) * 100) / 100;

    await this.prisma.allowanceLedgerEntry.create({
      data: {
        employeeId,
        storeId,
        amount,
        balance: newBalance,
        entryType: 'credit',
        description,
        actorId: actorId ?? null,
        actorType: actorId ? 'admin' : 'system',
      },
    });

    // Sync denormalized allowance field so existing queries remain valid
    await this.prisma.storeEmployee.update({
      where: { id: employeeId },
      data: { allowance: newBalance },
    });

    this.logger.log(
      `Allowance credit: employee=${employeeId} +€${amount} → balance=€${newBalance}`,
    );
    return newBalance;
  }

  /** Debit allowance (employee places order) — atomic with balance check */
  async debit(
    employeeId: string,
    storeId: string,
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException('Debit amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction for concurrency safety
      const employee = await tx.storeEmployee.findUniqueOrThrow({
        where: { id: employeeId },
      });

      if (employee.allowance > 0 && employee.spent + amount > employee.allowance) {
        throw new BadRequestException(
          `Insufficient allowance: available €${(employee.allowance - employee.spent).toFixed(2)}, requested €${amount.toFixed(2)}`,
        );
      }

      const currentBalance = await this.getBalanceTx(tx, employeeId);
      const newBalance = Math.round((currentBalance - amount) * 100) / 100;

      await tx.allowanceLedgerEntry.create({
        data: {
          employeeId,
          storeId,
          amount: -amount,
          balance: newBalance,
          entryType: 'debit',
          referenceId,
          description,
          actorId: employeeId,
          actorType: 'employee',
        },
      });

      await tx.storeEmployee.update({
        where: { id: employeeId },
        data: { spent: { increment: amount } },
      });

      this.logger.log(
        `Allowance debit: employee=${employeeId} -€${amount} ref=${referenceId}`,
      );
      return newBalance;
    });
  }

  /** Refund allowance (order cancelled) */
  async refund(
    employeeId: string,
    storeId: string,
    amount: number,
    referenceId: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException('Refund amount must be positive');
    const currentBalance = await this.getBalance(employeeId);
    const newBalance = Math.round((currentBalance + amount) * 100) / 100;

    await this.prisma.allowanceLedgerEntry.create({
      data: {
        employeeId,
        storeId,
        amount,
        balance: newBalance,
        entryType: 'refund',
        referenceId,
        description: `Refund for order ${referenceId}`,
        actorType: 'system',
      },
    });

    await this.prisma.storeEmployee.update({
      where: { id: employeeId },
      data: { spent: { decrement: amount } },
    });

    this.logger.log(
      `Allowance refund: employee=${employeeId} +€${amount} ref=${referenceId}`,
    );
    return newBalance;
  }

  /** Get full ledger history for an employee */
  async getHistory(employeeId: string, limit = 50) {
    return this.prisma.allowanceLedgerEntry.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Helper: read last balance inside an existing transaction */
  private async getBalanceTx(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ): Promise<number> {
    const last = await tx.allowanceLedgerEntry.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return last?.balance ?? 0;
  }
}
