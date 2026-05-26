import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { AIDesignService } from './ai-design.service';

export interface ZeroFrictionResult {
  designJobId: string;
  pricingEstimate: { basePrice: number; margin: number; total: number };
  recommendedSupplier: string | null;
  requiresHumanApproval: boolean;
  approvalReason: string | null;
  procurementRef: string;
}

@Injectable()
export class ZeroFrictionService {
  private readonly logger = new Logger(ZeroFrictionService.name);
  private readonly HIGH_VALUE_THRESHOLD = 5000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly design: AIDesignService,
  ) {}

  /**
   * 1-click procurement pipeline:
   * product → AI mockup → pricing → supplier routing → (optional) order
   */
  async execute(params: {
    companyId: string;
    productId: string;
    quantity: number;
    tenantId?: string;
    brandTemplateId?: string;
    autoSubmit?: boolean;
  }): Promise<ZeroFrictionResult> {
    const ref = `ZF-${Date.now().toString(36).toUpperCase()}`;
    this.logger.log(`Zero-friction procurement started: ${ref}`);

    // 1. Fetch product pricing
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: params.productId } });
    const basePrice = Number(product.basePrice ?? 0) * params.quantity;
    const margin = basePrice * 0.35;
    const total = basePrice + margin;

    // 2. AI mockup (async — don't block pipeline)
    const designJobId = await this.design.createDesignJob({
      companyId: params.companyId,
      productId: params.productId,
      tenantId: params.tenantId,
      brandTemplateId: params.brandTemplateId,
    });

    // 3. Supplier routing
    const supplier = await this.prisma.supplierRoutingMatrix.findFirst({
      where: { category: product.category ?? 'promotional', isActive: true },
      orderBy: [{ reliabilityScore: 'desc' }, { priceScore: 'desc' }],
    });

    // 4. Approval logic
    const requiresHumanApproval = total > this.HIGH_VALUE_THRESHOLD;
    const approvalReason = requiresHumanApproval
      ? `Order value €${total.toFixed(2)} exceeds €${this.HIGH_VALUE_THRESHOLD} threshold`
      : null;

    const result: ZeroFrictionResult = {
      designJobId,
      pricingEstimate: {
        basePrice: Math.round(basePrice * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        total: Math.round(total * 100) / 100,
      },
      recommendedSupplier: supplier?.supplierName ?? null,
      requiresHumanApproval,
      approvalReason,
      procurementRef: ref,
    };

    // 5. Emit pipeline event for downstream automation
    this.events.emit('procurement.zero_friction.initiated', {
      ref,
      companyId: params.companyId,
      productId: params.productId,
      quantity: params.quantity,
      total,
      designJobId,
      requiresHumanApproval,
    });

    this.logger.log(
      `Zero-friction pipeline complete: ${ref} — total=€${total.toFixed(2)}, supplier=${supplier?.supplierName ?? 'none'}, humanApproval=${requiresHumanApproval}`,
    );
    return result;
  }

  async getPipelineStats() {
    const [jobs, approved, autoApproved] = await Promise.all([
      this.prisma.aIDesignJob.count(),
      this.prisma.designMockup.count({ where: { isApproved: true } }),
      this.prisma.designMockup.count({ where: { isApproved: true, approvedBy: 'system' } }),
    ]);
    return {
      totalDesignJobs: jobs,
      approvedMockups: approved,
      autoApprovedMockups: autoApproved,
      autoApprovalRate: approved > 0 ? Math.round((autoApproved / approved) * 100) : 0,
    };
  }
}
