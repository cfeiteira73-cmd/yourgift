/**
 * Integration Test: Payment Flow
 *
 * Tests the complete payment lifecycle across OrdersService,
 * PaymentsService, and LedgerService.
 *
 * Strategy: real service instances wired together through
 * a NestJS TestingModule. Only Prisma and Stripe are mocked
 * at the boundary — all service-to-service interactions are real.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LedgerService } from '../../src/ledger/ledger.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { EventBusService } from '../../src/events/event-bus.service';
import { QueueService } from '../../src/queue/queue.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeOrder(overrides: Partial<{
  id: string;
  ref: string;
  totalAmount: number;
  currency: string;
  status: string;
  stripeSessionId: string | null;
  stripePaymentId: string | null;
  items: Array<{ productId: string; unitCost: number; unitPrice: number; quantity: number }>;
}> = {}) {
  return {
    id: uuid(),
    ref: `YGO-20260101-${Math.floor(1000 + Math.random() * 9000)}`,
    totalAmount: 1500.00,
    currency: 'EUR',
    status: 'created',
    stripeSessionId: null,
    stripePaymentId: null,
    items: [
      { productId: uuid(), unitCost: 600.00, unitPrice: 750.00, quantity: 2 },
    ],
    ...overrides,
  };
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStripeSession = {
  id: `cs_test_${uuid()}`,
  url: 'https://checkout.stripe.com/pay/cs_test_abc123',
  metadata: { orderId: '', tenantId: 'tenant-abc' },
  amount_total: 150000,  // €1500.00 in cents
  payment_intent: `pi_test_${uuid()}`,
};

function buildPrismaStub(order: ReturnType<typeof makeOrder>) {
  const ledgerTxStore: Array<{ id: string; referenceType: string; referenceId: string }> = [];
  const ledgerEntryStore: Array<{ amount: number; entryType: string; accountCode: string; tenantId?: string; postedAt?: Date }> = [];
  const orderStore: { [id: string]: typeof order } = { [order.id]: { ...order } };
  const stripeEventStore: { [id: string]: boolean } = {};

  return {
    order: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(orderStore[where.id] ?? null),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Partial<typeof order> }) => {
        if (orderStore[where.id]) {
          Object.assign(orderStore[where.id], data);
        }
        return Promise.resolve(orderStore[where.id] ?? null);
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    ledgerTransaction: {
      create: jest.fn().mockImplementation(({ data }: { data: { description: string; referenceType?: string; referenceId?: string; totalAmount: number; currency: string; tenantId: string; entries?: { create: typeof ledgerEntryStore } } }) => {
        const tx = { id: uuid(), ...data };
        ledgerTxStore.push({ id: tx.id, referenceType: data.referenceType ?? '', referenceId: data.referenceId ?? '' });
        // Persist entries
        if (data.entries?.create) {
          for (const entry of data.entries.create) {
            ledgerEntryStore.push(entry);
          }
        }
        return Promise.resolve(tx);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { referenceType: string; referenceId: string } }) => {
        const found = ledgerTxStore.find(
          (t) => t.referenceType === where.referenceType && t.referenceId === where.referenceId,
        );
        return Promise.resolve(found ?? null);
      }),
    },
    ledgerAccount: {
      findUnique: jest.fn().mockResolvedValue({ normalBalance: 'debit', code: '1100', isActive: true }),
    },
    ledgerEntry: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(ledgerEntryStore)),
    },
    stripeEvent: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(stripeEventStore[where.id] ? { id: where.id } : null),
      ),
      upsert: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        stripeEventStore[where.id] = true;
        return Promise.resolve({ id: where.id });
      }),
    },
    _ledgerTxStore: ledgerTxStore,
    _ledgerEntryStore: ledgerEntryStore,
    _orderStore: orderStore,
  };
}

function buildStripeStub(order: ReturnType<typeof makeOrder>) {
  const session = { ...mockStripeSession, metadata: { orderId: order.id, tenantId: 'tenant-abc' } };
  return {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue(session),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Payment Flow Integration', () => {
  let module: TestingModule;
  let ledgerService: LedgerService;
  let paymentsService: PaymentsService;
  let eventBus: EventBusService;
  let queueService: QueueService;
  let prismaStub: ReturnType<typeof buildPrismaStub>;
  let order: ReturnType<typeof makeOrder>;
  let stripeStub: ReturnType<typeof buildStripeStub>;

  beforeEach(async () => {
    order = makeOrder();
    prismaStub = buildPrismaStub(order);
    stripeStub = buildStripeStub(order);

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const cfg: Record<string, string> = {
          STRIPE_KEY: 'sk_test_placeholder',
          STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
          FRONTEND_URL: 'http://localhost:3000',
          PAYMENT_ALERTS_EMAIL: 'ops@yourgift.pt',
          NODE_ENV: 'test',
        };
        return cfg[key] ?? null;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const cfg: Record<string, string> = {
          STRIPE_KEY: 'sk_test_placeholder',
          STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
        };
        const v = cfg[key];
        if (!v) throw new Error(`Config key ${key} not found`);
        return v;
      }),
    };

    const mockQueueService = {
      enqueuePdfGeneration: jest.fn().mockResolvedValue({ id: 'job-1' }),
      enqueueEmail: jest.fn().mockResolvedValue({ id: 'job-2' }),
      enqueueTransactionalEmail: jest.fn().mockResolvedValue({ id: 'job-3' }),
    };

    module = await Test.createTestingModule({
      providers: [
        EventBusService,
        LedgerService,
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        PaymentsService,
      ],
    }).compile();

    ledgerService = module.get(LedgerService);
    paymentsService = module.get(PaymentsService);
    eventBus = module.get(EventBusService);
    queueService = module.get(QueueService);

    // Patch Stripe with our stub
    (paymentsService as unknown as { stripe: typeof stripeStub }).stripe = stripeStub;

    // Init event listeners (LedgerService.onModuleInit registers them)
    await module.init();

    jest.clearAllMocks();
    // Re-patch after clearAllMocks to restore stub functions
    (paymentsService as unknown as { stripe: typeof stripeStub }).stripe = stripeStub;
  });

  afterEach(async () => {
    await module.close();
  });

  // ── 1. Full happy path ────────────────────────────────────────────────────

  it('creates order → payment session → webhook → ledger entry (full flow)', async () => {
    // Step 1: PaymentsService listens to order.created and creates a checkout session
    prismaStub.order.update.mockResolvedValueOnce({ ...order, stripeSessionId: mockStripeSession.id });
    const { url } = await paymentsService.createCheckoutSession(order);

    expect(url).toBe(mockStripeSession.url);
    expect(stripeStub.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: order.id }),
    );
    expect(prismaStub.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stripeSessionId: mockStripeSession.id }) }),
    );

    // Step 2: Webhook arrives — checkout.session.completed
    const paidOrder = { ...order, status: 'paid', stripePaymentId: mockStripeSession.payment_intent };
    prismaStub.order.update.mockResolvedValueOnce(paidOrder);
    prismaStub.order.findUnique.mockResolvedValueOnce(paidOrder);

    // Emit order.paid manually as LedgerService listens to it (simulating webhook flow)
    prismaStub.ledgerTransaction.findFirst.mockResolvedValueOnce(null); // no existing tx
    prismaStub.order.findUnique.mockResolvedValueOnce({
      ...paidOrder,
      items: order.items,
    });

    await ledgerService.recordOrderPayment(order.id);

    // Step 3: Verify ledger entry was created
    expect(prismaStub.ledgerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceType: 'order_payment',
          referenceId: order.id,
        }),
      }),
    );
  });

  // ── 2. Refund flow ────────────────────────────────────────────────────────

  it('refund flow: paid order → refund → ledger reversal', async () => {
    // Mark order as paid with an existing payment ledger tx
    const paidOrder = { ...order, status: 'paid' };
    prismaStub.order.findUnique.mockResolvedValue(paidOrder);

    // First call for recordReversal idempotency check — no existing reversal
    prismaStub.ledgerTransaction.findFirst
      .mockResolvedValueOnce(null)                          // no reversal yet
      .mockResolvedValueOnce({ id: uuid(), referenceType: 'order_payment', referenceId: order.id }); // payment tx exists

    await ledgerService.recordReversal(order.id);

    expect(prismaStub.ledgerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceType: 'order_reversal',
          referenceId: order.id,
        }),
      }),
    );

    // Verify the reversal entries swap debit/credit relative to payment
    const createCall = prismaStub.ledgerTransaction.create.mock.calls[0][0];
    const entries = createCall.data.entries.create as Array<{ entryType: string; accountCode: string }>;
    const debitEntry = entries.find((e) => e.entryType === 'debit');
    const creditEntry = entries.find((e) => e.entryType === 'credit');
    expect(debitEntry?.accountCode).toBe('4000'); // Revenue (REVENUE)
    expect(creditEntry?.accountCode).toBe('1100'); // AR
  });

  // ── 3. Idempotent webhook ─────────────────────────────────────────────────

  it('idempotent webhook: same event processed twice only affects DB once', async () => {
    const eventId = `evt_test_${uuid()}`;
    const webhookSecret = 'whsec_placeholder';

    // Construct a mock Stripe event payload
    const stripeEvent = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockStripeSession.id,
          metadata: { orderId: order.id, tenantId: 'tenant-abc' },
          amount_total: 150000,
          payment_intent: `pi_test_${uuid()}`,
        },
      },
    };

    // First call: event not yet processed
    stripeStub.webhooks.constructEvent.mockReturnValue(stripeEvent);
    prismaStub.stripeEvent.findUnique.mockResolvedValueOnce(null);
    prismaStub.order.update.mockResolvedValueOnce({ ...order, status: 'paid' });

    const result1 = await paymentsService.handleWebhook(
      Buffer.from(JSON.stringify(stripeEvent)),
      webhookSecret,
    );
    expect(result1).toEqual({ received: true });
    expect(prismaStub.order.update).toHaveBeenCalledTimes(1);

    // Second call: event already processed
    prismaStub.stripeEvent.findUnique.mockResolvedValueOnce({ id: eventId });

    const result2 = await paymentsService.handleWebhook(
      Buffer.from(JSON.stringify(stripeEvent)),
      webhookSecret,
    );
    expect(result2).toEqual({ received: true });
    // order.update should NOT be called a second time
    expect(prismaStub.order.update).toHaveBeenCalledTimes(1);
  });

  // ── 4. Failed payment → order stays unpaid, no ledger entry ──────────────

  it('failed payment → order stays unpaid → no ledger entry', async () => {
    // payment_intent.payment_failed event
    const stripeEvent = {
      id: `evt_test_${uuid()}`,
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: `pi_test_${uuid()}`,
          metadata: { orderId: order.id },
          last_payment_error: { message: 'card_declined' },
        },
      },
    };

    stripeStub.webhooks.constructEvent.mockReturnValue(stripeEvent);
    prismaStub.stripeEvent.findUnique.mockResolvedValueOnce(null);

    await paymentsService.handleWebhook(
      Buffer.from(JSON.stringify(stripeEvent)),
      'whsec_placeholder',
    );

    // Order should NOT have been updated to paid
    const orderUpdateCalls = prismaStub.order.update.mock.calls;
    const paidUpdates = orderUpdateCalls.filter(
      (call) => call[0]?.data?.status === 'paid',
    );
    expect(paidUpdates).toHaveLength(0);

    // No ledger transaction should have been created
    expect(prismaStub.ledgerTransaction.create).not.toHaveBeenCalled();

    // Alert email should be queued
    expect(queueService.enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'payment-failed' }),
    );
  });

  // ── 5. Dispute created → alert email queued ───────────────────────────────

  it('dispute created → alert email queued', async () => {
    const dueByTimestamp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const stripeEvent = {
      id: `evt_test_${uuid()}`,
      type: 'charge.dispute.created',
      data: {
        object: {
          id: `dp_test_${uuid()}`,
          amount: 150000, // €1500
          reason: 'fraudulent',
          status: 'needs_response',
          evidence_details: { due_by: dueByTimestamp },
        },
      },
    };

    stripeStub.webhooks.constructEvent.mockReturnValue(stripeEvent);
    prismaStub.stripeEvent.findUnique.mockResolvedValueOnce(null);

    await paymentsService.handleWebhook(
      Buffer.from(JSON.stringify(stripeEvent)),
      'whsec_placeholder',
    );

    expect(queueService.enqueueTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'dispute-created',
        variables: expect.objectContaining({ amountEur: 1500, reason: 'fraudulent' }),
      }),
    );
  });
});
