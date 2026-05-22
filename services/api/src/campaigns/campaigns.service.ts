import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { generateOrderRef, MARGIN_RATE, VAT_RATE } from '@yourgift/shared';

export interface CampaignAnalytics {
  totalCampaigns: number;
  active: number;
  totalOrders: number;
  totalSpent: number;
  topCampaigns: Array<{
    id: string;
    name: string;
    type: string;
    totalOrders: number;
    totalSpent: number;
  }>;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async findAll(status?: string) {
    return this.prisma.campaign.findMany({
      where: status ? { status } : undefined,
      include: {
        items: { include: { product: true } },
        company: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: true } },
        company: { select: { id: true, name: true } },
      },
    });

    await this.logEvent('campaign', id, 'campaign.status_updated', 'system', 'system', {
      from: campaign.status,
      to: status,
    });

    this.events.emit('campaign.status_updated', updated);
    return updated;
  }

  async addItem(
    campaignId: string,
    dto: { productId: string; quantity: number; unitPrice?: number; notes?: string },
  ) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

    return this.prisma.campaignItem.create({
      data: {
        campaignId,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice ?? null,
        notes: dto.notes ?? null,
      },
      include: { product: true },
    });
  }

  async removeItem(campaignId: string, itemId: string) {
    const item = await this.prisma.campaignItem.findFirst({
      where: { id: itemId, campaignId },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found in campaign ${campaignId}`);

    await this.prisma.campaignItem.delete({ where: { id: itemId } });
    return { deleted: true, itemId };
  }

  async create(dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        type: dto.type,
        description: dto.description ?? null,
        status: 'draft',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget ?? null,
        totalOrders: 0,
        totalSpent: 0,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
            notes: item.notes ?? null,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        company: true,
      },
    });

    await this.logEvent('campaign', campaign.id, 'campaign.created', 'system', 'system', {
      companyId: dto.companyId,
      name: dto.name,
      type: dto.type,
      itemCount: campaign.items.length,
    });

    this.events.emit('campaign.created', campaign);
    return campaign;
  }

  async findForCompany(companyId: string) {
    return this.prisma.campaign.findMany({
      where: { companyId },
      include: {
        items: { include: { product: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        company: true,
        orders: {
          select: {
            id: true,
            ref: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async activate(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        `Campaign is in status "${campaign.status}", only draft campaigns can be activated`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'active' },
      include: { items: true },
    });

    await this.logEvent('campaign', id, 'campaign.activated', 'system', 'system', {
      name: campaign.name,
    });

    this.events.emit('campaign.activated', updated);
    return updated;
  }

  async createOrderFromCampaign(
    campaignId: string,
    clientId: string,
    shippingAddress: Record<string, unknown>,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        items: {
          include: {
            product: {
              include: { variants: { take: 1, orderBy: { stock: 'desc' } } },
            },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (campaign.status !== 'active') {
      throw new BadRequestException(
        `Campaign "${campaign.name}" is not active (status: "${campaign.status}")`,
      );
    }

    const orderRef = generateOrderRef();

    let totalAmount = 0;
    let marginAmount = 0;

    const orderItemsData = campaign.items.map((ci) => {
      const variant = ci.product.variants[0];
      if (!variant) {
        throw new BadRequestException(
          `Product "${ci.product.title}" has no available variant`,
        );
      }

      const basePrice = variant.price;
      // Use pre-set campaign price if available, otherwise calculate from base
      const unitPrice =
        ci.unitPrice ??
        parseFloat((basePrice * (1 + MARGIN_RATE) * (1 + VAT_RATE)).toFixed(2));
      const lineTotal = unitPrice * ci.quantity;
      const lineMargin = (unitPrice - basePrice) * ci.quantity;

      totalAmount += lineTotal;
      marginAmount += lineMargin;

      return {
        productId: ci.productId,
        variantId: variant.id,
        quantity: ci.quantity,
        unitCost: basePrice,
        unitPrice,
        printCost: 0,
      };
    });

    const pricingSnapshot = {
      source: 'campaign',
      campaignId,
      calculatedAt: new Date().toISOString(),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      marginAmount: parseFloat(marginAmount.toFixed(2)),
    };

    const order = await this.prisma.order.create({
      data: {
        ref: orderRef,
        clientId,
        companyId: campaign.companyId,
        campaignId,
        status: 'created',
        shippingAddress: JSON.parse(JSON.stringify(shippingAddress)) as Prisma.InputJsonValue,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        marginAmount: parseFloat(marginAmount.toFixed(2)),
        pricingSnapshot: JSON.parse(JSON.stringify(pricingSnapshot)) as Prisma.InputJsonValue,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Increment campaign counters
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: parseFloat(totalAmount.toFixed(2)) },
      },
    });

    await this.logEvent('campaign', campaignId, 'campaign.order_created', 'system', 'system', {
      orderId: order.id,
      orderRef: order.ref,
      totalAmount,
    });

    this.events.emit('campaign.order_created', { campaign, order });
    this.events.emit('order.created', order);

    return order;
  }

  async getAnalytics(companyId: string): Promise<CampaignAnalytics> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { companyId },
      include: { _count: { select: { orders: true } } },
      orderBy: { totalSpent: 'desc' },
    });

    const totalCampaigns = campaigns.length;
    const active = campaigns.filter((c) => c.status === 'active').length;
    const totalOrders = campaigns.reduce((s, c) => s + c.totalOrders, 0);
    const totalSpent = parseFloat(
      campaigns.reduce((s, c) => s + c.totalSpent, 0).toFixed(2),
    );

    const topCampaigns = campaigns.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
    }));

    return { totalCampaigns, active, totalOrders, totalSpent, topCampaigns };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async logEvent(
    entity: string,
    entityId: string,
    event: string,
    actorId: string,
    actorType: string,
    payload: Prisma.InputJsonValue,
  ) {
    await this.prisma.eventLog.create({
      data: { entity, entityId, event, actorId, actorType, payload, orderId: null },
    });
  }
}
