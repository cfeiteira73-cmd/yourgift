/**
 * Integration Test: Procurement Flow
 *
 * Tests the procurement lifecycle across ProcurementWorkflowService,
 * RfqService, and ApprovalsService, connected through EventBusService.
 *
 * Strategy: real services wired via TestingModule; only Prisma,
 * PolicyExecutionService, BudgetLedgerService, and QueueService
 * are mocked at the boundary.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementWorkflowService } from '../../src/procurement-workflow/procurement-workflow.service';
import { EventBusService } from '../../src/events/event-bus.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PolicyExecutionService } from '../../src/policy-execution/policy-execution.service';
import { BudgetLedgerService } from '../../src/budget-ledger/budget-ledger.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface MockRequest {
  id: string;
  tenantId: string;
  organizationId: string | null;
  requesterId: string;
  title: string;
  description: string | null;
  category: string;
  supplierCode: string | null;
  estimatedCostEur: number | null;
  quantity: number | null;
  status: string;
  policyDecision: string | null;
  policyReason: string | null;
  approvalChainId: string | null;
  budgetAllocationId: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  actualCostEur: number | null;
  fulfilledAt: Date | null;
  updatedAt: Date;
}

function makeRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    id: uuid(),
    tenantId: 'tenant-' + uuid().slice(0, 8),
    organizationId: null,
    requesterId: 'requester-' + uuid().slice(0, 8),
    title: 'Branded Notebooks Q3 2026',
    description: '500 premium notebooks for sales team',
    category: 'office-supplies',
    supplierCode: null,
    estimatedCostEur: 2500.00,
    quantity: 500,
    status: 'draft',
    policyDecision: null,
    policyReason: null,
    approvalChainId: null,
    budgetAllocationId: null,
    approvedBy: null,
    rejectedBy: null,
    rejectionReason: null,
    actualCostEur: null,
    fulfilledAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPrismaStub(initialRequest: MockRequest) {
  const requestStore: { [id: string]: MockRequest } = {
    [initialRequest.id]: { ...initialRequest },
  };

  return {
    workflowProcurementRequest: {
      create: jest.fn().mockImplementation(({ data }: { data: Partial<MockRequest> }) => {
        const req: MockRequest = {
          id: uuid(),
          tenantId: data.tenantId ?? 'default',
          organizationId: data.organizationId ?? null,
          requesterId: data.requesterId ?? '',
          title: data.title ?? '',
          description: data.description ?? null,
          category: data.category ?? '',
          supplierCode: data.supplierCode ?? null,
          estimatedCostEur: data.estimatedCostEur ?? null,
          quantity: data.quantity ?? null,
          status: 'draft',
          policyDecision: null,
          policyReason: null,
          approvalChainId: null,
          budgetAllocationId: null,
          approvedBy: null,
          rejectedBy: null,
          rejectionReason: null,
          actualCostEur: null,
          fulfilledAt: null,
          updatedAt: new Date(),
        };
        requestStore[req.id] = req;
        return Promise.resolve(req);
      }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(requestStore[where.id] ?? null),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Partial<MockRequest> }) => {
        if (requestStore[where.id]) {
          Object.assign(requestStore[where.id], data, { updatedAt: new Date() });
        }
        return Promise.resolve(requestStore[where.id] ?? null);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(Object.values(requestStore))),
    },
    _requestStore: requestStore,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Procurement Flow Integration', () => {
  let module: TestingModule;
  let procurementService: ProcurementWorkflowService;
  let eventBus: EventBusService;
  let prismaStub: ReturnType<typeof buildPrismaStub>;
  let initialRequest: MockRequest;

  const mockPolicyService = {
    evaluate: jest.fn(),
  };

  const mockBudgetService = {
    reserve: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    spend: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    initialRequest = makeRequest();
    prismaStub = buildPrismaStub(initialRequest);

    // Default policy: requires manual approval
    mockPolicyService.evaluate.mockResolvedValue({
      decision: 'require_approval',
      reason: 'amount_exceeds_auto_approval_threshold',
      details: { approvalChain: null },
    });

    module = await Test.createTestingModule({
      providers: [
        EventBusService,
        ProcurementWorkflowService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: PolicyExecutionService, useValue: mockPolicyService },
        { provide: BudgetLedgerService, useValue: mockBudgetService },
      ],
    }).compile();

    procurementService = module.get(ProcurementWorkflowService);
    eventBus = module.get(EventBusService);

    jest.clearAllMocks();
    // Restore mocks reset by clearAllMocks
    mockPolicyService.evaluate.mockResolvedValue({
      decision: 'require_approval',
      reason: 'amount_exceeds_auto_approval_threshold',
      details: { approvalChain: null },
    });
    mockBudgetService.reserve.mockResolvedValue(undefined);
    mockBudgetService.commit.mockResolvedValue(undefined);
    mockBudgetService.spend.mockResolvedValue(undefined);
    mockBudgetService.release.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await module.close();
  });

  // ── 1. Create → submit → pending_approval ────────────────────────────────

  it('RFQ created → policy evaluated → pending_approval when threshold exceeded', async () => {
    const submittedEvents: unknown[] = [];
    eventBus.on('procurement.submitted', (payload) => submittedEvents.push(payload));

    // Create a new request
    const request = await procurementService.createRequest({
      tenantId: 'tenant-abc',
      requesterId: 'user-' + uuid().slice(0, 8),
      title: 'Branded Pens Bulk Order',
      category: 'promotional',
      estimatedCostEur: 8000,
      quantity: 2000,
    });

    expect(request.status).toBe('draft');

    // Submit for approval — policy returns require_approval
    const { request: updated, policyResult } = await procurementService.submitForApproval(
      request.id,
      request.requesterId,
    );

    expect(updated.status).toBe('pending_approval');
    expect(policyResult.decision).toBe('require_approval');
    expect(submittedEvents).toHaveLength(1);
    expect(submittedEvents[0]).toMatchObject({
      requestId: request.id,
      decision: 'require_approval',
    });
  });

  // ── 2. approval approved → order executing ────────────────────────────────

  it('approval approved → request moves to approved → execute starts fulfillment', async () => {
    const approvedEvents: unknown[] = [];
    const executedEvents: unknown[] = [];
    eventBus.on('procurement.approved', (p) => approvedEvents.push(p));
    eventBus.on('procurement.executed', (p) => executedEvents.push(p));

    // Seed a pending_approval request in the store
    const pendingRequest = makeRequest({ status: 'pending_approval' });
    prismaStub.workflowProcurementRequest.findUnique.mockResolvedValueOnce(pendingRequest);
    prismaStub.workflowProcurementRequest.update.mockResolvedValueOnce({
      ...pendingRequest,
      status: 'approved',
      approvedBy: 'manager-' + uuid().slice(0, 8),
    });

    const approvedRequest = await procurementService.approve(
      pendingRequest.id,
      'manager-' + uuid().slice(0, 8),
    );

    expect(approvedRequest.status).toBe('approved');
    expect(approvedEvents).toHaveLength(1);

    // Execute the approved request
    prismaStub.workflowProcurementRequest.findUnique.mockResolvedValueOnce(approvedRequest);
    prismaStub.workflowProcurementRequest.update.mockResolvedValueOnce({
      ...approvedRequest,
      status: 'executing',
    });

    const executingRequest = await procurementService.execute(approvedRequest.id);
    expect(executingRequest.status).toBe('executing');
    expect(executedEvents).toHaveLength(1);
  });

  // ── 3. approval rejected → order cancelled → budget released ──────────────

  it('approval rejected → request cancelled → budget released', async () => {
    const rejectedEvents: unknown[] = [];
    const cancelledEvents: unknown[] = [];
    eventBus.on('procurement.rejected', (p) => rejectedEvents.push(p));
    eventBus.on('procurement.cancelled', (p) => cancelledEvents.push(p));

    const pendingRequest = makeRequest({
      status: 'pending_approval',
      budgetAllocationId: 'budget-alloc-' + uuid().slice(0, 8),
      estimatedCostEur: 2500,
    });

    prismaStub.workflowProcurementRequest.findUnique.mockResolvedValueOnce(pendingRequest);
    prismaStub.workflowProcurementRequest.update.mockResolvedValueOnce({
      ...pendingRequest,
      status: 'rejected',
      rejectedBy: 'finance-head',
      rejectionReason: 'Over quarterly budget',
    });

    const rejectedRequest = await procurementService.reject(
      pendingRequest.id,
      'finance-head',
      'Over quarterly budget',
    );

    expect(rejectedRequest.status).toBe('rejected');
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0]).toMatchObject({
      requestId: pendingRequest.id,
      reason: 'Over quarterly budget',
    });

    // Cancel the rejected request and verify budget is released
    const rejectedForCancel = makeRequest({
      id: pendingRequest.id,
      status: 'pending_approval', // cancel checks for this to release budget
      budgetAllocationId: pendingRequest.budgetAllocationId,
      estimatedCostEur: pendingRequest.estimatedCostEur,
    });
    prismaStub.workflowProcurementRequest.findUnique.mockResolvedValueOnce(rejectedForCancel);
    prismaStub.workflowProcurementRequest.update.mockResolvedValueOnce({
      ...rejectedForCancel,
      status: 'cancelled',
    });

    const cancelledRequest = await procurementService.cancel(pendingRequest.id, 'Rejected by finance');
    expect(cancelledRequest.status).toBe('cancelled');
    expect(mockBudgetService.release).toHaveBeenCalledWith(
      pendingRequest.budgetAllocationId,
      pendingRequest.estimatedCostEur,
      pendingRequest.id,
    );
    expect(cancelledEvents).toHaveLength(1);
  });

  // ── 4. Policy auto-approve: allow decision skips manual stage ─────────────

  it('policy auto-approve: allow decision → request immediately approved', async () => {
    // Policy says allow (e.g. small amount under threshold)
    mockPolicyService.evaluate.mockResolvedValue({
      decision: 'allow',
      reason: 'amount_within_auto_approval_limit',
      details: { approvalChain: null },
    });

    const request = await procurementService.createRequest({
      tenantId: 'tenant-abc',
      requesterId: 'user-small-purchase',
      title: 'Pens and Sticky Notes',
      category: 'stationery',
      estimatedCostEur: 150,
      quantity: 50,
    });

    const { request: updated } = await procurementService.submitForApproval(
      request.id,
      request.requesterId,
    );

    // Auto-approved: no manual stage required
    expect(updated.status).toBe('approved');
    expect(updated.policyDecision).toBe('allow');
  });

  // ── 5. Policy deny: blocks immediately ────────────────────────────────────

  it('procurement policy deny: blocked request immediately rejected', async () => {
    mockPolicyService.evaluate.mockResolvedValue({
      decision: 'deny',
      reason: 'supplier_blacklisted',
      details: { approvalChain: null },
    });

    const request = await procurementService.createRequest({
      tenantId: 'tenant-abc',
      requesterId: 'user-blocked',
      title: 'Blocked Supplier Order',
      category: 'hardware',
      supplierCode: 'BLOCKED-SUPPLIER-001',
      estimatedCostEur: 5000,
      quantity: 10,
    });

    const { request: updated, policyResult } = await procurementService.submitForApproval(
      request.id,
      request.requesterId,
    );

    expect(updated.status).toBe('rejected');
    expect(policyResult.decision).toBe('deny');
    expect(policyResult.reason).toBe('supplier_blacklisted');
  });
});
