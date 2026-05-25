/**
 * Integration tests — Financial Reconciliation
 *
 * Tests the reconciliation logic with mocked Prisma:
 * - Delta vs full run modes
 * - Orphan payment detection
 * - Integrity score calculation
 * - Issue persistence
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrismaPayment = {
  findMany: jest.fn(),
};

const mockPrismaOrder = {
  findMany: jest.fn(),
};

const mockPrismaIssue = {
  createMany: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
};

const mockPrismaReconciliationRun = {
  create: jest.fn(),
  findMany: jest.fn(),
};

const mockPrisma = {
  payment: mockPrismaPayment,
  order: mockPrismaOrder,
  reconciliationIssue: mockPrismaIssue,
  reconciliationRun: mockPrismaReconciliationRun,
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

// ── Reconciliation Engine (inline implementation for testing) ─────────────────

type ReconciliationMode = 'delta' | 'full';

interface Payment {
  id: string;
  orderId: string | null;
  amount: number;
  status: string;
  stripePaymentIntentId?: string | null;
  createdAt: Date;
}

interface Order {
  id: string;
  totalAmount: number;
  paymentStatus: string;
  stripePaymentIntentId?: string | null;
}

interface ReconciliationIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  paymentId?: string;
  orderId?: string;
  detail: string;
}

interface ReconciliationResult {
  runId: string;
  mode: ReconciliationMode;
  integrityScore: number;
  issuesFound: number;
  issues: ReconciliationIssue[];
  paymentsChecked: number;
  ordersChecked: number;
  durationMs: number;
}

/**
 * Simplified reconciliation engine — mirrors the logic a real ReconciliationService
 * would implement, using Prisma as the data source.
 */
class ReconciliationEngine {
  constructor(private readonly prisma: typeof mockPrisma) {}

  async run(mode: ReconciliationMode): Promise<ReconciliationResult> {
    const start = Date.now();
    const runId = `rec_${Date.now()}`;

    // Fetch data (delta = last 24h, full = all time)
    const since = mode === 'delta' ? new Date(Date.now() - 86_400_000) : new Date(0);

    const payments: Payment[] = await this.prisma.payment.findMany({
      where: { createdAt: { gte: since } },
    });

    const orders: Order[] = await this.prisma.order.findMany({
      where: { updatedAt: { gte: since } },
    });

    const issues: ReconciliationIssue[] = [];

    // Check 1: orphan payments (no matching order)
    for (const payment of payments) {
      if (payment.orderId === null) {
        issues.push({
          type: 'orphan_payment',
          severity: 'high',
          paymentId: payment.id,
          detail: `Payment ${payment.id} has no associated order`,
        });
      }
    }

    // Check 2: amount mismatch between payment and order
    for (const payment of payments) {
      if (!payment.orderId) continue;
      const order = orders.find((o) => o.id === payment.orderId);
      if (!order) continue;
      if (Math.abs(payment.amount - order.totalAmount) > 0.01) {
        issues.push({
          type: 'amount_mismatch',
          severity: 'critical',
          paymentId: payment.id,
          orderId: order.id,
          detail: `Payment amount ${payment.amount} != order total ${order.totalAmount}`,
        });
      }
    }

    // Check 3: duplicate Stripe payment intent IDs
    const stripeIds = payments
      .filter((p) => p.stripePaymentIntentId)
      .map((p) => p.stripePaymentIntentId!);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of stripeIds) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    for (const dupId of duplicates) {
      issues.push({
        type: 'duplicate_stripe_id',
        severity: 'critical',
        detail: `Stripe payment intent ${dupId} appears multiple times`,
      });
    }

    // Check 4: paid orders with no payment record
    for (const order of orders) {
      if (order.paymentStatus === 'paid') {
        const hasPayment = payments.some((p) => p.orderId === order.id);
        if (!hasPayment) {
          issues.push({
            type: 'missing_payment_record',
            severity: 'high',
            orderId: order.id,
            detail: `Order ${order.id} marked paid but no payment record found`,
          });
        }
      }
    }

