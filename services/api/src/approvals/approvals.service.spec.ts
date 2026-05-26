import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Mock factories ────────────────────────────────────────────────────────────

const makeApproval = (overrides: Record<string, unknown> = {}) => ({
  id: 'approval-001',
  orderId: 'order-001',
  requestedById: 'client-001',
  stage: 'hr',
  status: 'pending',
  approvedById: null,
  notes: null,
  requestedAt: new Date('2026-05-25T09:00:00.000Z'),
  resolvedAt: null,
  order: makeOrder(),
  requestedBy: { id: 'client-001', name: 'Alice Santos', email: 'alice@corp.pt' },
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-001',
  ref: 'YGO-20260525-9999',
  clientId: 'client-001',
  status: 'paid',
  totalAmount: 1500,
  currency: 'EUR',
  client: {
    id: 'client-001',
    name: 'Alice Santos',
    email: 'alice@corp.pt',
    tier: 'enterprise',
  },
  department: {
    id: 'dept-001',
    headEmail: 'hr@corp.pt',
  },
  company: {
    id: 'company-001',
    name: 'Acme Corp',
    billingEmail: 'finance@corp.pt',
  },
  ...overrides,
});

const makeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'client-001',
  name: 'Alice Santos',
  email: 'alice@corp.pt',
  tier: 'enterprise',
  ...overrides,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  approval: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  client: {
    findUnique: jest.fn(),
  },
  eventLog: {
    create: jest.fn(),
  },
};

