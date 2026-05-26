import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateCompanyStoreDto } from './dto/create-company-store.dto';
import { UpdateCompanyStoreDto } from './dto/update-company-store.dto';
import { randomBytes } from 'crypto';

// ─── helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return randomBytes(3).toString('hex'); // e.g. "a3f9c2"
}

// ─── interfaces ───────────────────────────────────────────────────────────────

export interface StoreAnalytics {
  totalStores: number;
  activeStores: number;
  totalOrders: number;
  totalRevenue: number;
  topStore: { id: string; name: string; totalOrders: number; revenue: number } | null;
}

// ─── service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CompanyStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ── create ────────────────────────────────────────────────────────────────

  async create(dto: CreateCompanyStoreDto) {
    // Build a unique slug
    const base = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    let slug = base;

    const existing = await this.prisma.companyStore.findFirst({ where: { slug } });
    if (existing) {
      slug = `${base}-${randomSuffix()}`;
    }

    const store = await this.prisma.companyStore.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
        bannerUrl: dto.bannerUrl ?? null,
        welcomeMessage: dto.welcomeMessage ?? null,
        allowedEmails: dto.allowedEmails ?? [],
        monthlyBudget: dto.monthlyBudget ?? null,
        isActive: false,
      },
    });

    await this.logEvent('store', store.id, 'store.created', 'system', {
      companyId: dto.companyId,
      name: store.name,
      slug: store.slug,
    });

    this.events.emit('store.created', store);
    return store;
  }

  // ── public storefront ─────────────────────────────────────────────────────

  async findBySlug(slug: string) {
    const store = await this.prisma.companyStore.findFirst({
      where: { slug, isActive: true },
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
    });

    if (!store) throw new NotFoundException(`Store "${slug}" not found`);
    return store;
  }

  // ── list for company ──────────────────────────────────────────────────────

  async findForCompany(companyId: string) {
    return this.prisma.companyStore.findMany({
      where: { companyId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── admin detail ──────────────────────────────────────────────────────────

  async findOne(id: string) {
    const store = await this.prisma.companyStore.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              include: {
                variants: true,
              },
            },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!store) throw new NotFoundException(`Store ${id} not found`);
    return store;
  }

  // ── update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCompanyStoreDto) {
    await this.assertExists(id);

    const store = await this.prisma.companyStore.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
        ...(dto.welcomeMessage !== undefined && { welcomeMessage: dto.welcomeMessage }),
        ...(dto.allowedEmails !== undefined && { allowedEmails: dto.allowedEmails }),
        ...(dto.monthlyBudget !== undefined && { monthlyBudget: dto.monthlyBudget }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.logEvent('store', id, 'store.updated', 'system', JSON.parse(JSON.stringify({ changes: dto })) as Prisma.InputJsonValue);
    this.events.emit('store.updated', store);
    return store;
  }

  // ── add product ───────────────────────────────────────────────────────────

  async addProduct(
    storeId: string,
    productId: string,
    customPrice?: number,
    sortOrder?: number,
  ) {
    await this.assertExists(storeId);

    // Confirm product exists
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    // Check for duplicate
    const existing = await this.prisma.companyStoreProduct.findFirst({
      where: { storeId, productId },
    });
    if (existing) {
      throw new BadRequestException(
        `Product ${productId} is already in store ${storeId}`,
      );
    }

    // Determine next sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const last = await this.prisma.companyStoreProduct.findFirst({
        where: { storeId },
        orderBy: { sortOrder: 'desc' },
      });
      order = (last?.sortOrder ?? -1) + 1;
    }

    const storeProduct = await this.prisma.companyStoreProduct.create({
      data: {
        storeId,
        productId,
        customPrice: customPrice ?? null,
        isAvailable: true,
        sortOrder: order,
      },
      include: { product: true },
    });

    await this.logEvent('store', storeId, 'store.product_added', 'system', {
      productId,
      customPrice,
    });

    return storeProduct;
  }

  // ── remove product ────────────────────────────────────────────────────────

  async removeProduct(storeId: string, productId: string) {
    await this.assertExists(storeId);

    const storeProduct = await this.prisma.companyStoreProduct.findFirst({
      where: { storeId, productId },
    });
    if (!storeProduct) {
      throw new NotFoundException(
        `Product ${productId} is not in store ${storeId}`,
      );
    }

    await this.prisma.companyStoreProduct.delete({ where: { id: storeProduct.id } });

    await this.logEvent('store', storeId, 'store.product_removed', 'system', {
      productId,
    });
  }

  // ── get products ──────────────────────────────────────────────────────────

  async getProducts(storeId: string) {
    await this.assertExists(storeId);

    return this.prisma.companyStoreProduct.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        product: {
          include: {
            variants: { orderBy: { price: 'asc' } },
            _count: { select: { variants: true } },
          },
        },
      },
    });
  }

  // ── activate / deactivate ─────────────────────────────────────────────────

  async activate(id: string) {
    await this.assertExists(id);
    const store = await this.prisma.companyStore.update({
      where: { id },
      data: { isActive: true },
    });

    await this.logEvent('store', id, 'store.activated', 'system', {});
    this.events.emit('store.activated', store);
    return store;
  }

  async deactivate(id: string) {
    await this.assertExists(id);
    const store = await this.prisma.companyStore.update({
      where: { id },
      data: { isActive: false },
    });

    await this.logEvent('store', id, 'store.deactivated', 'system', {});
    this.events.emit('store.deactivated', store);
    return store;
  }

  // ── check access ──────────────────────────────────────────────────────────

  async checkAccess(storeId: string, email: string): Promise<boolean> {
    const store = await this.prisma.companyStore.findUnique({
      where: { id: storeId },
      select: { allowedEmails: true },
    });

    if (!store) throw new NotFoundException(`Store ${storeId} not found`);

    // Empty allowedEmails = open access
    if (!store.allowedEmails || store.allowedEmails.length === 0) return true;

    const emailLower = email.toLowerCase();
    const emailDomain = emailLower.split('@')[1] ?? '';

    return store.allowedEmails.some((pattern) => {
      const p = pattern.toLowerCase();
      // pattern can be a full email or a domain wildcard like "@acme.com" or "acme.com"
      if (p.startsWith('@')) {
        return emailLower.endsWith(p);
      }
      if (p.includes('@')) {
        return emailLower === p;
      }
      // bare domain
      return emailDomain === p;
    });
  }

  // ── analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(companyId: string): Promise<StoreAnalytics> {
    const stores = await this.prisma.companyStore.findMany({
      where: { companyId },
      include: { _count: { select: { products: true } } },
    });

    const totalStores = stores.length;
    const activeStores = stores.filter((s) => s.isActive).length;

    // Aggregate orders tied to this company's stores
    const orders = await this.prisma.order.findMany({
      where: { companyId },
      select: { id: true, totalAmount: true, campaignId: true },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);

    // We don't have a direct storeId on Order, so topStore is determined
    // by whichever store is most active (most products, first active)
    const topStoreRaw = stores
      .filter((s) => s.isActive)
      .sort((a, b) => b._count.products - a._count.products)[0] ?? null;

    const topStore = topStoreRaw
      ? {
          id: topStoreRaw.id,
          name: topStoreRaw.name,
          totalOrders,
          revenue: totalRevenue,
        }
      : null;

    return { totalStores, activeStores, totalOrders, totalRevenue, topStore };
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async assertExists(id: string): Promise<void> {
    const store = await this.prisma.companyStore.findUnique({ where: { id } });
    if (!store) throw new NotFoundException(`Store ${id} not found`);
  }

  private async logEvent(
    entity: string,
    entityId: string,
    event: string,
    actorId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        entity,
        entityId,
        event,
        actorId,
        actorType: 'system',
        payload,
        orderId: null,
      },
    });
  }
}