    // Persist issues
    if (issues.length > 0) {
      await this.prisma.reconciliationIssue.createMany({
        data: issues.map((i) => ({ ...i, runId })),
      });
    }

    // Persist run record
    await this.prisma.reconciliationRun.create({
      data: {
        id: runId,
        mode,
        issuesFound: issues.length,
        integrityScore: this.calculateIntegrityScore(issues, payments.length),
        durationMs: Date.now() - start,
      },
    });

    return {
      runId,
      mode,
      integrityScore: this.calculateIntegrityScore(issues, payments.length),
      issuesFound: issues.length,
      issues,
      paymentsChecked: payments.length,
      ordersChecked: orders.length,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Integrity score: 100 minus weighted deductions per issue severity.
   * Critical = -10, High = -5, Medium = -2, Low = -1. Floor at 0.
   */
  calculateIntegrityScore(issues: ReconciliationIssue[], totalPayments: number): number {
    if (totalPayments === 0) return 100;
    const deduction = issues.reduce((sum, issue) => {
      const weights = { critical: 10, high: 5, medium: 2, low: 1 };
      return sum + (weights[issue.severity] ?? 1);
    }, 0);
    return Math.max(0, 100 - deduction);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ReconciliationEngine(mockPrisma as unknown as typeof mockPrisma);
    // Default: create/findMany succeed silently
    mockPrismaIssue.createMany.mockResolvedValue({ count: 0 });
    mockPrismaReconciliationRun.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
  });

  // ── Delta mode ──────────────────────────────────────────────────────────────

