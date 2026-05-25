import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto): Promise<{ id: string; ref: string }> {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, tenantId: true, supplier: true },
    });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    // Check for duplicate invoiceNumber (invoiceRef) within tenant
    const tenantId = dto.tenantId ?? order.tenantId;
    const duplicate = await this.prisma.cashFlowInvoice.findFirst({
      where: { invoiceRef: dto.invoiceNumber, tenantId },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Invoice number "${dto.invoiceNumber}" already exists for tenant "${tenantId}"`,
      );
    }

    const now = new Date();
    const dueDate = new Date(dto.dueDate);

    // Store line items as JSON in notes field (CashFlowInvoice has no lineItems column)
    const lineItemsJson = JSON.stringify(dto.lineItems);
    const combinedNotes = dto.notes
      ? `${dto.notes}\n\nLine items: ${lineItemsJson}`
      : `Line items: ${lineItemsJson}`;

    const invoice = await this.prisma.cashFlowInvoice.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        supplierId: dto.supplierId,
        invoiceRef: dto.invoiceNumber,
        invoiceDate: now,
        dueDate,
        amountEur: dto.amount,
        paidAmountEur: 0,
        status: 'pending',
        notes: combinedNotes,
        category: 'procurement',
      },
    });

    this.events.emit('invoice.created', {
      invoiceId: invoice.id,
      invoiceRef: invoice.invoiceRef,
      orderId: dto.orderId,
      supplierId: dto.supplierId,
      amount: dto.amount,
      currency: dto.currency ?? 'EUR',
      dueDate: dueDate.toISOString(),
      tenantId,
    });

    return { id: invoice.id, ref: invoice.invoiceRef };
  }

  async markPaid(invoiceId: string, paidAt?: Date): Promise<void> {
    const invoice = await this.prisma.cashFlowInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const paidDate = paidAt ?? new Date();

    await this.prisma.cashFlowInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidDate,
        paidAmountEur: invoice.amountEur,
      },
    });

    this.events.emit('invoice.paid.procurement', {
      invoiceId,
      invoiceRef: invoice.invoiceRef,
      orderId: invoice.orderId,
      supplierId: invoice.supplierId,
      amount: Number(invoice.amountEur),
      paidAt: paidDate.toISOString(),
      tenantId: invoice.tenantId,
    });
  }

  async findByOrder(orderId: string) {
    return this.prisma.cashFlowInvoice.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOverdue() {
    return this.prisma.cashFlowInvoice.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { not: 'paid' },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getInvoiceSummary(tenantId: string): Promise<{
    total: number;
    paid: number;
    outstanding: number;
    overdue: number;
  }> {
    const now = new Date();

    const [all, paid, overdue] = await Promise.all([
      this.prisma.cashFlowInvoice.aggregate({
        where: { tenantId },
        _sum: { amountEur: true },
        _count: { id: true },
      }),
      this.prisma.cashFlowInvoice.aggregate({
        where: { tenantId, status: 'paid' },
        _sum: { amountEur: true },
      }),
      this.prisma.cashFlowInvoice.aggregate({
        where: {
          tenantId,
          dueDate: { lt: now },
          status: { not: 'paid' },
        },
        _sum: { amountEur: true },
      }),
    ]);

    const totalAmount = Number(all._sum.amountEur ?? 0);
    const paidAmount = Number(paid._sum.amountEur ?? 0);
    const overdueAmount = Number(overdue._sum.amountEur ?? 0);

    return {
      total: parseFloat(totalAmount.toFixed(2)),
      paid: parseFloat(paidAmount.toFixed(2)),
      outstanding: parseFloat((totalAmount - paidAmount).toFixed(2)),
      overdue: parseFloat(overdueAmount.toFixed(2)),
    };
  }
}
