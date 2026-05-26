import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

// Stripe subscription event types handled by this service
export type StripeSubscriptionEvent =
  | Stripe.CustomerSubscriptionUpdatedEvent
  | Stripe.CustomerSubscriptionDeletedEvent
  | Stripe.InvoicePaidEvent
  | Stripe.InvoicePaymentFailedEvent;

// Internal status map from Stripe → our schema
const STRIPE_STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'canceled',
  paused: 'past_due',
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventBusService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 30_000,
      maxNetworkRetries: 3,
    });
  }

  // ── Create Subscription ───────────────────────────────────────────────────

  async createSubscription(dto: CreateSubscriptionDto) {
    // 1. Ensure the tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    // 2. Prevent duplicate active subscriptions for the same tenant + plan
    const existingActive = await this.prisma.subscription.findFirst({
      where: {
        tenantId: dto.tenantId,
        planId: dto.planId,
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    });
    if (existingActive) {
      throw new BadRequestException(
        `Tenant ${dto.tenantId} already has an active subscription for plan "${dto.planId}" ` +
          `(subscription ID: ${existingActive.id}).`,
      );
    }

    // 3. Create or retrieve the Stripe customer
    const stripeCustomer = await this.getOrCreateStripeCustomer(
      dto.customerId,
      tenant.name,
      dto.tenantId,
    );

    // 4. Build subscription params
    const subParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomer.id,
      items: [{ price: dto.priceId }],
      metadata: {
        tenantId: dto.tenantId,
        planId: dto.planId,
        customerId: dto.customerId,
        ...(dto.metadata ?? {}),
      },
      expand: ['latest_invoice'],
    };

    if (dto.trialDays && dto.trialDays > 0) {
      subParams.trial_period_days = dto.trialDays;
    }

    // 5. Create subscription in Stripe
    const stripeSub = await this.stripe.subscriptions.create(subParams, {
      idempotencyKey: `sub-create-${dto.tenantId}-${dto.planId}-${dto.priceId}`,
    });

    this.logger.log(
      `Stripe subscription created: ${stripeSub.id} — tenant=${dto.tenantId} plan=${dto.planId} ` +
        `status=${stripeSub.status} trial=${dto.trialDays ?? 0}d`,
    );

    // 6. Persist to database
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: dto.tenantId,
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId: stripeCustomer.id,
        stripePriceId: dto.priceId,
        planId: dto.planId,
        status: STRIPE_STATUS_MAP[stripeSub.status] ?? stripeSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
        metadata: dto.metadata ? JSON.parse(JSON.stringify(dto.metadata)) : undefined,
      },
    });

    // 7. Emit event
    this.events.emit('subscription.created', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSub.id,
      tenantId: dto.tenantId,
      planId: dto.planId,
      status: subscription.status,
      trialEnd: subscription.trialEnd,
    });

    return subscription;
  }

  // ── Cancel Subscription ───────────────────────────────────────────────────

  async cancelSubscription(id: string, immediately = false) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    if (subscription.status === 'canceled') {
      throw new BadRequestException(`Subscription ${id} is already canceled.`);
    }

    let stripeSub: Stripe.Subscription;

    if (immediately) {
      // Hard cancel — terminates the subscription now
      stripeSub = await this.stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId,
      );
    } else {
      // Soft cancel — let it run until period end
      stripeSub = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        { cancel_at_period_end: true },
      );
    }

    const newStatus = immediately ? 'canceled' : 'canceling';

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: newStatus,
        cancelAtPeriodEnd: !immediately,
      },
    });

    this.events.emit('subscription.canceled', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      immediately,
      cancelAtPeriodEnd: !immediately,
      periodEnd: subscription.currentPeriodEnd,
    });

    this.logger.log(
      `Subscription canceled: ${id} immediately=${immediately} stripeStatus=${stripeSub.status}`,
    );

    return updated;
  }

  // ── Stripe Webhook Event Handler ──────────────────────────────────────────

  async handleStripeEvent(event: StripeSubscriptionEvent): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default: {
        const unhandled = event as Stripe.Event;
        this.logger.debug(`Unhandled subscription event: ${unhandled.type}`);
      }
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findByTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    return this.prisma.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return subscription;
  }

  // ── Private: Stripe event handlers ────────────────────────────────────────

  private async onSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) {
      this.logger.warn(
        `customer.subscription.updated: no local record for Stripe sub ${stripeSub.id}`,
      );
      return;
    }

    const newStatus = STRIPE_STATUS_MAP[stripeSub.status] ?? stripeSub.status;

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: newStatus,
        stripePriceId: stripeSub.items.data[0]?.price.id ?? subscription.stripePriceId,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        trialEnd: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
      },
    });

    this.events.emit('subscription.updated', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSub.id,
      tenantId: subscription.tenantId,
      status: newStatus,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    });

    this.logger.log(
      `Subscription synced: ${subscription.id} status=${newStatus}`,
    );
  }

  private async onSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) {
      this.logger.warn(
        `customer.subscription.deleted: no local record for Stripe sub ${stripeSub.id}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: { status: 'canceled' },
    });

    this.events.emit('subscription.terminated', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSub.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
    });

    this.logger.log(
      `Subscription terminated: ${subscription.id} (Stripe: ${stripeSub.id})`,
    );
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubId = invoice.subscription as string | null;
    if (!stripeSubId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId },
    });

    if (!subscription) return;

    // Reset any past_due / canceling to active on successful payment
    if (['past_due', 'canceling'].includes(subscription.status)) {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: stripeSubId },
        data: { status: 'active' },
      });

      this.events.emit('subscription.payment_recovered', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        invoiceId: invoice.id,
        amountPaidEur: invoice.amount_paid / 100,
      });

      this.logger.log(
        `Subscription recovered from past_due: ${subscription.id}`,
      );
    }

    this.events.emit('subscription.invoice_paid', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      invoiceId: invoice.id,
      amountPaidEur: invoice.amount_paid / 100,
      periodEnd: subscription.currentPeriodEnd,
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubId = invoice.subscription as string | null;
    if (!stripeSubId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId },
    });

    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSubId },
      data: { status: 'past_due' },
    });

    this.events.emit('subscription.payment_failed', {
      subscriptionId: subscription.id,
      stripeSubscriptionId: stripeSubId,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      amountDueEur: invoice.amount_due / 100,
      nextPaymentAttempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
    });

    this.logger.warn(
      `Subscription payment failed: ${subscription.id} tenant=${subscription.tenantId} ` +
        `attempt=${invoice.attempt_count} invoiceId=${invoice.id}`,
    );
  }

  // ── Private: Stripe customer helpers ─────────────────────────────────────

  private async getOrCreateStripeCustomer(
    customerId: string,
    tenantName: string,
    tenantId: string,
  ): Promise<Stripe.Customer> {
    // Check if we already have a Stripe customer for this tenant
    const existingSub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { stripeCustomerId: true },
    });

    if (existingSub?.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(
          existingSub.stripeCustomerId,
        );
        if (customer && !customer.deleted) {
          return customer as Stripe.Customer;
        }
      } catch {
        // Customer not found in Stripe — fall through to create
      }
    }

    // Create a new Stripe customer
    const customer = await this.stripe.customers.create(
      {
        description: `${tenantName} — ${customerId}`,
        metadata: {
          tenantId,
          customerId,
        },
      },
      {
        idempotencyKey: `customer-create-${tenantId}-${customerId}`,
      },
    );

    this.logger.log(
      `Stripe customer created: ${customer.id} for tenant=${tenantId}`,
    );

    return customer;
  }
}
