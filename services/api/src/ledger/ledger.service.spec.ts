import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Mock factories ────────────────────────────────────────────────────────────

const makeTx = (overrides: Record<string, unknown> = {}) => ({
  id: 'tx-abc123',
  description: 'Test transaction',
  referenceType: 'order_payment',
  referenceId: 'order-001',
  totalAmount: 100,
  currency: 'EUR',
  tenantId: 'default',
  postedAt: new Date(),
  entries: [],
  ...overrides,
});

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-001',
  accountCode: '1100',
  entryType: 'debit',
  amount: 500,
  currency: 'EUR',
  tenantId: 'default',
  postedAt: new Date(),
  ...overrides,
});

const makeAccount = (overrides: Record<string, unknown> = {}) => ({
  code: '1100',
  name: 'Accounts Receivable',
  accountType: 'asset',
  normalBalance: 'debit',
  isActive: true,
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-001',
  ref: 'YGO-20260525-1234',
  totalAmount: 300,
  currency: 'EUR',
  status: 'paid',
  items: [
    { id: 'item-001', unitCost: 80, quantity: 2 },
    { id: 'item-002', unitCost: 50, quantity: 1 },
  ],
  ...overrides,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  ledgerTransaction: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  ledgerEntry: {
    findMany: jest.fn(),
  },
  ledgerAccount: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
};

const mockEvents = {
  on: jest.fn(),
  emit: jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  // ── postTransaction ───────────────────────────────────────────────────────

  describe('postTransaction', () => {
    it('posts a balanced transaction and returns the tx id', async () => {
      mockPrisma.ledgerTransaction.create.mockResolvedValue(makeTx({ id: 'tx-balanced' }));

      const id = await service.postTransaction({
        description: 'Revenue: Order YGO-001',
        referenceType: 'order_payment',
        referenceId: 'order-001',
        currency: 'EUR',
        entries: [
          { accountCode: '1100', entryType: 'debit', amount: 100, description: 'AR' },
          { accountCode: '4000', entryType: 'credit', amount: 100, description: 'Revenue' },
        ],
      });

      expect(id).toBe('tx-balanced');
      expect(mockPrisma.ledgerTransaction.create).toHaveBeenCalledTimes(1);
      const callData = mockPrisma.ledgerTransaction.create.mock.calls[0][0].data;
      expect(callData.totalAmount).toBe(100);
      expect(callData.currency).toBe('EUR');
    });

    it('throws when debits and credits differ by more than 0.01', async () => {
      await expect(
        service.postTransaction({
          description: 'Imbalanced TX',
          entries: [
            { accountCode: '1100', entryType: 'debit', amount: 100.02, description: 'Debit side' },
            { accountCode: '4000', entryType: 'credit', amount: 100, description: 'Credit side' },
          ],
        }),
      ).rejects.toThrow(/Ledger imbalance/);

      expect(mockPrisma.ledgerTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects diff of exactly 0.011 (above tolerance)', async () => {
      await expect(
        service.postTransaction({
          description: 'Just over tolerance',
          entries: [
            { accountCode: '1100', entryType: 'debit', amount: 200.011, description: 'D' },
            { accountCode: '4000', entryType: 'credit', amount: 200, description: 'C' },
          ],
        }),
      ).rejects.toThrow(/Ledger imbalance/);
    });

    it('accepts diff of exactly 0.01 (within tolerance)', async () => {
      mockPrisma.ledgerTransaction.create.mockResolvedValue(makeTx({ id: 'tx-tolerance' }));

      const id = await service.postTransaction({
        description: 'Within tolerance TX',
        entries: [
          { accountCode: '1100', entryType: 'debit', amount: 100.01, description: 'D' },
          { accountCode: '4000', entryType: 'credit', amount: 100, description: 'C' },
        ],
      });

      expect(id).toBe('tx-tolerance');
    });

    it('defaults currency to EUR and tenantId to default when not provided', async () => {
      mockPrisma.ledgerTransaction.create.mockResolvedValue(makeTx());

      await service.postTransaction({
        description: 'Defaults test',
        entries: [
          { accountCode: '1100', entryType: 'debit', amount: 50, description: 'D' },
          { accountCode: '4000', entryType: 'credit', amount: 50, description: 'C' },
        ],
      });

      const callData = mockPrisma.ledgerTransaction.create.mock.calls[0][0].data;
      expect(callData.currency).toBe('EUR');
      expect(callData.tenantId).toBe('default');
    });
  });

  // ── recordOrderPayment ────────────────────────────────────────────────────

  describe('recordOrderPayment', () => {
    it('posts revenue and COGS transactions for a valid order', async () => {
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrder({ totalAmount: 300, items: [{ unitCost: 80, quantity: 2 }] }),
      );
      mockPrisma.ledgerTransaction.create.mockResolvedValue(makeTx());

      await service.recordOrderPayment('order-001');

      // Two calls: one for revenue, one for COGS
      expect(mockPrisma.ledgerTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('is idempotent — skips posting if a transaction already exists', async () => {
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(makeTx());

      await service.recordOrderPayment('order-001');

      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.ledgerTransaction.create).not.toHaveBeenCalled();
    });

    it('skips posting when order revenue is 0', async () => {
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrder({ totalAmount: 0, items: [] }),
      );

      await service.recordOrderPayment('order-001');

      expect(mockPrisma.ledgerTransaction.create).not.toHaveBeenCalled();
    });

    it('skips COGS transaction when item costs are zero', async () => {
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrder({ totalAmount: 150, items: [{ unitCost: 0, quantity: 5 }] }),
      );
      mockPrisma.ledgerTransaction.create.mockResolvedValue(makeTx());

      await service.recordOrderPayment('order-001');

      // Only revenue TX, no COGS TX
      expect(mockPrisma.ledgerTransaction.create).toHaveBeenCalledTimes(1);
    });

    it('returns early when order does not exist', async () => {
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await service.recordOrderPayment('nonexistent-order');

      expect(mockPrisma.ledgerTransaction.create).not.toHaveBeenCalled();
    });
  });

  // ── getAccountBalance ─────────────────────────────────────────────────────

  describe('getAccountBalance', () => {
    it('returns correct debits, credits, and balance for a debit-normal account', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        makeEntry({ entryType: 'debit', amount: 800 }),
        makeEntry({ entryType: 'debit', amount: 200 }),
        makeEntry({ entryType: 'credit', amount: 300 }),
      ]);
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(
        makeAccount({ normalBalance: 'debit' }),
      );

      const result = await service.getAccountBalance('1100');

      expect(result.debits).toBe(1000);
      expect(result.credits).toBe(300);
      expect(result.balance).toBe(700); // debits - credits for debit-normal account
    });

    it('computes balance as credits minus debits for credit-normal accounts', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        makeEntry({ accountCode: '4000', entryType: 'credit', amount: 500 }),
        makeEntry({ accountCode: '4000', entryType: 'debit', amount: 100 }),
      ]);
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(
        makeAccount({ code: '4000', normalBalance: 'credit' }),
      );

      const result = await service.getAccountBalance('4000');

      expect(result.debits).toBe(100);
      expect(result.credits).toBe(500);
      expect(result.balance).toBe(400); // credits - debits for credit-normal account
    });
  });

  // ── getTrialBalance ───────────────────────────────────────────────────────

  describe('getTrialBalance', () => {
    it('returns isBalanced true when total debits equal total credits', async () => {
      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        makeAccount({ code: '1100', normalBalance: 'debit' }),
        makeAccount({ code: '4000', normalBalance: 'credit' }),
      ]);
      // For each account getAccountBalance is called — mock ledgerEntry.findMany and ledgerAccount.findUnique
      mockPrisma.ledgerEntry.findMany
        .mockResolvedValueOnce([makeEntry({ entryType: 'debit', amount: 500 })])
        .mockResolvedValueOnce([makeEntry({ entryType: 'credit', amount: 500 })]);
      mockPrisma.ledgerAccount.findUnique
        .mockResolvedValueOnce(makeAccount({ code: '1100', normalBalance: 'debit' }))
        .mockResolvedValueOnce(makeAccount({ code: '4000', normalBalance: 'credit' }));

      const result = await service.getTrialBalance();

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebits).toBe(500);
      expect(result.totalCredits).toBe(500);
      expect(result.accounts).toHaveLength(2);
    });

    it('returns isBalanced false when total debits differ from total credits by more than 0.01', async () => {
      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        makeAccount({ code: '1100', normalBalance: 'debit' }),
      ]);
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        makeEntry({ entryType: 'debit', amount: 200 }),
      ]);
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(
        makeAccount({ code: '1100', normalBalance: 'debit' }),
      );

      const result = await service.getTrialBalance();

      // 200 debits, 0 credits → not balanced
      expect(result.isBalanced).toBe(false);
    });
  });

  // ── getPnL ────────────────────────────────────────────────────────────────

  describe('getPnL', () => {
    it('calculates grossProfit and netIncome correctly', async () => {
      // getAccountBalance is called 4 times: revenue, cogs, platformCost, fulfillment
      // Each call uses ledgerEntry.findMany + ledgerAccount.findUnique
      const revenueEntries = [makeEntry({ accountCode: '4000', entryType: 'credit', amount: 1000 })];
      const cogsEntries = [makeEntry({ accountCode: '5000', entryType: 'debit', amount: 400 })];
      const platformEntries = [makeEntry({ accountCode: '5100', entryType: 'debit', amount: 80 })];
      const fulfillmentEntries = [makeEntry({ accountCode: '5200', entryType: 'debit', amount: 60 })];

      mockPrisma.ledgerEntry.findMany
        .mockResolvedValueOnce(revenueEntries)      // revenue (4000)
        .mockResolvedValueOnce(cogsEntries)         // cogs (5000)
        .mockResolvedValueOnce(platformEntries)     // platformCost (5100)
        .mockResolvedValueOnce(fulfillmentEntries); // fulfillment (5200)

      mockPrisma.ledgerAccount.findUnique
        .mockResolvedValueOnce(makeAccount({ code: '4000', normalBalance: 'credit' }))
        .mockResolvedValueOnce(makeAccount({ code: '5000', normalBalance: 'debit' }))
        .mockResolvedValueOnce(makeAccount({ code: '5100', normalBalance: 'debit' }))
        .mockResolvedValueOnce(makeAccount({ code: '5200', normalBalance: 'debit' }));

      const pnl = await service.getPnL();

      // Revenue balance (credit-normal): credits(1000) - debits(0) = 1000
      // COGS balance (debit-normal): debits(400) - credits(0) = 400
      // grossProfit = 1000 - 400 = 600
      // platformCost = 80, fulfillment = 60, totalExpenses = 140
      // netIncome = 600 - 140 = 460
      expect(pnl.revenue).toBe(1000);
      expect(pnl.cogs).toBe(400);
      expect(pnl.grossProfit).toBe(600);
      expect(pnl.totalExpenses).toBe(140);
      expect(pnl.netIncome).toBe(460);
      expect(pnl.grossMarginPct).toBeCloseTo(60, 1);
    });

    it('returns zero grossMarginPct when revenue is 0', async () => {
      // All accounts return no entries
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue(
        makeAccount({ normalBalance: 'credit' }),
      );

      const pnl = await service.getPnL();

      expect(pnl.grossMarginPct).toBe(0);
      expect(pnl.revenue).toBe(0);
    });
  });
});
