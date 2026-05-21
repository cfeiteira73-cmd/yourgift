import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

type ApprovalStage = 'hr' | 'manager' | 'finance';

const STAGE_SEQUENCE: ApprovalStage[] = ['hr', 'manager', 'finance'];

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
  ) {
    // Listen for paid orders that require approval
    this.events.on('order.paid', this.onOrderPaid.bind(this));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async requestApproval(
    orderId: string,
    requestedById: string,
    stage: ApprovalStage,
  ) {
    // Ensure the order exists
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // Guard: no duplicate pending approval for the same stage
    const existing = await this.prisma.approval.findFirst({
      where: { orderId, stage, status: 'pending' },
    });
    if (existing) {
      throw new BadRequestException(
        `A pending ${stage} approval already exists for order ${orderId}`,
      );
    }

    const approval = await this.prisma.approval.create({
      data: { orderId, requestedById, stage, status: 'pending' },
      include: { order: true, requestedBy: true },
    });

    await this.logEvent(
      'approval',
      approval.id,
      'approval.requested',
      requestedById,
      'client',
      { orderId, stage },
      orderId,
    );

    this.events.emit('approval.requested', approval);
    return approval;
  }

  async approve(id: string, approverId: string, notes?: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!approval) throw new NotFoundException(`Approval ${id} not found`);
    if (approval.status !== 'pending') {
      throw new BadRequestException(
        `Approval is already "${approval.status}"`,
      );
    }

    const updated = await this.prisma.approval.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: approverId,
        notes: notes ?? null,
        resolvedAt: new Date(),
      },
      include: { order: true },
    });

    await this.logEvent(
      'approval',
      id,
      'approval.resolved',
      approverId,
      'client',
      { stage: approval.stage, status: 'approved', notes },
      approval.orderId,
    );

    this.events.emit('approval.resolved', updated);

    // Advance workflow: check if next stage is needed
    await this.advanceWorkflow(approval.orderId, approval.stage as ApprovalStage);

    return updated;
  }

  async reject(id: string, approverId: string, notes: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!approval) throw new NotFoundException(`Approval ${id} not found`);
    if (approval.status !== 'pending') {
      throw new BadRequestException(`Approval is already "${approval.status}"`);
    }

    const updated = await this.prisma.approval.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: approverId,
        notes,
        resolvedAt: new Date(),
      },
    });

    // Cancel the order
    await this.prisma.order.update({
      where: { id: approval.orderId },
      data: { status: 'cancelled' },
    });

    await this.logEvent(
      'approval',
      id,
      'approval.rejected',
      approverId,
      'client',
      { stage: approval.stage, notes },
      approval.orderId,
    );

    this.events.emit('approval.rejected', {
      approval: updated,
      orderId: approval.orderId,
    });

    this.events.emit('order.cancelled', { orderId: approval.orderId, reason: 'approval_rejected' });

    return updated;
  }

  async getPendingForApprover(email: string) {
    // Approvals are stored with approvedById (the resolver's id) but we need to
    // find by email. We look up clients by email and return pending approvals for
    // their orders or where they are the designated approver via department head.
    const approvals = await this.prisma.approval.findMany({
      where: { status: 'pending' },
      include: {
        order: {
          include: {
            client: true,
            company: true,
            department: true,
          },
        },
        requestedBy: true,
      },
      orderBy: { requestedAt: 'asc' },
    });

    // Filter by department head email matching the approver's email
    return approvals.filter((a) => {
      const dept = (a.order as any).department;
      if (dept && dept.headEmail === email) return true;
      // For finance stage, also match company billing email
      if (a.stage === 'finance') {
        const company = (a.order as any).company;
        return company?.billingEmail === email;
      }
      return false;
    });
  }

  async getForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    return this.prisma.approval.findMany({
      where: { orderId },
      include: { requestedBy: true },
      orderBy: { requestedAt: 'asc' },
    });
  }

  // ── Private orchestration ─────────────────────────────────────────────────

  private async advanceWorkflow(
    orderId: string,
    completedStage: ApprovalStage,
  ) {
    const stageIndex = STAGE_SEQUENCE.indexOf(completedStage);
    const nextStage = STAGE_SEQUENCE[stageIndex + 1] as ApprovalStage | undefined;

    if (!nextStage) {
      // All stages done — mark order as approved
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'approved', approvedAt: new Date() },
      });

      await this.logEvent(
        'order',
        orderId,
        'order.approved',
        'system',
        'system',
        { completedStage },
        orderId,
      );

      this.events.emit('order.approved', order);
      return;
    }

    // Check whether company requires this next stage
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: true },
    });
    if (!order) return;

    // For enterprise clients we run all stages; for others we skip to finance
    const clientTier = order.client.tier;
    const skipHr = clientTier !== 'enterprise' && nextStage === 'hr';
    const skipManager = clientTier === 'standard' && nextStage === 'manager';

    if (skipHr || skipManager) {
      await this.advanceWorkflow(orderId, nextStage);
      return;
    }

    // Create the next approval stage automatically
    await this.requestApproval(orderId, order.clientId, nextStage);
  }

  private async onOrderPaid(order: { id: string; clientId: string; totalAmount?: number }) {
    // Only trigger approval workflow for orders above €1 000 or enterprise clients
    const client = await this.prisma.client.findUnique({
      where: { id: order.clientId },
    });
    if (!client) return;

    const threshold = 1000;
    const requiresApproval =
      client.tier === 'enterprise' || (order.totalAmount ?? 0) >= threshold;

    if (!requiresApproval) return;

    // Start at first stage
    await this.requestApproval(order.id, order.clientId, 'hr');
  }

  private async logEvent(
    entity: string,
    entityId: string,
    event: string,
    actorId: string,
    actorType: string,
    payload: Prisma.InputJsonValue,
    orderId?: string,
  ) {
    await this.prisma.eventLog.create({
      data: { entity, entityId, event, actorId, actorType, payload, orderId: orderId ?? null },
    });
  }
}
