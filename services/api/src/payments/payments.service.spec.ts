import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { QueueService } from '../queue/queue.service';

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockStripeWebhooks = {
  constructEvent: jest.fn(),
};

const mockStripeCheckoutSessions = {
  create: jest.fn(),
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: mockStripeWebhooks,
    checkout: {
      sessions: mockStripeCheckoutSessions,
    },
  }));
});

// ── Mock factories ────────────────────────────────────────────────────────────

const makeStripeEvent = (
  type: string,
  dataObject: Record<string, unknown>,
  id = 'evt_test_001',
): unknown => ({
  id,
  type,
  data: { object: dataObject },
});

const makeCheckoutSession = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'cs_test_abc123',
  amount_total: 30000, // 300.00 EUR in cents
  payment_intent: 'pi_test_xyz789',
  url: 'https://checkout.stripe.com/pay/cs_test_abc123',
  metadata: {
    orderId: 'order-001',
    tenantId: 'tenant-001',
    environment: 'test',
  },
  ...overrides,
});

const makePaymentIntent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'pi_test_fail_001',
  metadata: { orderId: 'order-001' },
  last_payment_error: { message: 'Your card was declined.' },
  ...overrides,
});

const makeCharge = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ch_test_refund_001',
  amount_refunded: 15000, // 150.00 EUR
  refunded: true,
  metadata: { orderId: 'order-001' },
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'order-001',
  tenantId: 'tenant-001',
  totalAmount: 300,
  currency: 'EUR',
  status: 'created',
  items: [
    {
      productId: 'prod-001',
      productName: 'Premium Gift Box',
      description: 'A premium corporate gift box',
      unitPrice: 150,
      quantity: 2,
    },
  ],
  ...overrides,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string> = {
      STRIPE_KEY: 'sk_test_mockkey_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      PAYMENT_ALERTS_EMAIL: 'ops@yourgift.pt',
    };
    const v = values[key];
    if (!v) throw new Error(`Missing env var: ${key}`);
    return v;
  }),
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      FRONTEND_URL: 'https://app.yourgift.pt',
      NODE_ENV: 'test',
    };
    return values[key];
  }),
};

const mockPrisma = {
  order: {
    update: jest.fn(),
  },
  stripeEvent: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockEvents = {
  on: jest.fn(),
  emit: jest.fn(),
};

const mockQueue = {
  enqueuePdfGeneration: jest.fn(),
  enqueueEmail: jest.fn(),
  enqueueTransactionalEmail: jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: event not yet processed (allow processing)
    mockPrisma.stripeEvent.findUnique.mockResolvedValue(null);
    mockPrisma.stripeEvent.upsert.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockQueue.enqueuePdfGeneration.mockResolvedValue(undefined);
    mockQueue.enqueueEmail.mockResolvedValue(undefined);
    mockQueue.enqueueTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEvents },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('throws BadRequestException when signature is invalid', async () => {
      mockStripeWebhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      await expect(
        service.handleWebhook(Buffer.from('payload'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns { received: true } without processing when event was already processed (idempotency)', async () => {
      const event = makeStripeEvent('checkout.session.completed', makeCheckoutSession());
      mockStripeWebhooks.constructEvent.mockReturnValue(event);
      mockPrisma.stripeEvent.findUnique.mockResolvedValue({ id: 'evt_test_001' }); // already processed

      const result = await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockEvents.emit).not.toHaveBeenCalled();
    });

    it('updates order status to "paid" on checkout.session.completed', async () => {
      const session = makeCheckoutSession();
      const event = makeStripeEvent('checkout.session.completed', session, 'evt_completed_001');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('emits payment.confirmed on checkout.session.completed', async () => {
      const session = makeCheckoutSession();
      const event = makeStripeEvent('checkout.session.completed', session, 'evt_completed_002');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'payment.confirmed',
        expect.objectContaining({
          orderId: 'order-001',
          amountEur: 300,
        }),
      );
    });

    it('emits payment.failed on payment_intent.payment_failed', async () => {
      const intent = makePaymentIntent({ metadata: { orderId: 'order-002' } });
      const event = makeStripeEvent('payment_intent.payment_failed', intent, 'evt_failed_001');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({
          orderId: 'order-002',
          reason: 'Your card was declined.',
        }),
      );
    });

    it('emits payment.refunded on charge.refunded', async () => {
      const charge = makeCharge();
      const event = makeStripeEvent('charge.refunded', charge, 'evt_refund_001');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'payment.refunded',
        expect.objectContaining({
          chargeId: 'ch_test_refund_001',
          amountRefundedEur: 150,
          full: true,
        }),
      );
    });

    it('returns { received: true } for unhandled event types without throwing', async () => {
      const event = makeStripeEvent('customer.subscription.created', {}, 'evt_unknown_001');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      const result = await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(result).toEqual({ received: true });
    });

    it('marks event as processed after successful handling', async () => {
      const session = makeCheckoutSession();
      const event = makeStripeEvent('checkout.session.completed', session, 'evt_mark_001');
      mockStripeWebhooks.constructEvent.mockReturnValue(event);

      await service.handleWebhook(Buffer.from('payload'), 'valid-sig');

      expect(mockPrisma.stripeEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt_mark_001' },
        }),
      );
    });
  });

  // ── createCheckoutSession ─────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('creates a Stripe session with correct line items mapped from order', async () => {
      mockStripeCheckoutSessions.create.mockResolvedValue(
        makeCheckoutSession({ url: 'https://checkout.stripe.com/pay/cs_001' }),
      );

      const order = makeOrder();
      await service.createCheckoutSession(order as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall.line_items).toHaveLength(1);
      expect(createCall.line_items[0].price_data.unit_amount).toBe(15000); // 150 * 100
      expect(createCall.line_items[0].quantity).toBe(2);
      expect(createCall.line_items[0].price_data.product_data.name).toBe('Premium Gift Box');
    });

    it('stores the Stripe session ID on the order record', async () => {
      mockStripeCheckoutSessions.create.mockResolvedValue(
        makeCheckoutSession({ id: 'cs_stored_001' }),
      );

      await service.createCheckoutSession(makeOrder() as any);

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: expect.objectContaining({ stripeSessionId: 'cs_stored_001' }),
        }),
      );
    });

    it('returns the checkout session URL', async () => {
      const expectedUrl = 'https://checkout.stripe.com/pay/cs_test_url';
      mockStripeCheckoutSessions.create.mockResolvedValue(
        makeCheckoutSession({ url: expectedUrl }),
      );

      const result = await service.createCheckoutSession(makeOrder() as any);

      expect(result.url).toBe(expectedUrl);
    });

    it('sets client_reference_id to the order id for idempotency', async () => {
      mockStripeCheckoutSessions.create.mockResolvedValue(makeCheckoutSession());

      await service.createCheckoutSession(makeOrder() as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall.client_reference_id).toBe('order-001');
    });

    it('embeds orderId and tenantId in session metadata', async () => {
      mockStripeCheckoutSessions.create.mockResolvedValue(makeCheckoutSession());

      await service.createCheckoutSession(makeOrder() as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall.metadata.orderId).toBe('order-001');
      expect(createCall.metadata.tenantId).toBe('tenant-001');
    });
  });
});
