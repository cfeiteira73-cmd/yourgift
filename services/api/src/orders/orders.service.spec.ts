import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EventSourcingService } from '../event-sourcing/event-sourcing.service';
import { CreateOrderDto } from './dto/create-order.dto';

// ── Mock factories ────────────────────────────────────────────────────────────

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-abc-001',
  ref: 'YGO-20260525-4321',
  clientId: 'client-001',
  status: 'created',
  companyId: 'company-001',
  departmentId: 'dept-001',
  campaignId: null,
  totalAmount: 250,
  marginAmount: 50,
  currency: 'EUR',
  stripeSessionId: null,
  stripePaymentId: null,
  createdAt: new Date('2026-05-25T10:00:00.000Z'),
  items: [
    { id: 'item-001', productId: 'prod-001', variantId: null, quantity: 2, unitPrice: 75, unitCost: 50 },
    { id: 'item-002', productId: 'prod-002', variantId: null, quantity: 1, unitPrice: 100, unitCost: 0 },
  ],
  artworks: [],
  approvals: [],
  eventLogs: [],
  client: { id: 'client-001', name: 'Acme Corp', email: 'acme@corp.pt' },
  ...overrides,
});

const makeCreateOrderDto = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
  companyId: 'company-001',
  departmentId: 'dept-001',
  campaignId: undefined,
  shippingAddress: { street: 'Rua do Comércio 1', city: 'Lisboa', postalCode: '1000-001', country: 'PT' },
  pricingSnapshot: { supplierId: 'midocean', discountPct: 5 },
  items: [
    { productId: 'prod-001', variantId: null, quantity: 2, unitPrice: 75 },
  ],
  ...overrides,
} as CreateOrderDto);

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  eventLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockEvents = {
  on: jest.fn(),
  emit: jest.fn(),
};

const mockEventSourcing = {
  append: jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.eventLog.create.mockResolvedValue({});
    mockEventSourcing.append.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEvents },
        { provide: EventSourcingService, useValue: mockEventSourcing },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('generates a ref that starts with YGO-', async () => {
      const order = makeOrder();
      mockPrisma.order.create.mockResolvedValue(order);

      const result = await service.create('client-001', makeCreateOrderDto());

      const createCall = mockPrisma.order.create.mock.calls[0][0].data;
      expect(createCall.ref).toMatch(/^YGO-\d{8}-\d{4}$/);
    });

    it('creates the order with all provided items', async () => {
      const order = makeOrder();
      mockPrisma.order.create.mockResolvedValue(order);

      await service.create('client-001', makeCreateOrderDto());

      const createCall = mockPrisma.order.create.mock.calls[0][0].data;
      expect(createCall.items.create).toHaveLength(1);
      expect(createCall.items.create[0].productId).toBe('prod-001');
      expect(createCall.items.create[0].quantity).toBe(2);
      expect(createCall.items.create[0].unitPrice).toBe(75);
    });

    it('sets initial status to "created"', async () => {
      mockPrisma.order.create.mockResolvedValue(makeOrder());

      await service.create('client-001', makeCreateOrderDto());

      const createCall = mockPrisma.order.create.mock.calls[0][0].data;
      expect(createCall.status).toBe('created');
    });

    it('emits order.created event with the created order', async () => {
      const order = makeOrder();
      mockPrisma.order.create.mockResolvedValue(order);

      await service.create('client-001', makeCreateOrderDto());

      expect(mockEvents.emit).toHaveBeenCalledWith('order.created', order);
    });

    it('writes an event log entry for order.created', async () => {
      mockPrisma.order.create.mockResolvedValue(makeOrder());

      await service.create('client-001', makeCreateOrderDto());

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'order.created',
            actorId: 'client-001',
          }),
        }),
      );
    });

    it('appends to event sourcing stream', async () => {
      const order = makeOrder();
      mockPrisma.order.create.mockResolvedValue(order);

      await service.create('client-001', makeCreateOrderDto());

      expect(mockEventSourcing.append).toHaveBeenCalledWith(
        order.id,
        'order',
        'order.created',
        expect.objectContaining({ orderId: order.id, clientId: 'client-001' }),
        expect.any(Object),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all orders for a client when no filters are applied', async () => {
      const orders = [makeOrder(), makeOrder({ id: 'order-002', ref: 'YGO-20260525-5678' })];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findAll('client-001');

      expect(result).toHaveLength(2);
      const whereClause = mockPrisma.order.findMany.mock.calls[0][0].where;
      expect(whereClause.clientId).toBe('client-001');
    });

    it('filters orders by status when status filter is provided', async () => {
      mockPrisma.order.findMany.mockResolvedValue([makeOrder({ status: 'paid' })]);

      await service.findAll('client-001', { status: 'paid' });

      const whereClause = mockPrisma.order.findMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe('paid');
    });

    it('applies companyId filter when provided', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.findAll('client-001', { companyId: 'company-specific' });

      const whereClause = mockPrisma.order.findMany.mock.calls[0][0].where;
      expect(whereClause.companyId).toBe('company-specific');
    });
  });

  // ── updateStatus (transition) ─────────────────────────────────────────────

  describe('updateStatus', () => {
    it('succeeds on valid transition: created → paid', async () => {
      const existingOrder = makeOrder({ status: 'created' });
      const updatedOrder = makeOrder({ status: 'paid' });
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await service.updateStatus('order-abc-001', 'paid', 'admin-001');

      expect(result.status).toBe('paid');
    });

    it('succeeds on valid transition: paid → approved', async () => {
      const existingOrder = makeOrder({ status: 'paid' });
      const updatedOrder = makeOrder({ status: 'approved', approvedAt: new Date() });
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      await service.updateStatus('order-abc-001', 'approved', 'admin-001');

      const updateData = mockPrisma.order.update.mock.calls[0][0].data;
      expect(updateData.approvedAt).toBeInstanceOf(Date);
      expect(updateData.approvedById).toBe('admin-001');
    });

    it('throws BadRequestException on invalid transition: delivered → paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      await expect(
        service.updateStatus('order-abc-001', 'paid', 'admin-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on invalid transition: cancelled → approved', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await expect(
        service.updateStatus('order-abc-001', 'approved', 'admin-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'paid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('emits the correct domain event after transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'paid' }));
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'approved' }));

      await service.updateStatus('order-abc-001', 'approved', 'admin-001');

      expect(mockEvents.emit).toHaveBeenCalledWith('order.approved', expect.any(Object));
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('cancels an order in "created" status and emits order.cancelled', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'created' }));
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await service.cancelOrder('order-abc-001', 'Client requested cancellation', 'admin-001');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-abc-001' },
          data: { status: 'cancelled' },
        }),
      );
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({ reason: 'Client requested cancellation' }),
      );
    });

    it('throws BadRequestException when cancelling a delivered order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'delivered' }));

      await expect(
        service.cancelOrder('order-abc-001', 'Too late', 'admin-001'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when cancelling a non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelOrder('ghost-order', 'reason', 'admin-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('logs the cancellation reason in the event log', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: 'created' }));
      mockPrisma.order.update.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await service.cancelOrder('order-abc-001', 'Duplicate order', 'admin-001');

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'order.cancelled',
            payload: expect.objectContaining({ reason: 'Duplicate order' }),
          }),
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the order when found', async () => {
      const order = makeOrder();
      mockPrisma.order.findFirst.mockResolvedValue(order);

      const result = await service.findOne('order-abc-001');

      expect(result.id).toBe('order-abc-001');
    });

    it('throws NotFoundException when order is not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing-order')).rejects.toThrow(NotFoundException);
    });
  });
});
