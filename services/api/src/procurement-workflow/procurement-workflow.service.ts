import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyExecutionService } from '../policy-execution/policy-execution.service';
import { BudgetLedgerService } from '../budget-ledger/budget-ledger.service';
import { EventBusService } from '../events/event-bus.service';

export type RequestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executing' | 'fulfilled' | 'completed' | 'cancelled';

@Injectable()
export class ProcurementWorkflowService {
  private get db(): any { return this.prisma; }

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyExecutionService,
    private readonly budget: BudgetLedgerService,
    private readonly eventBus: EventBusService,
  ) {}

  async createRequest(params: {
    tenantId?: string;
    organizationId?: string;
    requesterId: string;
    title: string;
    description?: string;
    category?: string;
    supplierCode?: string;
    estimatedCostEur?: number;
    quantity?: number;
  }): Promise<any> {
    return this.db.workflowProcurementRequest.create({
      data: {
        tenantId: params.tenantId ?? 'default',
        organizationId: params.organizationId ?? null,
        requesterId: params.requesterId,
        title: params.title,
        description: params.description ?? null,
        category: params.category ?? null,
        supplierCode: params.supplierCode ?? null,
        estimatedCostEur: params.estimatedCostEur ?? null,
        quantity: params.quantity ?? null,
      },
    });
  }

  async submitForApproval(requestId: string, clientId: string, ip?: string): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'draft') throw new BadRequestException('Only draft requests can be submitted');

    // Run policy evaluation
    const policyResult = await this.policy.evaluate({
      clientId,
      organizationId: request.organizationId ?? undefined,
      action: 'procurement_order',
      category: request.category ?? undefined,
      supplierCode: request.supplierCode ?? undefined,
      tenantId: request.tenantId,
      amountEur: request.estimatedCostEur ? Number(request.estimatedCostEur) : undefined,
      permissionRequired: 'procurement.create',
      ip,
    });

    const newStatus: RequestStatus = policyResult.decision === 'deny' ? 'rejected'
      : policyResult.decision === 'allow' ? 'approved'
      : 'pending_approval';

    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        policyDecision: policyResult.decision,
        policyReason: policyResult.reason,
        approvalChainId: policyResult.details.approvalChain?.id ?? null,
        updatedAt: new Date(),
      },
    });

    this.eventBus.emit('procurement.submitted', { requestId, decision: policyResult.decision, tenantId: request.tenantId });
    return { request: updated, policyResult };
  }

  async approve(requestId: string, approverId: string): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (!['pending_approval', 'draft'].includes(request.status)) {
      throw new BadRequestException(`Cannot approve request in status: ${request.status}`);
    }

    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: { status: 'approved', approvedBy: approverId, updatedAt: new Date() },
    });

    // Reserve budget if allocation exists
    if (request.budgetAllocationId && request.estimatedCostEur) {
      try {
        await this.budget.reserve(request.budgetAllocationId, Number(request.estimatedCostEur), requestId, approverId);
      } catch { }
    }

    this.eventBus.emit('procurement.approved', { requestId, approverId, tenantId: request.tenantId });
    return updated;
  }

  async reject(requestId: string, approverId: string, reason: string): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectedBy: approverId, rejectionReason: reason, updatedAt: new Date() },
    });

    this.eventBus.emit('procurement.rejected', { requestId, approverId, reason, tenantId: request.tenantId });
    return updated;
  }

  async execute(requestId: string): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'approved') throw new BadRequestException('Only approved requests can be executed');

    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: { status: 'executing', updatedAt: new Date() },
    });

    // Move budget from reserved → committed
    if (request.budgetAllocationId && request.estimatedCostEur) {
      try {
        await this.budget.commit(request.budgetAllocationId, Number(request.estimatedCostEur), requestId);
      } catch { }
    }

    this.eventBus.emit('procurement.executed', { requestId, tenantId: request.tenantId, supplierCode: request.supplierCode });
    return updated;
  }

  async fulfill(requestId: string, actualCostEur?: number): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const cost = actualCostEur ?? (request.estimatedCostEur ? Number(request.estimatedCostEur) : 0);
    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: { status: 'fulfilled', actualCostEur: cost, fulfilledAt: new Date(), updatedAt: new Date() },
    });

    // Move budget from committed → spent
    if (request.budgetAllocationId && cost > 0) {
      try {
        await this.budget.spend(request.budgetAllocationId, cost, requestId);
      } catch { }
    }

    this.eventBus.emit('procurement.fulfilled', { requestId, actualCostEur: cost, tenantId: request.tenantId });
    return updated;
  }

  async cancel(requestId: string, reason?: string): Promise<any> {
    const request = await this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const updated = await this.db.workflowProcurementRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled', rejectionReason: reason ?? null, updatedAt: new Date() },
    });

    // Release any reserved budget
    if (request.budgetAllocationId && request.estimatedCostEur && ['approved', 'pending_approval'].includes(request.status)) {
      try {
        await this.budget.release(request.budgetAllocationId, Number(request.estimatedCostEur), requestId);
      } catch { }
    }

    this.eventBus.emit('procurement.cancelled', { requestId, tenantId: request.tenantId });
    return updated;
  }

  async getRequest(requestId: string): Promise<any> {
    return this.db.workflowProcurementRequest.findUnique({ where: { id: requestId } });
  }

  async listRequests(filters: { tenantId?: string; organizationId?: string; requesterId?: string; status?: string; limit?: number }): Promise<any[]> {
    return this.db.workflowProcurementRequest.findMany({
      where: {
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.requesterId ? { requesterId: filters.requesterId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }
}
