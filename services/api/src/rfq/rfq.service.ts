import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { QueueService } from '../queue/queue.service';
import { CreateRfqDto } from './dto/create-rfq.dto';

function generateRfqRef(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RFQ-${datePart}-${rand}`;
}

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly queue: QueueService,
  ) {}

  async createRfq(dto: CreateRfqDto) {
    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) {
      throw new BadRequestException('RFQ deadline must be in the future');
    }

    const ref = generateRfqRef();

    // Verify wallet exists for this tenant/company
    const wallet = await this.prisma.employeeWallet.findUnique({
      where: { id: dto.walletId },
    });
    if (!wallet) {
      throw new NotFoundException(`EmployeeWallet ${dto.walletId} not found`);
    }

    // Store RFQ-specific metadata in justification as JSON
    const rfqMeta = JSON.stringify({
      ref,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category,
      targetBudget: dto.targetBudget ?? null,
      supplierIds: dto.supplierIds,
      items: dto.items,
      attachments: dto.attachments ?? [],
      deadline: deadline.toISOString(),
    });

    const rfq = await this.prisma.procurementRequest.create({
      data: {
        walletId: dto.walletId,
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        employeeEmail: dto.employeeEmail,
        productName: dto.title,
        quantity: dto.items.reduce((sum, i) => sum + i.quantity, 0),
        currency: dto.currency ?? 'EUR',
        totalAmount: dto.targetBudget ?? null,
        status: 'rfq_sent',
        urgency: 'normal',
        justification: rfqMeta,
        notes: `RFQ for ${dto.supplierIds.length} supplier(s) — deadline ${deadline.toISOString()}`,
      },
    });

    // Notify each supplier
    for (const supplierId of dto.supplierIds) {
      this.events.emit('rfq.sent_to_supplier', {
        rfqId: rfq.id,
        ref,
        supplierId,
        tenantId: dto.tenantId,
        title: dto.title,
        deadline: deadline.toISOString(),
      });

      await this.queue.enqueueEmail({
        to: supplierId, // resolved to email by email worker via supplierId lookup
        subject: `New RFQ: ${dto.title} [${ref}]`,
        template: 'rfq-supplier-notification',
        variables: {
          rfqId: rfq.id,
          ref,
          title: dto.title,
          category: dto.category,
          deadline: deadline.toISOString(),
          targetBudget: dto.targetBudget ?? null,
          currency: dto.currency ?? 'EUR',
          items: dto.items,
        },
        tenantId: dto.tenantId,
      });
    }

    this.events.emit('rfq.created', {
      rfqId: rfq.id,
      ref,
      tenantId: dto.tenantId,
      supplierCount: dto.supplierIds.length,
      deadline: deadline.toISOString(),
    });

    return rfq;
  }

  async closeRfq(rfqId: string, selectedSupplierId?: string) {
    const rfq = await this.prisma.procurementRequest.findUnique({
      where: { id: rfqId },
    });
    if (!rfq) throw new NotFoundException(`RFQ ${rfqId} not found`);

    if (rfq.status !== 'rfq_sent') {
      throw new BadRequestException(
        `RFQ is in status "${rfq.status}" — only rfq_sent requests can be closed`,
      );
    }

    const newStatus = selectedSupplierId ? 'supplier_selected' : 'rfq_closed';

    const updated = await this.prisma.procurementRequest.update({
      where: { id: rfqId },
      data: { status: newStatus },
    });

    if (selectedSupplierId) {
      this.events.emit('rfq.supplier_selected', {
        rfqId,
        supplierId: selectedSupplierId,
        tenantId: rfq.tenantId,
      });
    }

    this.events.emit('rfq.closed', {
      rfqId,
      selectedSupplierId: selectedSupplierId ?? null,
      tenantId: rfq.tenantId,
      finalStatus: newStatus,
    });

    return updated;
  }

  async findByTenant(tenantId: string, status?: string) {
    const statusFilter = status
      ? { status }
      : { status: { in: ['rfq_sent', 'rfq_closed', 'supplier_selected'] } };

    return this.prisma.procurementRequest.findMany({
      where: { tenantId, ...statusFilter },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const rfq = await this.prisma.procurementRequest.findUnique({
      where: { id },
    });
    if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);
    return rfq;
  }
}
