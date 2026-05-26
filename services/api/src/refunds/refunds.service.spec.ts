import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { LedgerService } from '../ledger/ledger.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRefund = {
  id: 'ref_1',
  orderId: 'ord_1',
  stripeRefundId: 're_test',
  amount: 100,
  currency: 'EUR',
  status: 'succeeded',
  reason: null,
  refundedBy: null,
  ledgerTxId: null,
  metadata: {},
  createdAt: new Date(),
};

const mockOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'ord_1',
  ref: 'ORD-001',
  status: 'paid',
  totalAmount: 500,
  currency: 'EUR',
  stripePaymentId: 'pi_test',
  tenantId: 'tenant_1',
  refunds: [],
  ...overrides,
});

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refund: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('sk_test_xxx'),
};

const mockEvents = { emit: jest.fn() };

const mockLedger = {
  postTransaction: jest.fn().mockResolvedValue('ltx_1'),
};

const mockStripe = {
  refunds: {
    create: jest.fn().mockResolvedValue({ id: 're_test', status: 'succeeded', metadata: {} }),
  },
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('RefundsService', () => {
  let service: RefundsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset aggregate default
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    // $transaction executes the array of Prisma ops and returns results
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => {
      const results: unknown[] = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    });

    mockPrisma.refund.create.mockResolvedValue(mockRefund);
    mockPrisma.order.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventBusService, useValue: mockEvents },
        { provide: LedgerService, useValue: mockLedger },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
    (service as any).stripe = mockStripe;
  });

  // ── createRefund ──────────────────────────────────────────────────────────

  it('throws NotFoundException if order not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(
      service.createRefund({ orderId: 'ord_missing', amount: 100 } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if order status is not refundable (pending)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder({ status: 'pending' }));

    await expect(
      service.createRefund({ orderId: 'ord_1', amount: 100 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if order has no stripePaymentId', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(
      mockOrder({ stripePaymentId: null }),
    );

    await expect(
      service.createRefund({ orderId: 'ord_1', amount: 100 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if refund amount exceeds order total (over-refund guard)', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder({ totalAmount: 500 }));
    // already refunded 400 → requesting 200 more = 600 > 500
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 400 } });

    await expect(
      service.createRefund({ orderId: 'ord_1', amount: 200 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException if identical refund amount already exists (idempotency guard)', async () => {
    const existingRefund = { id: 'ref_existing', amount: 100, status: 'succeeded' };
    mockPrisma.order.findUnique.mockResolvedValue(
      mockOrder({ refunds: [existingRefund] }),
    );
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await expect(
      service.createRefund({ orderId: 'ord_1', amount: 100 } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('calls Stripe refunds.create with correct payment_intent and amount in cents', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder());
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await service.createRefund({ orderId: 'ord_1', amount: 100 } as any);

    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_test',
        amount: 10000, // 100 EUR × 100 cents
      }),
      expect.anything(),
    );
  });

  it('posts ledger reversal (Dr Revenue / Cr AR) after successful refund', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder());
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await service.createRefund({ orderId: 'ord_1', amount: 100 } as any);

    expect(mockLedger.postTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ accountCode: '4000', entryType: 'debit' }),
          expect.objectContaining({ accountCode: '1100', entryType: 'credit' }),
        ]),
      }),
    );
  });

  it('emits refund.created event with correct payload', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder());
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await service.createRefund({ orderId: 'ord_1', amount: 100 } as any);

    expect(mockEvents.emit).toHaveBeenCalledWith(
      'refund.created',
      expect.objectContaining({ orderId: 'ord_1' }),
    );
  });

  it('sets order status to partially_refunded for a partial refund', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder({ totalAmount: 500 }));
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await service.createRefund({ orderId: 'ord_1', amount: 100 } as any); // 100 of 500

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'partially_refunded' }),
      }),
    );
  });

  it('sets order status to refunded for a full refund', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(mockOrder({ totalAmount: 500 }));
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.refund.create.mockResolvedValue({ ...mockRefund, amount: 500 });

    await service.createRefund({ orderId: 'ord_1', amount: 500 } as any); // full amount

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'refunded' }),
      }),
    );
  });

  // ── findByOrder ───────────────────────────────────────────────────────────

  it('findByOrder — throws NotFoundException if order not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(service.findByOrder('ord_missing')).rejects.toThrow(NotFoundException);
  });

  it('findByOrder — returns list of refunds for valid order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord_1' });
    const mockRefunds = [mockRefund, { ...mockRefund, id: 'ref_2', amount: 50 }];
    mockPrisma.refund.findMany.mockResolvedValue(mockRefunds);

    const result = await service.findByOrder('ord_1');

    expect(result).toEqual(mockRefunds);
    expect(mockPrisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: 'ord_1' } }),
    );
  });

  // ── getTotalRefunded ──────────────────────────────────────────────────────

  it('getTotalRefunded — returns sum of succeeded refunds for an order', async () => {
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 350 } });

    const total = await service.getTotalRefunded('ord_1');

    expect(total).toBe(350);
    expect(mockPrisma.refund.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'ord_1', status: 'succeeded' },
        _sum: { amount: true },
      }),
    );
  });

  it('getTotalRefunded — returns 0 when no refunds exist', async () => {
    mockPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const total = await service.getTotalRefunded('ord_1');

    expect(total).toBe(0);
  });
});
