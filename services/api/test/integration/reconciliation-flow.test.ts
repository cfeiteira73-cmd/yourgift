/**
 * Integration Test: Reconciliation Flow
 *
 * Tests ReconciliationService working with LedgerService via EventBusService.
 *
 * Strategy: real ReconciliationService + LedgerService wired through
 * TestingModule. Only Prisma is mocked at the DB boundary.
 * All service interactions (event emission, drift detection, issue creation)
 * are exercised end-to-end through the real service code.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from '../../src/reconciliation/reconciliation.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { EventBusService } from '../../src/events/event-bus.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Prisma stub factory ───────────────────────────────────────────────────────

function buildPrismaStub(opts: {
  /** Paid order total (for reconciliation checks) */
  paidOrderTotal?: number;
  /** Ledger revenue total (what the ledger thinks was earned) */
  ledgerRevenuTotal?: number;
  /** Orders with a stripePaymentId but no ledger tx (orphan) */
  orphanOrders?: Array<{ id: string; stripePaymentId: string; totalAmount: number }>;
  /** Orders with the same stripeSessionId (duplicate charge) */
  duplicateOrders?: Array<{ id: string; stripeSessionId: string; totalAmount: number }>;
} = {}) {
  const {
    paidOrderTotal = 5000,
    ledgerRevenuTotal = 5000,
    orphanOrders = [],
    duplicateOrders = [],
  } = opts;

  const issueStore: Array<{ id: string; runId: string; issueType: string; status: string }> = [];
  const runStore: Array<{ id: string; status: string }> = [];

  return {
    // ── ReconciliationRun ───────────────────────────────────────────────────
    reconciliationRun: {
      create: jest.fn().mockImplementation((args: { data: { id?: string; status?: string; [k: string]: unknown } }) => {
        const run = { id: uuid(), ...args.data };
        runStore.push({ id: run.id as string, status: (run.status ?? 'running') as string });
        return Promise.resolve(run);
      }),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: { [k: string]: unknown } }) => {
        const run = runStore.find((r) => r.id === args.where.id);
        if (run) Object.assign(run, args.data);
        return Promise.resolve({ id: args.where.id, ...args.data });
      }),
      findMany: jest.fn().mockResolvedValue(runStore),
    },

    // ── ReconciliationIssue ─────────────────────────────────────────────────
    reconciliationIssue: {
      createMany: jest.fn().mockImplementation((args: { data: Array<{ runId?: string; issueType?: string; [k: string]: unknown }> }) => {
        for (const d of args.data) {
          issueStore.push({ id: uuid(), runId: d.runId ?? '', issueType: d.issueType ?? '', status: 'open' });
        }
        return Promise.resolve({ count: args.data.length });
      }),
      create: jest.fn().mockImplementation((args: { data: { id?: string; runId?: string; issueType?: string; [k: string]: unknown } }) => {
        const issue = { id: uuid(), status: 'open', ...args.data };
        issueStore.push({ id: issue.id as string, runId: issue.runId ?? '', issueType: issue.issueType ?? '', status: 'open' });
        return Promise.resolve(issue);
      }),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: { [k: string]: unknown } }) => {
        const issue = issueStore.find((i) => i.id === args.where.id);
        if (issue) Object.assign(issue, args.data);
        return Promise.resolve({ id: args.where.id, ...args.data });
      }),
      findMany: jest.fn().mockResolvedValue(issueStore),
    },

    // ── Order ───────────────────────────────────────────────────────────────
    order: {
      count: jest.fn().mockResolvedValue(10),
      groupBy: jest.fn().mockResolvedValue([{ tenantId: 'tenant-abc', _count: { id: 5 } }]),
      aggregate: jest.fn().mockImplementation((args: { where?: { status?: string } }) => {
        if (args.where?.status === 'paid') {
          return Promise.resolve({ _sum: { totalAmount: paidOrderTotal } });
        }
        return Promise.resolve({ _sum: { totalAmount: 0 } });
      }),
      findMany: jest.fn().mockImplementation((args: { where?: { status?: string; stripePaymentId?: unknown; stripeSessionId?: unknown; marginAmount?: unknown } }) => {
        // Orphan check: orders with stripePaymentId filter
        if (args.where?.stripePaymentId !== undefined) {
          return Promise.resolve(orphanOrders);
        }
        // Duplicate check: orders with stripeSessionId filter
        if (args.where?.stripeSessionId !== undefined) {
          return Promise.resolve(duplicateOrders);
        }
        // Delivered orders for missing invoice check
        if (args.where?.status === 'delivered') {
          return Promise.resolve([]);
        }
        // Negative margin
        if (args.where?.marginAmount !== undefined) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    },

    // ── LedgerEntry ─────────────────────────────────────────────────────────
    ledgerEntry: {
      findMany: jest.fn().mockResolvedValue([
        { amount: ledgerRevenuTotal, entryType: 'credit', accountCode: 'revenue', tenantId: 'tenant-abc' },
      ]),
      aggregate: jest.fn().mockImplementation(() =>
        Promise.resolve({ _sum: { amount: ledgerRevenuTotal } }),
      ),
    },

    // ── LedgerTransaction ────────────────────────────────────────────────────
    ledgerTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: uuid(), ...data }),
      ),
    },

    // ── LedgerAccount ───────────────────────────────────────────────────────
    ledgerAccount: {
      findUnique: jest.fn().mockResolvedValue({ normalBalance: 'credit', code: 'revenue' }),
      findMany: jest.fn().mockResolvedValue([]),
    },

    // ── EventLog ────────────────────────────────────────────────────────────
    eventLog: {
      findFirst: jest.fn().mockResolvedValue({ id: uuid(), event: 'invoice.generated' }),
    },

    _issueStore: issueStore,
    _runStore: runStore,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Reconciliation Flow Integration', () => {
  let module: TestingModule;
  let reconciliationService: ReconciliationService;
  let ledgerService: LedgerService;
  let eventBus: EventBusService;
  let prismaStub: ReturnType<typeof buildPrismaStub>;

  async function buildModule(opts: Parameters<typeof buildPrismaStub>[0] = {}) {
    prismaStub = buildPrismaStub(opts);

    module = await Test.createTestingModule({
      providers: [
        EventBusService,
        LedgerService,
        ReconciliationService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    reconciliationService = module.get(ReconciliationService);
    ledgerService = module.get(LedgerService);
    eventBus = module.get(EventBusService);
  }

  afterEach(async () => {
    if (module) await module.close();
    jest.clearAllMocks();
  });

  // ── 1. Clean state: no issues ────────────────────────────────────────────

  it('clean state: no issues detected when ledger matches orders', async () => {
    await buildModule({ paidOrderTotal: 5000, ledgerRevenuTotal: 5000 });

    const run = await reconciliationService.runReconciliation('delta', 'test-runner', 'tenant-abc');
    const runRecord = run as { issuesFound: number; status: string; integrityScore: number };

    expect(runRecord.status).toBe('completed');
    expect(runRecord.issuesFound).toBe(0);
    expect(runRecord.integrityScore).toBe(100);
    // No issues should be persisted
    expect(prismaStub.reconciliationIssue.createMany).not.toHaveBeenCalled();
  });

  // ── 2. Orphan payment ────────────────────────────────────────────────────

  it('orphan payment: payment without matching ledger tx creates issue', async () => {
    const orderId = uuid();
    const orphanOrder = { id: orderId, stripePaymentId: `pi_test_${uuid()}`, totalAmount: 750 };

    await buildModule({ orphanOrders: [orphanOrder] });

    // Simulate: orphan order has a stripePaymentId but no ledger tx
    prismaStub.order.findMany.mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
      if (where && 'stripePaymentId' in where) {
        return Promise.resolve([orphanOrder]);
      }
      return Promise.resolve([]);
    });
    // findFirst for ledger tx returns null (no matching tx)
    prismaStub.ledgerTransaction.findFirst.mockResolvedValue(null);

    const run = await reconciliationService.runReconciliation('delta', 'test-runner');
    const runRecord = run as { issuesFound: number; status: string };

    expect(runRecord.status).toBe('completed');
    expect(runRecord.issuesFound).toBeGreaterThan(0);
    expect(prismaStub.reconciliationIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ issueType: 'orphan_payment' }),
        ]),
      }),
    );
  });

  // ── 3. Duplicate charge ───────────────────────────────────────────────────

  it('duplicate charge: same order paid twice creates duplicate issue', async () => {
    const sessionId = `cs_test_${uuid()}`;
    const duplicateOrders = [
      { id: uuid(), stripeSessionId: sessionId, totalAmount: 1200 },
      { id: uuid(), stripeSessionId: sessionId, totalAmount: 1200 },
    ];

    await buildModule({ duplicateOrders });

    prismaStub.order.findMany.mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
      if (where && 'stripeSessionId' in where) {
        return Promise.resolve(duplicateOrders);
      }
      return Promise.resolve([]);
    });

    const run = await reconciliationService.runReconciliation('delta', 'test-runner');
    const runRecord = run as { issuesFound: number; status: string };

    expect(runRecord.status).toBe('completed');
    expect(runRecord.issuesFound).toBeGreaterThan(0);
    expect(prismaStub.reconciliationIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            issueType: 'duplicate_charge',
            severity: 'critical',
          }),
        ]),
      }),
    );
  });

  // ── 4. Drift > €100 → critical event emitted ─────────────────────────────

  it('drift detected: ledger drift > €100 emits critical event', async () => {
    const criticalDriftEvents: unknown[] = [];

    await buildModule({ paidOrderTotal: 5000, ledgerRevenuTotal: 4850 }); // €150 drift

    eventBus.on('reconciliation.critical_drift', (payload) => {
      criticalDriftEvents.push(payload);
    });

    const report = await reconciliationService.detectDrift('tenant-abc');

    expect(report.drift).toBeGreaterThan(100);
    expect(report.status).toBe('critical');
    expect(criticalDriftEvents).toHaveLength(1);
    expect(criticalDriftEvents[0]).toMatchObject({
      tenantId: 'tenant-abc',
      drift: expect.any(Number),
    });

    // A reconciliation run + issue must be persisted for the drift
    expect(prismaStub.reconciliationRun.create).toHaveBeenCalled();
    expect(prismaStub.reconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueType: 'ledger_drift',
          severity: 'critical',
        }),
      }),
    );
  });

  // ── 5. Repair issue: marks reconciliation issue as resolved ───────────────

  it('repair issue: marks reconciliation issue as resolved', async () => {
    await buildModule();

    const issueId = uuid();

    // Mock update for the specific issue
    prismaStub.reconciliationIssue.update.mockResolvedValueOnce({
      id: issueId,
      status: 'resolved',
      repairedBy: 'ops@yourgift.pt',
      repairedAt: new Date(),
      repairAction: 'Manually marked as repaired by ops@yourgift.pt',
    });

    const repaired = await reconciliationService.repairIssue(issueId, 'ops@yourgift.pt');
    const repairedRecord = repaired as { status: string; repairedBy: string };

    expect(repairedRecord.status).toBe('resolved');
    expect(repairedRecord.repairedBy).toBe('ops@yourgift.pt');
    expect(prismaStub.reconciliationIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: issueId },
        data: expect.objectContaining({
          status: 'resolved',
          repairedBy: 'ops@yourgift.pt',
        }),
      }),
    );
  });
});
