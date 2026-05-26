import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Mock factories ────────────────────────────────────────────────────────────

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-001',
  runType: 'delta',
  status: 'running',
  triggeredBy: 'system',
  tenantId: null,
  integrityScore: 100,
  totalChecked: 0,
  issuesFound: 0,
  startedAt: new Date(),
  completedAt: null,
  errorMessage: null,
  durationMs: null,
  ...overrides,
});

const makeCompletedRun = (overrides: Record<string, unknown> = {}) =>
  makeRun({
    status: 'completed',
    completedAt: new Date(),
    durationMs: 250,
    ...overrides,
  });

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-001',
  stripePaymentId: 'pi_test_001',
  stripeSessionId: 'cs_test_001',
  totalAmount: 300,
  marginAmount: 50,
  status: 'paid',
  ...overrides,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  reconciliationRun: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  reconciliationIssue: {
    createMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  ledgerTransaction: {
    findFirst: jest.fn(),
  },
  ledgerEntry: {
    findMany: jest.fn(),
  },
  eventLog: {
    findFirst: jest.fn(),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a default "happy path" prisma setup where all checks return zero issues.
 * Individual tests override only the mocks they need.
 */
function setupHappyPath() {
  mockPrisma.reconciliationRun.create.mockResolvedValue(makeRun());
  mockPrisma.reconciliationRun.update.mockResolvedValue(makeCompletedRun());
  mockPrisma.reconciliationIssue.createMany.mockResolvedValue({ count: 0 });

  // order counts used by extract()
  mockPrisma.order.count.mockResolvedValue(0);

  // checkOrphanPayments — no orders with stripePaymentId
  // checkLedgerDrift — zero drift
  // checkMissingInvoices — no delivered orders
  // checkNegativeMargin — no negative margin orders
  // checkDuplicateCharges — no orders with stripeSessionId
  mockPrisma.order.findMany.mockResolvedValue([]);
  mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });
  mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
  mockPrisma.ledgerTransaction.findFirst.mockResolvedValue({ id: 'tx-exists' });
  mockPrisma.eventLog.findFirst.mockResolvedValue({ id: 'log-exists' });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ReconciliationService', () => {
  let service: ReconciliationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    setupHappyPath();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  // ── runReconciliation: setup & teardown ───────────────────────────────────

  describe('runReconciliation', () => {
    it('creates a reconciliation run record with status "running" at the start', async () => {
      await service.runReconciliation('delta', 'test');

      expect(mockPrisma.reconciliationRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            runType: 'delta',
            status: 'running',
            triggeredBy: 'test',
          }),
        }),
      );
    });

    it('marks the run as "completed" after all checks pass', async () => {
      await service.runReconciliation('delta');

      expect(mockPrisma.reconciliationRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-001' },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('uses a 24-hour period window for delta runs', async () => {
      const before = Date.now();
      await service.runReconciliation('delta');
      const after = Date.now();

      const createCall = mockPrisma.reconciliationRun.create.mock.calls[0][0].data;
      const periodDiff = createCall.periodEnd.getTime() - createCall.periodStart.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Allow ±1 second for test execution time
      expect(periodDiff).toBeGreaterThanOrEqual(oneDayMs - 1000);
      expect(periodDiff).toBeLessThanOrEqual(oneDayMs + 1000);
    });

    it('uses a 30-day period window for full runs', async () => {
      await service.runReconciliation('full');

      const createCall = mockPrisma.reconciliationRun.create.mock.calls[0][0].data;
      const periodDiff = createCall.periodEnd.getTime() - createCall.periodStart.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(periodDiff).toBeGreaterThanOrEqual(thirtyDaysMs - 1000);
      expect(periodDiff).toBeLessThanOrEqual(thirtyDaysMs + 1000);
    });

    it('detects orphan payments: orders with stripePaymentId but no LedgerTransaction', async () => {
      const orphanOrder = makeOrder({ id: 'orphan-order-001', stripePaymentId: 'pi_orphan' });
      // Return an order that has a stripePaymentId
      mockPrisma.order.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where && 'stripePaymentId' in where) {
          return Promise.resolve([orphanOrder]);
        }
        return Promise.resolve([]);
      });
      // No corresponding ledger transaction
      mockPrisma.ledgerTransaction.findFirst.mockResolvedValue(null);

      await service.runReconciliation('delta');

      // Issues should have been persisted
      expect(mockPrisma.reconciliationIssue.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ issueType: 'orphan_payment', severity: 'high' }),
          ]),
        }),
      );
    });

    it('detects duplicate charges: multiple orders sharing the same stripeSessionId', async () => {
      const dupOrder1 = makeOrder({ id: 'order-dup-1', stripeSessionId: 'cs_duplicate' });
      const dupOrder2 = makeOrder({ id: 'order-dup-2', stripeSessionId: 'cs_duplicate' });
      // Return duplicate orders when querying by stripeSessionId
      mockPrisma.order.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where && 'stripeSessionId' in where) {
          return Promise.resolve([dupOrder1, dupOrder2]);
        }
        return Promise.resolve([]);
      });

      await service.runReconciliation('delta');

      expect(mockPrisma.reconciliationIssue.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ issueType: 'duplicate_charge', severity: 'critical' }),
          ]),
        }),
      );
    });

    it('persists zero issues when all checks are clean', async () => {
      // Happy path already set up
      await service.runReconciliation('delta');

      // createMany is called only when issues.length > 0; with 0 issues it should not be called
      // or if called the data array should be empty
      const createManyCalls = mockPrisma.reconciliationIssue.createMany.mock.calls;
      const hasIssues = createManyCalls.some(
        (call: [{ data: unknown[] }]) => call[0].data.length > 0,
      );
      expect(hasIssues).toBe(false);
    });

    it('marks run as "failed" and stores error message when an unrecoverable error occurs', async () => {
      // Make the run creation succeed but the order count throw
      mockPrisma.order.count.mockRejectedValue(new Error('Database connection lost'));
      // Also make the intermediate Promise.allSettled checks throw at the update level
      mockPrisma.reconciliationRun.update.mockResolvedValue(makeRun({ status: 'failed' }));

      // The service wraps checks in Promise.allSettled so individual check failures
      // are captured. An error in the outer try-catch (e.g., issue persistence) would
      // cause the run to be marked failed.
      // Force an error in createMany to trigger the outer catch:
      mockPrisma.reconciliationIssue.createMany.mockRejectedValue(new Error('DB write failed'));

      await expect(service.runReconciliation('delta')).rejects.toThrow('DB write failed');

      expect(mockPrisma.reconciliationRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });
  });

  // ── repairIssue ───────────────────────────────────────────────────────────

  describe('repairIssue', () => {
    it('marks an issue as resolved with the repairer identity', async () => {
      mockPrisma.reconciliationIssue.update.mockResolvedValue({
        id: 'issue-001',
        status: 'resolved',
        repairedBy: 'admin@yourgift.pt',
      });

      const result = await service.repairIssue('issue-001', 'admin@yourgift.pt') as { status: string; repairedBy: string };

      expect(mockPrisma.reconciliationIssue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'issue-001' },
          data: expect.objectContaining({
            status: 'resolved',
            repairedBy: 'admin@yourgift.pt',
          }),
        }),
      );
      expect(result.status).toBe('resolved');
    });
  });

  // ── getOpenIssues ─────────────────────────────────────────────────────────

  describe('getOpenIssues', () => {
    it('returns only open issues filtered by severity', async () => {
      const criticalIssue = {
        id: 'issue-critical-001',
        issueType: 'duplicate_charge',
        severity: 'critical',
        status: 'open',
      };
      mockPrisma.reconciliationIssue.findMany.mockResolvedValue([criticalIssue]);

      const result = await service.getOpenIssues({ severity: 'critical' });

      expect(result).toHaveLength(1);
      expect(mockPrisma.reconciliationIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'open',
            severity: 'critical',
          }),
        }),
      );
    });

    it('applies default limit of 100 when not specified', async () => {
      mockPrisma.reconciliationIssue.findMany.mockResolvedValue([]);

      await service.getOpenIssues({});

      expect(mockPrisma.reconciliationIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('respects a custom limit when provided', async () => {
      mockPrisma.reconciliationIssue.findMany.mockResolvedValue([]);

      await service.getOpenIssues({ limit: 10 });

      expect(mockPrisma.reconciliationIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns up to 30 reconciliation runs ordered by most recent first', async () => {
      const runs = [makeCompletedRun({ id: 'run-latest' }), makeCompletedRun({ id: 'run-older' })];
      mockPrisma.reconciliationRun.findMany.mockResolvedValue(runs);

      const result = await service.getHistory();

      expect(result).toHaveLength(2);
      expect(mockPrisma.reconciliationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startedAt: 'desc' },
          take: 30,
        }),
      );
    });
  });
});
