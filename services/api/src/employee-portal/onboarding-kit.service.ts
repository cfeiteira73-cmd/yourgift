import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EmployeeWalletService } from './employee-wallet.service';
import { OnboardingKit, KitDeployment } from '@prisma/client';

@Injectable()
export class OnboardingKitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly wallet: EmployeeWalletService,
  ) {}

  async createKit(params: {
    tenantId: string;
    name: string;
    description?: string;
    department?: string;
    currency?: string;
    items: Array<{
      productId?: string;
      variantId?: string;
      quantity: number;
      name: string;
      price: number;
    }>;
  }): Promise<OnboardingKit> {
    const totalValue = params.items.reduce(
      (s, item) => s + item.price * item.quantity,
      0,
    );

    return this.prisma.onboardingKit.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        description: params.description ?? null,
        department: params.department ?? null,
        currency: params.currency ?? 'EUR',
        totalValue,
        items: params.items as object,
      },
    });
  }

  async deployKit(params: {
    kitId: string;
    walletId: string;
    employeeEmail: string;
    employeeName: string;
    shippingAddress: Record<string, unknown>;
  }): Promise<KitDeployment> {
    const kit = await this.prisma.onboardingKit.findUniqueOrThrow({
      where: { id: params.kitId },
    });

    const kitValue = Number(kit.totalValue);

    await this.wallet.spend(
      params.walletId,
      kitValue,
      `Onboarding kit: ${kit.name}`,
      params.kitId,
      'kit_deployment',
    );

    const deployment = await this.prisma.kitDeployment.create({
      data: {
        kitId: params.kitId,
        walletId: params.walletId,
        tenantId: kit.tenantId,
        employeeEmail: params.employeeEmail,
        employeeName: params.employeeName,
        shippingAddress: params.shippingAddress as object,
        totalCost: kitValue,
        status: 'pending',
      },
    });

    this.events.emit('onboarding.kit.deployed', {
      deploymentId: deployment.id,
      kitId: params.kitId,
      walletId: params.walletId,
      employeeEmail: params.employeeEmail,
    });

    return deployment;
  }

  async getKits(tenantId: string): Promise<OnboardingKit[]> {
    return this.prisma.onboardingKit.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeployments(tenantId: string, status?: string): Promise<KitDeployment[]> {
    return this.prisma.kitDeployment.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getKitStats(tenantId: string): Promise<{
    totalKits: number;
    totalDeployments: number;
    activeDeployments: number;
    totalValueDeployed: number;
  }> {
    const [kits, deployments] = await Promise.all([
      this.prisma.onboardingKit.count({ where: { tenantId, isActive: true } }),
      this.prisma.kitDeployment.findMany({ where: { tenantId } }),
    ]);

    const activeDeployments = deployments.filter(
      (d) => d.status !== 'delivered' && d.status !== 'cancelled',
    ).length;

    const totalValueDeployed = deployments.reduce(
      (s, d) => s + Number(d.totalCost),
      0,
    );

    return {
      totalKits: kits,
      totalDeployments: deployments.length,
      activeDeployments,
      totalValueDeployed,
    };
  }
}