const mockEvents = {
  on: jest.fn(),
  emit: jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ApprovalsService', () => {
  let service: ApprovalsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.eventLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  // ── requestApproval ───────────────────────────────────────────────────────

  describe('requestApproval', () => {
    it('creates a new approval in pending state for an existing order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.approval.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.approval.create.mockResolvedValue(makeApproval());

      const result = await service.requestApproval('order-001', 'client-001', 'hr');

      expect(mockPrisma.approval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-001',
            requestedById: 'client-001',
            stage: 'hr',
            status: 'pending',
          }),
        }),
      );
      expect(result.status).toBe('pending');
    });

    it('throws NotFoundException when the order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.requestApproval('ghost-order', 'client-001', 'hr'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.approval.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a pending approval for the same stage already exists', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.approval.findFirst.mockResolvedValue(makeApproval()); // duplicate found

      await expect(
        service.requestApproval('order-001', 'client-001', 'hr'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.approval.create).not.toHaveBeenCalled();
    });

    it('emits approval.requested event after creation', async () => {
      const approval = makeApproval();
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.approval.findFirst.mockResolvedValue(null);
      mockPrisma.approval.create.mockResolvedValue(approval);

      await service.requestApproval('order-001', 'client-001', 'hr');

      expect(mockEvents.emit).toHaveBeenCalledWith('approval.requested', approval);
    });

    it('logs an event to the event log on creation', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.approval.findFirst.mockResolvedValue(null);
      mockPrisma.approval.create.mockResolvedValue(makeApproval());

      await service.requestApproval('order-001', 'client-001', 'hr');

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'approval.requested',
            actorId: 'client-001',
          }),
        }),
      );
    });
  });

  // ── approve ───────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('transitions a pending approval to "approved" status', async () => {
      const pendingApproval = makeApproval({ stage: 'finance' }); // last stage — no next stage
      const updatedApproval = makeApproval({
        stage: 'finance',
        status: 'approved',
        approvedById: 'manager-001',
        resolvedAt: new Date(),
      });

      mockPrisma.approval.findUnique.mockResolvedValue(pendingApproval);
      mockPrisma.approval.update.mockResolvedValue(updatedApproval);

      // advanceWorkflow calls order.findUnique and order.update after last stage
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'paid' }));
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'approved' }));

      const result = await service.approve('approval-001', 'manager-001', 'Looks good');

      expect(result.status).toBe('approved');
      expect(mockPrisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-001' },
          data: expect.objectContaining({
            status: 'approved',
            approvedById: 'manager-001',
            notes: 'Looks good',
          }),
        }),
      );
    });

    it('throws NotFoundException when approval does not exist', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(null);

      await expect(service.approve('missing-approval', 'manager-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when approval is already resolved', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(
        makeApproval({ status: 'approved' }),
      );

      await expect(service.approve('approval-001', 'manager-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('emits approval.resolved event after approving', async () => {
      const updatedApproval = makeApproval({ stage: 'finance', status: 'approved' });
      mockPrisma.approval.findUnique.mockResolvedValue(makeApproval({ stage: 'finance' }));
      mockPrisma.approval.update.mockResolvedValue(updatedApproval);
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'approved' }));

      await service.approve('approval-001', 'manager-001');

      expect(mockEvents.emit).toHaveBeenCalledWith('approval.resolved', updatedApproval);
    });

    it('marks the order as "approved" after the final approval stage (finance) completes', async () => {
      // finance is the last stage in STAGE_SEQUENCE
      mockPrisma.approval.findUnique.mockResolvedValue(makeApproval({ stage: 'finance' }));
      mockPrisma.approval.update.mockResolvedValue(makeApproval({ stage: 'finance', status: 'approved' }));
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'approved' }));

      await service.approve('approval-001', 'manager-001');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
      expect(mockEvents.emit).toHaveBeenCalledWith('order.approved', expect.any(Object));
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('transitions a pending approval to "rejected" status with notes', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(makeApproval());
      mockPrisma.approval.update.mockResolvedValue(
        makeApproval({ status: 'rejected', notes: 'Budget exceeded', approvedById: 'manager-002' }),
      );
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      const result = await service.reject('approval-001', 'manager-002', 'Budget exceeded');

      expect(result.status).toBe('rejected');
      expect(mockPrisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            notes: 'Budget exceeded',
            approvedById: 'manager-002',
          }),
        }),
      );
    });

    it('cancels the associated order when an approval is rejected', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(makeApproval());
      mockPrisma.approval.update.mockResolvedValue(makeApproval({ status: 'rejected' }));
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await service.reject('approval-001', 'manager-002', 'Policy violation');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: { status: 'cancelled' },
        }),
      );
    });

    it('emits approval.rejected and order.cancelled events', async () => {
      const rejectedApproval = makeApproval({ status: 'rejected' });
      mockPrisma.approval.findUnique.mockResolvedValue(makeApproval());
      mockPrisma.approval.update.mockResolvedValue(rejectedApproval);
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await service.reject('approval-001', 'manager-002', 'Policy violation');

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'approval.rejected',
        expect.objectContaining({ orderId: 'order-001' }),
      );
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({ orderId: 'order-001', reason: 'approval_rejected' }),
      );
    });

    it('throws NotFoundException when approval does not exist', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(null);

      await expect(
        service.reject('missing-approval', 'manager-001', 'not found'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when trying to reject an already resolved approval', async () => {
      mockPrisma.approval.findUnique.mockResolvedValue(
        makeApproval({ status: 'rejected' }),
      );

      await expect(
        service.reject('approval-001', 'manager-001', 'too late'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all approvals when no status filter is provided', async () => {
      const approvals = [makeApproval(), makeApproval({ id: 'approval-002', status: 'approved' })];
      mockPrisma.approval.findMany.mockResolvedValue(approvals);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      const whereArg = mockPrisma.approval.findMany.mock.calls[0][0].where;
      expect(whereArg).toBeUndefined();
    });

    it('filters approvals by status when provided', async () => {
      mockPrisma.approval.findMany.mockResolvedValue([makeApproval()]);

      await service.findAll('pending');

      expect(mockPrisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });
  });

  // ── getForOrder ───────────────────────────────────────────────────────────

  describe('getForOrder', () => {
    it('returns all approvals for a given order sorted by requestedAt ascending', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.approval.findMany.mockResolvedValue([makeApproval()]);

      const result = await service.getForOrder('order-001');

      expect(mockPrisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-001' },
          orderBy: { requestedAt: 'asc' },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getForOrder('ghost-order')).rejects.toThrow(NotFoundException);
    });
  });
});
