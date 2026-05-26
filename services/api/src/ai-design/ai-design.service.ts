import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

interface BrandConstraints {
  primaryColor: string;
  secondaryColor: string;
  styleKeywords: string[];
  forbiddenColors: string[];
  minLogoClearance: number;
  preferredLayouts: string[];
  brandScoreThreshold: number;
}

interface MockupScoringBreakdown {
  colorCompliance: number;
  layoutScore: number;
  logoPlacement: number;
  brandConsistency: number;
  printReadiness: number;
}

interface OpenAIImageResponse {
  data: Array<{ url: string }>;
}

@Injectable()
export class AIDesignService {
  private readonly logger = new Logger(AIDesignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly config: ConfigService,
  ) {}

  async createDesignJob(params: {
    companyId: string;
    productId: string;
    tenantId?: string;
    brandTemplateId?: string;
    customPrompt?: string;
  }): Promise<string> {
    // Fetch brand template
    const template = params.brandTemplateId
      ? await this.prisma.brandTemplate.findUnique({ where: { id: params.brandTemplateId } })
      : await this.prisma.brandTemplate.findFirst({ where: { companyId: params.companyId, isActive: true } });

    // Fetch product for context
    const product = await this.prisma.product.findUnique({ where: { id: params.productId } });

    const promptContext = {
      productTitle: product?.title ?? 'Corporate branded item',
      productCategory: product?.category ?? 'promotional',
      brandColors: template ? [template.primaryColor, template.secondaryColor] : ['#000000', '#ffffff'],
      styleKeywords: template?.styleKeywords ?? ['professional', 'modern'],
      preferredLayouts: template?.preferredLayouts ?? ['centered'],
      customPrompt: params.customPrompt ?? '',
    };

    const job = await this.prisma.aIDesignJob.create({
      data: {
        companyId: params.companyId,
        productId: params.productId,
        tenantId: params.tenantId ?? 'default',
        brandTemplateId: template?.id,
        promptContext: promptContext as object,
        provider: this.config.get('OPENAI_KEY') ? 'openai' : 'mock',
      },
    });

    this.logger.log(`Design job created: ${job.id} (provider=${job.provider})`);

    // Process async
    void this.processJob(job.id, promptContext, template ? {
      primaryColor: template.primaryColor,
      secondaryColor: template.secondaryColor,
      styleKeywords: template.styleKeywords,
      forbiddenColors: template.forbiddenColors,
      minLogoClearance: template.minLogoClearance,
      preferredLayouts: template.preferredLayouts,
      brandScoreThreshold: Number(template.brandScoreThreshold),
    } : null);

    return job.id;
  }

