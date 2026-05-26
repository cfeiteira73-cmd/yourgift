import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EmployeeWalletService } from './employee-wallet.service';
import { ProcurementRequest } from '@prisma/client';

@Injectable()
export class ProcurementRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly wallet: EmployeeWalletService,
  ) {}

  async submitRequest(params: {
    walletId: string;
    companyId: string;
    tenantId: string;
    employeeEmail: string;
    department?: string;
    productName: string;
    productId?: string;
    variantId?: string;
    quantity: number;
    unitPrice?: number;
    currency?: string;
    urgency?: string;
    justification?: string;
  }): Promise<ProcurementRequest> {
    const totalAmount =
      params.unitPrice != null ? params.unitPrice * params.quantity : null;

    const request = await this.prisma.procurementRequest.create({
      data: {
        walletId: params.walletId,
        companyId: params.companyId,
        tenantId: params.tenantId,
        employeeEmail: params.employeeEmail,
        department: params.department ?? null,
        productName: params.productName,
        productId: params.productId ?? null,
        variantId: params.variantId ?? null,
        quantity: params.quantity,
        unitPrice: params.unitPrice ?? null,
        totalAmount: totalAmount ?? null,
        currency: params.currency ?? 'EUR',
        urgency: params.urgency ?? 'normal',
        justification: params.justification ?? null,
        status: 'pending',
      },
    });

    this.events.emit('procurement.request.submitted', { requestId: request.id });
    return request;
  }

  async approveRequest(requestId: string, approvedBy: string): Promise<void> {
    const request = await this.prisma.procurementRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (request.totalAmount != null) {
      await this.wallet.spend(
        request.walletId,
        Number(request.totalAmount),
        `Procurement: ${request.productName}`,
        requestId,
        'procurement_request',
      );
    }

    await this.prisma.procurementRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    this.events.emit('procurement.request.approved', {
      requestId,
      approvedBy,
      walletId: request.walletId,
      amount: request.totalAmount != null ? Number(request.totalAmount) : 0,
    });
  }

  async rejectRequest(requestId: string, reason: string, rejectedBy: string): Promise<void> {
    await this.prisma.procurementRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: rejectedBy,
      },
    });

    this.events.emit('procurement.request.rejected', { requestId, reason, rejectedBy });
  }

  async getPendingRequests(tenantId: string): Promise<ProcurementRequest[]> {
    const urgencyOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const rows = await this.prisma.procurementRequest.findMany({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return rows.sort(
      (a, b) =>
        (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99),
    );
  }

  async getRequestStats(tenantId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    totalValue: number;
    avgApprovalHours: number;
    byUrgency: Record<string, number>;
  }> {
    const requests = await this.prisma.procurementRequest.findMany({
      where: { tenantId },
    });

    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const totalValue = requests.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0);

    const approvedWithTime = requests.filter(
      (r) => r.status === 'approved' && r.approvedAt != null,
    );
    const avgApprovalHours =
      approvedWithTime.length > 0
        ? approvedWithTime.reduce((s, r) => {
            const ms = r.approvedAt!.getTime() - r.createdAt.getTime();
            return s + ms / 3_600_000;
          }, 0) / approvedWithTime.length
        : 0;

    const byUrgency: Record<string, number> = {};
    for (const r of requests) {
      byUrgency[r.urgency] = (byUrgency[r.urgency] ?? 0) + 1;
    }

    return { pending, approved, rejected, totalValue, avgApprovalHours, byUrgency };
  }
}