  it('runs in delta mode with no issues on clean data', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_1', orderId: 'ord_1', amount: 100, status: 'succeeded', stripePaymentIntentId: 'pi_1', createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([
      { id: 'ord_1', totalAmount: 100, paymentStatus: 'paid', stripePaymentIntentId: 'pi_1' },
    ]);

    const result = await engine.run('delta');

    expect(result.mode).toBe('delta');
    expect(result.issuesFound).toBe(0);
    expect(result.integrityScore).toBe(100);
    expect(result.paymentsChecked).toBe(1);
    expect(result.ordersChecked).toBe(1);
  });

  it('passes delta mode params — payment.findMany called with date filter', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    await engine.run('delta');

    const callArgs = mockPrismaPayment.findMany.mock.calls[0][0];
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
    // Delta = within last 24 hours — the date should be close to now minus 24h
    const expectedSince = Date.now() - 86_400_000;
    expect(callArgs.where.createdAt.gte.getTime()).toBeGreaterThan(expectedSince - 1000);
  });

  // ── Orphan payment detection ─────────────────────────────────────────────────

  it('detects orphan payment (no orderId)', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_orphan', orderId: null, amount: 50, status: 'succeeded', stripePaymentIntentId: 'pi_orphan', createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    const result = await engine.run('delta');

    expect(result.issuesFound).toBe(1);
    expect(result.issues[0].type).toBe('orphan_payment');
    expect(result.issues[0].severity).toBe('high');
    expect(result.issues[0].paymentId).toBe('pay_orphan');
  });

  // ── Amount mismatch detection ────────────────────────────────────────────────

  it('detects amount mismatch between payment and order', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_1', orderId: 'ord_1', amount: 99.50, status: 'succeeded', stripePaymentIntentId: 'pi_1', createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([
      { id: 'ord_1', totalAmount: 100.00, paymentStatus: 'paid', stripePaymentIntentId: 'pi_1' },
    ]);

    const result = await engine.run('delta');

    const mismatch = result.issues.find((i) => i.type === 'amount_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('critical');
    expect(mismatch!.paymentId).toBe('pay_1');
    expect(mismatch!.orderId).toBe('ord_1');
  });

  it('does not flag amount mismatch within tolerance (±0.01)', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_1', orderId: 'ord_1', amount: 100.005, status: 'succeeded', stripePaymentIntentId: 'pi_1', createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([
      { id: 'ord_1', totalAmount: 100.00, paymentStatus: 'paid', stripePaymentIntentId: 'pi_1' },
    ]);

    const result = await engine.run('delta');
    const mismatch = result.issues.find((i) => i.type === 'amount_mismatch');
    expect(mismatch).toBeUndefined();
  });

  // ── Duplicate Stripe ID detection ────────────────────────────────────────────

  it('detects duplicate Stripe payment intent IDs', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_1', orderId: 'ord_1', amount: 100, status: 'succeeded', stripePaymentIntentId: 'pi_dup', createdAt: new Date() },
      { id: 'pay_2', orderId: 'ord_2', amount: 100, status: 'succeeded', stripePaymentIntentId: 'pi_dup', createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([
      { id: 'ord_1', totalAmount: 100, paymentStatus: 'paid' },
      { id: 'ord_2', totalAmount: 100, paymentStatus: 'paid' },
    ]);

    const result = await engine.run('delta');

    const dup = result.issues.find((i) => i.type === 'duplicate_stripe_id');
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe('critical');
    expect(dup!.detail).toContain('pi_dup');
  });

  // ── Missing payment record for paid order ────────────────────────────────────

  it('detects paid order with no payment record', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([]);
    mockPrismaOrder.findMany.mockResolvedValue([
      { id: 'ord_ghost', totalAmount: 200, paymentStatus: 'paid' },
    ]);

    const result = await engine.run('delta');

    const missing = result.issues.find((i) => i.type === 'missing_payment_record');
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe('high');
    expect(missing!.orderId).toBe('ord_ghost');
  });

  // ── Integrity score calculation ──────────────────────────────────────────────

  it('returns integrity score 100 when no issues', () => {
    const score = engine.calculateIntegrityScore([], 10);
    expect(score).toBe(100);
  });

  it('returns integrity score 100 when no payments', () => {
    const score = engine.calculateIntegrityScore([], 0);
    expect(score).toBe(100);
  });

  it('deducts 10 per critical issue', () => {
    const issues: ReconciliationIssue[] = [
      { type: 'amount_mismatch', severity: 'critical', detail: 'test' },
      { type: 'duplicate_stripe_id', severity: 'critical', detail: 'test' },
    ];
    const score = engine.calculateIntegrityScore(issues, 10);
    expect(score).toBe(80); // 100 - 10 - 10
  });

  it('deducts 5 per high issue', () => {
    const issues: ReconciliationIssue[] = [
      { type: 'orphan_payment', severity: 'high', detail: 'test' },
    ];
    const score = engine.calculateIntegrityScore(issues, 5);
    expect(score).toBe(95);
  });

  it('floors integrity score at 0', () => {
    const issues: ReconciliationIssue[] = Array.from({ length: 15 }, (_, i) => ({
      type: 'amount_mismatch',
      severity: 'critical' as const,
      detail: `issue ${i}`,
    }));
    const score = engine.calculateIntegrityScore(issues, 10);
    expect(score).toBe(0); // 100 - 150 = -50 → floored at 0
  });

  // ── Issue persistence ────────────────────────────────────────────────────────

  it('persists issues via reconciliationIssue.createMany when issues found', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([
      { id: 'pay_orphan', orderId: null, amount: 50, status: 'succeeded', stripePaymentIntentId: null, createdAt: new Date() },
    ]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    await engine.run('delta');

    expect(mockPrismaIssue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: 'orphan_payment', severity: 'high' }),
        ]),
      }),
    );
  });

  it('does NOT call createMany when no issues found', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    await engine.run('delta');

    expect(mockPrismaIssue.createMany).not.toHaveBeenCalled();
  });

  it('always persists a reconciliation run record', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    await engine.run('full');

    expect(mockPrismaReconciliationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: 'full',
          issuesFound: 0,
          integrityScore: 100,
        }),
      }),
    );
  });

  // ── Run ID uniqueness ────────────────────────────────────────────────────────

  it('generates a unique runId for each run', async () => {
    mockPrismaPayment.findMany.mockResolvedValue([]);
    mockPrismaOrder.findMany.mockResolvedValue([]);

    const r1 = await engine.run('delta');

    // Small delay to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 2));
    const r2 = await engine.run('delta');

    expect(r1.runId).not.toBe(r2.runId);
  });
});