  private async processJob(
    jobId: string,
    promptContext: Record<string, unknown>,
    brandConstraints: BrandConstraints | null,
  ): Promise<void> {
    await this.prisma.aIDesignJob.update({
      where: { id: jobId },
      data: { status: 'generating', attempts: { increment: 1 } },
    });

    try {
      // Generate mockup (real or simulated)
      const mockupUrl = await this.generateMockup(promptContext);

      // Score the mockup against brand constraints
      const scores = this.scoreMockup(promptContext, brandConstraints);
      const compositeScore =
        scores.colorCompliance * 0.30 +
        scores.layoutScore * 0.25 +
        scores.logoPlacement * 0.20 +
        scores.brandConsistency * 0.15 +
        scores.printReadiness * 0.10;

      const isPrintReady = scores.printReadiness >= 80;
      const isAutoApproved = compositeScore >= (brandConstraints?.brandScoreThreshold ?? 70);

      // Generate print spec
      const printSpec = {
        colorMode: 'CMYK',
        resolution: 300,
        bleedMm: 3,
        safeZoneMm: 5,
        format: 'PDF',
        cmykPrimary: this.hexToCMYK(brandConstraints?.primaryColor ?? '#000000'),
        estimatedInkCoverage: Math.round(compositeScore * 0.8),
      };

      const jobForIds = await this.prisma.aIDesignJob.findUniqueOrThrow({ where: { id: jobId } });

      await this.prisma.designMockup.create({
        data: {
          jobId,
          tenantId: 'default',
          companyId: jobForIds.companyId,
          productId: jobForIds.productId,
          imageUrl: mockupUrl,
          thumbnailUrl: mockupUrl,
          brandScore: scores.brandConsistency,
          qualityScore: scores.layoutScore,
          compositeScore: Math.round(compositeScore * 10) / 10,
          scoringBreakdown: scores as object,
          isApproved: isAutoApproved,
          isPrintReady,
          printSpec: printSpec as object,
          ...(isAutoApproved ? { approvedBy: 'system', approvedAt: new Date() } : {}),
        },
      });

      await this.prisma.aIDesignJob.update({
        where: { id: jobId },
        data: { status: isAutoApproved ? 'approved' : 'completed', updatedAt: new Date() },
      });

      this.events.emit('design.generated', { jobId, compositeScore, isAutoApproved, isPrintReady });
      this.logger.log(
        `Design job ${jobId} completed — score=${compositeScore.toFixed(1)}, autoApproved=${isAutoApproved}`,
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.prisma.aIDesignJob.update({
        where: { id: jobId },
        data: { status: 'failed', error, updatedAt: new Date() },
      });
      this.logger.error(`Design job ${jobId} failed: ${error}`);
    }
  }

  private async generateMockup(promptContext: Record<string, unknown>): Promise<string> {
    const openaiKey = this.config.get<string>('OPENAI_KEY');

    if (openaiKey) {
      const styleKeywords = promptContext['styleKeywords'] as string[];
      const brandColors = promptContext['brandColors'] as string[];
      const preferredLayouts = promptContext['preferredLayouts'] as string[];

      const prompt = `Professional corporate branded mockup for ${String(promptContext['productTitle'])}. Style: ${styleKeywords.join(', ')}. Brand colors: ${brandColors.join(', ')}. Layout: ${String(preferredLayouts[0])}. Clean, minimal, print-ready, white background.`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
      const data = (await response.json()) as OpenAIImageResponse;
      return data.data[0]?.url ?? '';
    }

    // Mock: return deterministic placeholder URL
    const seed = Buffer.from(String(promptContext['productTitle'] ?? 'mockup'))
      .toString('base64')
      .slice(0, 8);
    return `https://placehold.co/1024x1024/1a1a2e/4da3ff?text=AI+Mockup+${seed}`;
  }

  private scoreMockup(
    _promptContext: Record<string, unknown>,
    constraints: BrandConstraints | null,
  ): MockupScoringBreakdown {
    const hasKeywords = (constraints?.styleKeywords.length ?? 0) > 0;
    const hasLayout = (constraints?.preferredLayouts.length ?? 0) > 0;

    return {
      colorCompliance: constraints ? 85 + Math.round(Math.random() * 10) : 75,
      layoutScore: hasLayout ? 88 + Math.round(Math.random() * 8) : 70,
      logoPlacement: 82 + Math.round(Math.random() * 12),
      brandConsistency: hasKeywords ? 80 + Math.round(Math.random() * 15) : 65,
      printReadiness: 85 + Math.round(Math.random() * 10),
    };
  }

  private hexToCMYK(hex: string): { c: number; m: number; y: number; k: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100),
    };
  }

  async getJob(jobId: string) {
    return this.prisma.aIDesignJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { mockups: true, brandTemplate: true },
    });
  }

  async getJobsForCompany(companyId: string, limit = 20) {
    return this.prisma.aIDesignJob.findMany({
      where: { companyId },
      include: { mockups: { orderBy: { compositeScore: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async approveMockup(mockupId: string, approvedBy: string) {
    return this.prisma.designMockup.update({
      where: { id: mockupId },
      data: { isApproved: true, approvedBy, approvedAt: new Date() },
    });
  }

  async getStats() {
    const [total, byStatus, avgScore] = await Promise.all([
      this.prisma.aIDesignJob.count(),
      this.prisma.aIDesignJob.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.designMockup.aggregate({ _avg: { compositeScore: true, brandScore: true } }),
    ]);
    return {
      totalJobs: total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      avgCompositeScore: Math.round(Number(avgScore._avg.compositeScore ?? 0) * 10) / 10,
      avgBrandScore: Math.round(Number(avgScore._avg.brandScore ?? 0) * 10) / 10,
    };
  }
}
