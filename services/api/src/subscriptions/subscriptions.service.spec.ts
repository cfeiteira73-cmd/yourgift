import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTenant = { id: 'tenant_1', name: 'Acme Corp' };

const mockStripeSubCreated = {
  id: 'sub_stripe_1',
  status: 'active',
  current_period_start: 1700000000,
  current_period_end: 1702678400,
  cancel_at_period_end: false,
  trial_end: null,
  items: { data: [{ price: { id: 'price_pro' } }] },
};

const mockSubDb = {
  id: 'sub_db_1',
  tenantId: 'tenant_1',
  stripeSubscriptionId: 'sub_stripe_1',
  stripeCustomerId: 'cus_new',
  stripePriceId: 'price_pro',
  planId: 'plan_pro',
  status: 'active',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(),
  cancelAtPeriodEnd: false,
  trialEnd: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  tenant: { findUnique: jest.fn() },
  subscription: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfig = { getOrThrow: jest.fn().mockReturnValue('sk_test_xxx') };
const mockEvents = { emit: jest.fn() };

const mockStripe = {
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_new', deleted: false }),
    retrieve: jest.fn().mockResolvedValue({ id: 'cus_existing', deleted: false }),
  },
  subscriptions: {
    create: jest.fn().mockResolvedValue(mockStripeSubCreated),
    cancel: jest.fn().mockResolvedValue({ id: 'sub_stripe_1', status: 'canceled' }),
    update: jest.fn().mockResolvedValue({ id: 'sub_stripe_1', cancel_at_period_end: true }),
  },
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset defaults
    mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubCreated);
    mockPrisma.subscription.create.mockResolvedValue(mockSubDb);
    mockPrisma.subscription.update.mockResolvedValue(mockSubDb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    (service as any).stripe = mockStripe;
  });

  // Helper: set up a successful createSubscription flow
  const setupCreate = (opts: { hasDuplicate?: boolean; hasExistingCustomer?: boolean } = {}) => {
    mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
    mockPrisma.subscription.findFirst
      // 1st call: duplicate check
      .mockResolvedValueOnce(opts.hasDuplicate ? { id: 'sub_existing', status: 'active' } : null)
      // 2nd call: existing Stripe customer lookup (inside getOrCreateStripeCustomer)
      .mockResolvedValueOnce(
        opts.hasExistingCustomer ? { stripeCustomerId: 'cus_existing' } : null,
      );
  };

  const createDto = {
    tenantId: 'tenant_1',
    planId: 'plan_pro',
    priceId: 'price_pro',
    customerId: 'cust_1',
  };

  // ── createSubscription ────────────────────────────────────────────────────

  it('throws NotFoundException if tenant not found', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.createSubscription(createDto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if active subscription already exists for same tenant+plan', async () => {
    setupCreate({ hasDuplicate: true });

    await expect(service.createSubscription(createDto)).rejects.toThrow(BadRequestException);
  });

  it('creates a new Stripe customer when no previous subscription exists', async () => {
    setupCreate({ hasExistingCustomer: false });

    await service.createSubscription(createDto);

    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ tenantId: 'tenant_1' }),
      }),
      expect.anything(),
    );
  });

  it('reuses existing Stripe customer from a previous subscription', async () => {
    setupCreate({ hasExistingCustomer: true });

    await service.createSubscription(createDto);

    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
      expect.anything(),
    );
  });

  it('persists subscription to DB with the correctly mapped status', async () => {
    setupCreate();
    mockStripe.subscriptions.create.mockResolvedValue({
      ...mockStripeSubCreated,
      status: 'trialing',
      trial_end: 1701000000,
    });

    await service.createSubscription(createDto);

    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'trialing' }),
      }),
    );
  });

  it('emits subscription.created event with tenantId and planId', async () => {
    setupCreate();

    await service.createSubscription(createDto);

    expect(mockEvents.emit).toHaveBeenCalledWith(
      'subscription.created',
      expect.objectContaining({ tenantId: 'tenant_1', planId: 'plan_pro' }),
    );
  });

  it('applies trial_period_days to Stripe when dto.trialDays > 0', async () => {
    setupCreate();

    await service.createSubscription({ ...createDto, trialDays: 14 });

    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ trial_period_days: 14 }),
      expect.anything(),
    );
  });

  it('does NOT set trial_period_days when trialDays is 0 or undefined', async () => {
    setupCreate();

    await service.createSubscription(createDto); // no trialDays

    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ trial_period_days: expect.anything() }),
      expect.anything(),
    );
  });

  // ── cancelSubscription ────────────────────────────────────────────────────

  it('throws NotFoundException if subscription not found', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.cancelSubscription('sub_missing')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if subscription is already canceled', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      ...mockSubDb,
      status: 'canceled',
    });

    await expect(service.cancelSubscription('sub_db_1')).rejects.toThrow(BadRequestException);
  });

  it('immediately=true: calls stripe.subscriptions.cancel and sets status to canceled', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.cancelSubscription('sub_db_1', true);

    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1');
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_db_1' },
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
  });

  it('immediately=false (default): calls stripe.subscriptions.update with cancel_at_period_end=true and sets status to canceling', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.cancelSubscription('sub_db_1', false);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      expect.objectContaining({ cancel_at_period_end: true }),
    );
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceling', cancelAtPeriodEnd: true }),
      }),
    );
  });

  it('emits subscription.canceled event after cancel', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.cancelSubscription('sub_db_1', true);

    expect(mockEvents.emit).toHaveBeenCalledWith(
      'subscription.canceled',
      expect.objectContaining({ subscriptionId: 'sub_db_1' }),
    );
  });

  // ── handleStripeEvent ─────────────────────────────────────────────────────

  it('customer.subscription.updated — syncs Stripe status to DB', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.handleStripeEvent({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_stripe_1',
          status: 'past_due',
          current_period_start: 1700000000,
          current_period_end: 1702678400,
          cancel_at_period_end: false,
          trial_end: null,
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    } as any);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'past_due' }),
      }),
    );
  });

  it('customer.subscription.deleted — sets status to canceled in DB', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.handleStripeEvent({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_stripe_1',
          status: 'canceled',
          current_period_start: 1700000000,
          current_period_end: 1702678400,
          cancel_at_period_end: false,
          trial_end: null,
          items: { data: [] },
        },
      },
    } as any);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'canceled' },
      }),
    );
  });

  it('invoice.paid — recovers past_due subscription to active', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      ...mockSubDb,
      status: 'past_due',
    });

    await service.handleStripeEvent({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'inv_test',
          subscription: 'sub_stripe_1',
          amount_paid: 9900,
          attempt_count: 2,
          amount_due: 9900,
          next_payment_attempt: null,
        },
      },
    } as any);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'active' },
      }),
    );
    expect(mockEvents.emit).toHaveBeenCalledWith(
      'subscription.payment_recovered',
      expect.any(Object),
    );
  });

  it('invoice.paid — does not change status if subscription is already active', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb); // status: 'active'

    await service.handleStripeEvent({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'inv_test',
          subscription: 'sub_stripe_1',
          amount_paid: 9900,
          attempt_count: 1,
          amount_due: 9900,
          next_payment_attempt: null,
        },
      },
    } as any);

    // payment_recovered should NOT be emitted for an already-active subscription
    expect(mockEvents.emit).not.toHaveBeenCalledWith(
      'subscription.payment_recovered',
      expect.anything(),
    );
  });

  it('invoice.payment_failed — sets subscription status to past_due', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(mockSubDb);

    await service.handleStripeEvent({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'inv_failed',
          subscription: 'sub_stripe_1',
          amount_paid: 0,
          attempt_count: 1,
          amount_due: 9900,
          next_payment_attempt: 1702800000,
        },
      },
    } as any);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'past_due' },
      }),
    );
    expect(mockEvents.emit).toHaveBeenCalledWith(
      'subscription.payment_failed',
      expect.objectContaining({ attemptCount: 1 }),
    );
  });
});
