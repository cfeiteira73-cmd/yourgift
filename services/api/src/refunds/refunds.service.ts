import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateRefundDto } from './dto/create-refund.dto';

// Chart-of-accounts codes must match ledger.service.ts
const ACCOUNTS = {
  AR: '1100',
  REVENUE: '4000',
} as const;

// Statuses that are eligible for refund
const REFUNDABLE_STATUSES = new Set(['paid', 'delivered', 'partially_refunded']);

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventBusService,
    private readonly ledger: LedgerService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 30_000,
      maxNetworkRetries: 3,
    });
  }

  // ── Create Refund ─────────────────────────────────────────────────────────

  async createRefund(dto: CreateRefundDto) {
    // 1. Load and validate order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { refunds: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    if (!REFUNDABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Order ${order.ref} cannot be refunded in status "${order.status}". ` +
          `Eligible statuses: ${[...REFUNDABLE_STATUSES].join(', ')}.`,
      );
    }

    if (!order.stripePaymentId) {
      throw new BadRequestException(
        `Order ${order.ref} has no Stripe payment ID — cannot issue refund.`,
      );
    }

    // 2. Determine amount
    const orderTotal = order.totalAmount ?? 0;
    const refundAmount = dto.amount ?? orderTotal;

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero.');
    }

    // 3. Over-refund guard: total already refunded + this request must not exceed order total
    const alreadyRefunded = await this.getTotalRefunded(dto.orderId);
    if (alreadyRefunded + refundAmount > orderTotal + 0.01) {
      throw new BadRequestException(
        `Refund would exceed order total. ` +
          `Order total: €${orderTotal.toFixed(2)}, ` +
          `already refunded: €${alreadyRefunded.toFixed(2)}, ` +
          `requested: €${refundAmount.toFixed(2)}.`,
      );
    }

    // 4. Idempotency: prevent duplicate refunds for the exact same amount on this order
    //    (different partial amounts are allowed)
    const existingExact = order.refunds.find(
      (r) => Math.abs(Number(r.amount) - refundAmount) < 0.001 && r.status === 'succeeded',
    );
    if (existingExact) {
      throw new ConflictException(
        `A refund of €${refundAmount.toFixed(2)} for order ${order.ref} already exists (refund ID: ${existingExact.id}).`,
      );
    }

    // 5. Call Stripe — do this before the DB write so we don't persist a phantom record
    const stripeRefund = await this.stripe.refunds.create(
      {
        payment_intent: order.stripePaymentId,
        amount: Math.round(refundAmount * 100), // Stripe expects integer cents
        reason: this.mapReason(dto.reason),
        metadata: {
          orderId: order.id,
          orderRef: order.ref,
          refundedBy: dto.refundedBy ?? 'system',
          reason: dto.reason ?? '',
        },
      },
      {
        idempotencyKey: `refund-${order.id}-${Math.round(refundAmount * 100)}`,
      },
    );

    this.logger.log(
      `Stripe refund created: ${stripeRefund.id} — order=${order.ref} amount=€${refundAmount.toFixed(2)}`,
    );

    // 6. Persist refund + update order status atomically
    const isFullRefund = Math.abs(alreadyRefunded + refundAmount - orderTotal) < 0.01;
    const newOrderStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    const [refund] = await this.prisma.$transaction([
      this.prisma.refund.create({
        data: {
          orderId: dto.orderId,
          stripeRefundId: stripeRefund.id,
          amount: refundAmount,
          currency: order.currency ?? 'EUR',
          reason: dto.reason ?? null,
          status: stripeRefund.status ?? 'succeeded',
          refundedBy: dto.refundedBy ?? null,
          metadata: stripeRefund.metadata as object,
        },
      }),
      this.prisma.order.update({
        where: { id: dto.orderId },
        data: { status: newOrderStatus },
      }),
    ]);

    // 7. Post ledger reversal — Dr Revenue / Cr AR for the refunded amount
    //    (reverses the original Dr AR / Cr Revenue revenue-recognition entry)
    let ledgerTxId: string | null = null;
    try {
      ledgerTxId = await this.ledger.postTransaction({
        description: `Refund reversal: Order ${order.ref} — €${refundAmount.toFixed(2)}`,
        referenceType: 'refund',
        referenceId: refund.id,
        currency: order.currency ?? 'EUR',
        tenantId: order.tenantId,
        entries: [
          {
            accountCode: ACCOUNTS.REVENUE,
            entryType: 'debit',
            amount: refundAmount,
            description: `Revenue reversed — Refund ${refund.id} (Order ${order.ref})`,
          },
          {
            accountCode: ACCOUNTS.AR,
            entryType: 'credit',
            amount: refundAmount,
            description: `AR reversed — Refund ${refund.id} (Order ${order.ref})`,
          },
        ],
      });

      // Attach ledgerTxId to the refund record
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { ledgerTxId },
      });
    } catch (err) {
      // Log but do not fail — refund is already committed in Stripe and DB
      this.logger.error(
        `Ledger reversal failed for refund ${refund.id}: ${(err as Error).message}`,
      );
    }

    // 8. Emit events
    this.events.emit('refund.created', {
      refundId: refund.id,
      orderId: order.id,
      orderRef: order.ref,
      amountEur: refundAmount,
      stripeRefundId: stripeRefund.id,
      isFullRefund,
      refundedBy: dto.refundedBy ?? null,
    });

    this.events.emit('payment.refunded', {
      orderId: order.id,
      orderRef: order.ref,
      amountRefundedEur: refundAmount,
      full: isFullRefund,
      stripeRefundId: stripeRefund.id,
    });

    this.logger.log(
      `Refund complete: ${refund.id} — order=${order.ref} amount=€${refundAmount.toFixed(2)} ` +
        `full=${isFullRefund} newStatus=${newOrderStatus} ledger=${ledgerTxId ?? 'failed'}`,
    );

    return refund;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findByOrder(orderId: string) {
    // Verify order exists before returning
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return this.prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) {
      throw new NotFoundException(`Refund ${id} not found`);
    }
    return refund;
  }

  async getTotalRefunded(orderId: string): Promise<number> {
    const result = await this.prisma.refund.aggregate({
      where: { orderId, status: 'succeeded' },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapReason(reason?: string): Stripe.RefundCreateParams['reason'] {
    if (!reason) return undefined;
    const lower = reason.toLowerCase();
    if (lower.includes('duplicate')) return 'duplicate';
    if (lower.includes('fraud') || lower.includes('fraudulent')) return 'fraudulent';
    return 'requested_by_customer';
  }
}
