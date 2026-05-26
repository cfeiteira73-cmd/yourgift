import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DecisionTraceService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async createTrace(params: {
    decisionCardId?: string;
    traceType?: string;
    inputSnapshot: object;
    simulationResults?: object[];
    selectedAction?: string;
    autonomyLevel?: number;
  }): Promise<any> {
    return this.db.decisionTrace.create({
      data: {
        decisionCardId: params.decisionCardId ?? null,
        traceType: params.traceType ?? 'order_triggered',
        inputSnapshot: params.inputSnapshot as unknown as object,
        simulationResults: (params.simulationResults ?? []) as unknown as object,
        selectedAction: params.selectedAction ?? null,
        governanceStatus: 'pending',
        executionStatus: 'pending',
        autonomyLevel: params.autonomyLevel ?? 1,
      },
    });
  }

  async recordGovernanceCheck(
    traceId: string,
    result: { status: string; reason: string; autonomyLevel: number },
  ): Promise<void> {
    await this.db.decisionTrace.update({
      where: { id: traceId },
      data: {
        governanceStatus: result.status,
        governanceReason: result.reason,
        autonomyLevel: result.autonomyLevel,
        updatedAt: new Date(),
      },
    });
  }

  async recordExecution(
    traceId: string,
    executionResult: { status: string; data?: object },
  ): Promise<void> {
    await this.db.decisionTrace.update({
      where: { id: traceId },
      data: {
        executionStatus: executionResult.status,
        executionResult: executionResult.data as unknown as object ?? null,
        updatedAt: new Date(),
      },
    });
  }

  async recordOutcome(
    traceId: string,
    outcomeData: object,
    trustScore?: number,
  ): Promise<void> {
    await this.db.decisionTrace.update({
      where: { id: traceId },
      data: {
        outcomeRecorded: true,
        outcomeData: outcomeData as unknown as object,
        trustScore: trustScore ?? null,
        updatedAt: new Date(),
      },
    });
  }

  async getTrace(traceId: string): Promise<any | null> {
    return this.db.decisionTrace.findUnique({ where: { id: traceId } });
  }

  async listTraces(limit = 50): Promise<any[]> {
    return this.db.decisionTrace.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getTracesByDecisionCard(decisionCardId: string): Promise<any[]> {
    return this.db.decisionTrace.findMany({
      where: { decisionCardId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTraceStats(): Promise<{
    total: number;
    allowed: number;
    blocked: number;
    escalated: number;
    requiresApproval: number;
    outcomeRecorded: number;
    avgTrustScore: number;
  }> {
    const [total, allowed, blocked, escalated, needsApproval, withOutcome, trustAgg] = await Promise.all([
      this.db.decisionTrace.count(),
      this.db.decisionTrace.count({ where: { governanceStatus: 'allowed' } }),
      this.db.decisionTrace.count({ where: { governanceStatus: 'blocked' } }),
      this.db.decisionTrace.count({ where: { governanceStatus: 'escalated' } }),
      this.db.decisionTrace.count({ where: { governanceStatus: 'requires_approval' } }),
      this.db.decisionTrace.count({ where: { outcomeRecorded: true } }),
      this.db.decisionTrace.aggregate({ _avg: { trustScore: true } }),
    ]);
    return {
      total,
      allowed,
      blocked,
      escalated,
      requiresApproval: needsApproval,
      outcomeRecorded: withOutcome,
      avgTrustScore: Math.round(Number(trustAgg._avg.trustScore ?? 0) * 10) / 10,
    };
  }
}
