import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

// ─── interfaces ───────────────────────────────────────────────────────────────

export interface PortalData {
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    allowance: number;
    spent: number;
    isActive: boolean;
    lastLoginAt: Date | null;
  };
  store: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    bannerUrl: string | null;
    welcomeMessage: string | null;
  };
  remainingAllowance: number;
  products: Array<{
    id: string;
    customPrice: number | null;
    sortOrder: number;
    product: {
      id: string;
      title: string;
      description: string;
      images: string[];
      basePrice: number;
      variants: Array<{
        id: string;
        sku: string;
        color: string | null;
        size: string | null;
        price: number;
        stock: number;
      }>;
    };
  }>;
}

// ─── service ─────────────────────────────────────────────────────────────────

@Injectable()
export class StorePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── employee login ────────────────────────────────────────────────────────

  async employeeLogin(slug: string, email: string): Promise<{ access_token: string }> {
    const store = await this.prisma.companyStore.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        allowedEmails: true,
      },
    });

    if (!store) {
      throw new NotFoundException(`Loja "${slug}" não encontrada`);
    }

    const emailLower = email.toLowerCase();

    // Check if an explicit StoreEmployee record exists and is active
    let employee = await this.prisma.storeEmployee.findUnique({
      where: { storeId_email: { storeId: store.id, email: emailLower } },
    });

    if (employee && !employee.isActive) {
      throw new UnauthorizedException('Acesso não autorizado');
    }

    // If no employee record, check domain/email whitelist on the store
    if (!employee) {
      const allowed = this.checkEmailAllowed(emailLower, store.allowedEmails);
      if (!allowed) {
        throw new UnauthorizedException('Acesso não autorizado');
      }

      // Auto-provision the employee with zero allowance
      employee = await this.prisma.storeEmployee.create({
        data: {
          storeId: store.id,
          email: emailLower,
          name: emailLower.split('@')[0] ?? emailLower,
          isActive: true,
          allowance: 0,
          spent: 0,
        },
      });
    }

    // Update lastLoginAt
    await this.prisma.storeEmployee.update({
      where: { id: employee.id },
      data: { lastLoginAt: new Date() },
    });

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const payload = {
      sub: employee.id,
      email: employee.email,
      name: employee.name,
      storeId: store.id,
      slug: store.slug,
      type: 'store_employee' as const,
    };

    const access_token = this.jwt.sign(payload, { secret, expiresIn: '8h' });
    return { access_token };
  }

  // ── portal data ───────────────────────────────────────────────────────────

  async getPortalData(employeeId: string, slug: string): Promise<PortalData> {
    const employee = await this.prisma.storeEmployee.findUnique({
      where: { id: employeeId },
      include: {
        store: {
          include: {
            products: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                product: {
                  include: {
                    variants: { orderBy: { price: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (!employee.isActive) throw new ForbiddenException('Conta inativa');
    if (employee.store.slug !== slug) throw new ForbiddenException('Acesso não autorizado');

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        allowance: employee.allowance,
        spent: employee.spent,
        isActive: employee.isActive,
        lastLoginAt: employee.lastLoginAt,
      },
      store: {
        id: employee.store.id,
        name: employee.store.name,
        slug: employee.store.slug,
        logoUrl: employee.store.logoUrl,
        primaryColor: employee.store.primaryColor,
        secondaryColor: employee.store.secondaryColor,
        bannerUrl: employee.store.bannerUrl,
        welcomeMessage: employee.store.welcomeMessage,
      },
      remainingAllowance: Math.max(0, employee.allowance - employee.spent),
      products: employee.store.products.map((sp) => ({
        id: sp.id,
        customPrice: sp.customPrice,
        sortOrder: sp.sortOrder,
        product: {
          id: sp.product.id,
          title: sp.product.title,
          description: sp.product.description,
          images: sp.product.images,
          basePrice: sp.product.basePrice,
          variants: sp.product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            size: v.size,
            price: v.price,
            stock: v.stock,
          })),
        },
      })),
    };
  }

  // ── place order ───────────────────────────────────────────────────────────

  async placeOrder(employeeId: string, slug: string, dto: PlaceOrderDto) {
    const employee = await this.prisma.storeEmployee.findUnique({
      where: { id: employeeId },
      include: { store: { select: { id: true, slug: true } } },
    });

    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (!employee.isActive) throw new ForbiddenException('Conta inativa');
    if (employee.store.slug !== slug) throw new ForbiddenException('Acesso não autorizado');

    // Find product in the store
    const storeProduct = await this.prisma.companyStoreProduct.findFirst({
      where: { storeId: employee.storeId, productId: dto.productId, isAvailable: true },
      include: { product: true },
    });

    if (!storeProduct) {
      throw new NotFoundException('Produto não disponível nesta loja');
    }

    // Determine unit price
    let unitPrice: number;
    if (storeProduct.customPrice != null) {
      unitPrice = storeProduct.customPrice;
    } else if (dto.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.variantId, productId: dto.productId },
      });
      unitPrice = variant?.price ?? storeProduct.product.basePrice;
    } else {
      unitPrice = storeProduct.product.basePrice;
    }

    const totalAmount = unitPrice * dto.quantity;
    const remaining = employee.allowance - employee.spent;

    if (employee.allowance > 0 && totalAmount > remaining) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível: €${remaining.toFixed(2)}, Encomenda: €${totalAmount.toFixed(2)}`,
      );
    }

    // Create order and deduct spent in a transaction
    const [order] = await this.prisma.$transaction([
      this.prisma.employeeOrder.create({
        data: {
          employeeId,
          storeId: employee.storeId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          quantity: dto.quantity,
          totalAmount,
          status: 'pending',
          notes: dto.notes ?? null,
        },
      }),
      this.prisma.storeEmployee.update({
        where: { id: employeeId },
        data: { spent: { increment: totalAmount } },
      }),
    ]);

    this.events.emit('employee_order.created', {
      orderId: order.id,
      employeeId,
      storeId: employee.storeId,
      productId: dto.productId,
      totalAmount,
    });

    return order;
  }

  // ── order history ─────────────────────────────────────────────────────────

  async getOrders(employeeId: string, slug: string) {
    const employee = await this.prisma.storeEmployee.findUnique({
      where: { id: employeeId },
      include: { store: { select: { slug: true } } },
    });

    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (employee.store.slug !== slug) throw new ForbiddenException('Acesso não autorizado');

    return this.prisma.employeeOrder.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── admin: list employees ─────────────────────────────────────────────────

  async listEmployees(slug: string) {
    const store = await this.assertStoreBySlug(slug);

    return this.prisma.storeEmployee.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── admin: create employee ────────────────────────────────────────────────

  async createEmployee(slug: string, dto: CreateEmployeeDto) {
    const store = await this.assertStoreBySlug(slug);
    const emailLower = dto.email.toLowerCase();

    const existing = await this.prisma.storeEmployee.findUnique({
      where: { storeId_email: { storeId: store.id, email: emailLower } },
    });
    if (existing) {
      throw new BadRequestException(`Colaborador com email ${emailLower} já existe nesta loja`);
    }

    return this.prisma.storeEmployee.create({
      data: {
        storeId: store.id,
        email: emailLower,
        name: dto.name,
        department: dto.department ?? null,
        allowance: dto.allowance ?? 0,
        spent: 0,
        isActive: true,
      },
    });
  }

  // ── admin: update employee ────────────────────────────────────────────────

  async updateEmployee(slug: string, employeeId: string, dto: UpdateEmployeeDto) {
    const store = await this.assertStoreBySlug(slug);

    const employee = await this.prisma.storeEmployee.findUnique({
      where: { id: employeeId },
    });
    if (!employee || employee.storeId !== store.id) {
      throw new NotFoundException('Colaborador não encontrado');
    }

    return this.prisma.storeEmployee.update({
      where: { id: employeeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.allowance !== undefined && { allowance: dto.allowance }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async assertStoreBySlug(slug: string) {
    const store = await this.prisma.companyStore.findFirst({ where: { slug } });
    if (!store) throw new NotFoundException(`Loja "${slug}" não encontrada`);
    return store;
  }

  private checkEmailAllowed(email: string, allowedEmails: string[]): boolean {
    if (!allowedEmails || allowedEmails.length === 0) return true;

    const emailDomain = email.split('@')[1] ?? '';

    return allowedEmails.some((pattern) => {
      const p = pattern.toLowerCase();
      if (p.startsWith('@')) return email.endsWith(p);
      if (p.includes('@')) return email === p;
      return emailDomain === p;
    });
  }
}
