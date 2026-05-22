import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// ─── Response types ──────────────────────────────────────────────────────────

export interface BusinessInsights {
  totalRevenue: number;
  orderCount: number;
  topProducts: { productId: string; title: string; count: number }[];
  growthRate: number;
  insights: string[];
}

export interface Recommendations {
  recommendations: { productId: string; reason: string; confidence: number }[];
}

export interface CampaignInput {
  companyName: string;
  occasion: string;
  budget: number;
  employeeCount: number;
  preferences?: string;
}

export interface CampaignResult {
  campaignName: string;
  description: string;
  suggestedItems: { productType: string; quantity: number; estimatedCost: number }[];
  totalEstimate: number;
}

export interface SupplierScore {
  supplier: string;
  score: number;
  reliability: number;
  avgDelivery: number;
  issueRate: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Claude helper ────────────────────────────────────────────────────────

  private async callClaude(prompt: string): Promise<string | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return null;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        this.logger.warn(`Claude API returned ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        content: { type: string; text: string }[];
      };
      return data.content?.[0]?.text ?? null;
    } catch (err) {
      this.logger.warn(`Claude API call failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Method 1: Business Insights ─────────────────────────────────────────

  async getBusinessInsights(companyId?: string): Promise<BusinessInsights> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (companyId) where['companyId'] = companyId;

    const [orders, prevOrders] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: { include: { product: { select: { id: true, title: true } } } } },
      }),
      this.prisma.order.findMany({
        where: {
          ...where,
          createdAt: {
            gte: new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt: since,
          },
        },
      }),
    ]);

    const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);
    const prevRevenue = prevOrders.reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);
    const orderCount = orders.length;
    const growthRate = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Top products by order count
    const productMap = new Map<string, { title: string; count: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.productId;
        const entry = productMap.get(pid) ?? { title: item.product?.title ?? pid, count: 0 };
        entry.count += 1;
        productMap.set(pid, entry);
      }
    }
    const topProducts = [...productMap.entries()]
      .map(([productId, v]) => ({ productId, title: v.title, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // AI insights
    const fallbackInsights = [
      `Receita total nos últimos 30 dias: €${totalRevenue.toFixed(2)}`,
      `Total de ${orderCount} encomendas processadas no período`,
      growthRate >= 0
        ? `Crescimento de ${Math.abs(growthRate).toFixed(1)}% face ao mês anterior`
        : `Queda de ${Math.abs(growthRate).toFixed(1)}% face ao mês anterior`,
      topProducts[0]
        ? `Produto mais encomendado: ${topProducts[0].title}`
        : 'Sem dados de produtos disponíveis',
      'Oportunidade de upsell nos clientes com maior frequência de compra',
    ];

    const prompt = `És um assistente de business intelligence para uma plataforma B2B de produtos promocionais. Com base nestes dados: ${JSON.stringify({ totalRevenue, orderCount, growthRate, topProducts })}, fornece 5 insights de negócio concisos e acionáveis em português.`;

    let insights = fallbackInsights;
    const aiResponse = await this.callClaude(prompt);
    if (aiResponse) {
      // Parse numbered list from Claude's response
      const lines = aiResponse
        .split('\n')
        .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((l) => l.length > 20);
      if (lines.length >= 3) {
        insights = lines.slice(0, 5);
      }
    }

    return { totalRevenue, orderCount, topProducts, growthRate, insights };
  }

  // ─── Method 2: Recommendations ───────────────────────────────────────────

  async getRecommendations(clientId: string): Promise<Recommendations> {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      include: {
        items: {
          include: { product: { select: { id: true, title: true, category: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Collect purchased categories and products
    const purchasedProductIds = new Set<string>();
    const categoryCount = new Map<string, number>();

    for (const order of orders) {
      for (const item of order.items) {
        purchasedProductIds.add(item.productId);
        const cat = item.product?.category ?? 'uncategorised';
        categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
      }
    }

    // Find products in same categories not yet purchased
    const topCategories = [...categoryCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const candidateProducts = topCategories.length
      ? await this.prisma.product.findMany({
          where: {
            category: { in: topCategories },
            id: { notIn: [...purchasedProductIds] },
            active: true,
          },
          take: 10,
          select: { id: true, title: true, category: true },
        })
      : [];

    const recommendations = candidateProducts.slice(0, 5).map((p) => {
      const catFreq = categoryCount.get(p.category ?? '') ?? 0;
      const confidence = Math.min(0.95, 0.5 + catFreq * 0.1);
      return {
        productId: p.id,
        reason: `Baseado no histórico de compras na categoria "${p.category}"`,
        confidence: Math.round(confidence * 100) / 100,
      };
    });

    // If no candidates, return generic fallback
    if (recommendations.length === 0) {
      const popular = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      });
      const popularIds = popular.map((p) => p.productId).filter((id) => !purchasedProductIds.has(id));
      const popularProducts = popularIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: popularIds } },
            select: { id: true },
          })
        : [];
      return {
        recommendations: popularProducts.map((p) => ({
          productId: p.id,
          reason: 'Produto popular entre outros clientes',
          confidence: 0.5,
        })),
      };
    }

    return { recommendations };
  }

  // ─── Method 3: Campaign Generator ────────────────────────────────────────

  async generateCampaign(input: CampaignInput): Promise<CampaignResult> {
    const { companyName, occasion, budget, employeeCount, preferences } = input;
    const perPerson = employeeCount > 0 ? budget / employeeCount : budget;

    const fallback: CampaignResult = {
      campaignName: `Kit ${occasion} - ${companyName}`,
      description: `Kit de brindes corporativo personalizado para ${companyName} para a ocasião: ${occasion}.`,
      suggestedItems: [
        {
          productType: 'Caneta personalizadas',
          quantity: employeeCount,
          estimatedCost: Math.round(perPerson * 0.1 * 100) / 100,
        },
        {
          productType: 'Caderno A5',
          quantity: employeeCount,
          estimatedCost: Math.round(perPerson * 0.3 * 100) / 100,
        },
        {
          productType: 'Camisola / T-shirt',
          quantity: employeeCount,
          estimatedCost: Math.round(perPerson * 0.4 * 100) / 100,
        },
        {
          productType: 'Copo térmico',
          quantity: employeeCount,
          estimatedCost: Math.round(perPerson * 0.2 * 100) / 100,
        },
      ],
      totalEstimate: budget,
    };

    const prompt = `Cria um kit de brindes corporativo para ${companyName}. Ocasião: ${occasion}. Orçamento total: €${budget}. Número de colaboradores: ${employeeCount}. Preferências: ${preferences ?? 'nenhuma'}. Responde em JSON com os campos: campaignName, description, suggestedItems (array de {productType, quantity, estimatedCost}), totalEstimate.`;

    const aiResponse = await this.callClaude(prompt);
    if (!aiResponse) return fallback;

    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      const parsed = JSON.parse(jsonMatch[0]) as CampaignResult;
      if (parsed.campaignName && parsed.suggestedItems) return parsed;
    } catch {
      // ignore parse errors
    }

    return fallback;
  }

  // ─── Method 4: Supplier Scores ────────────────────────────────────────────

  async getSupplierScores(): Promise<SupplierScore[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = this.prisma as any;
    const [orders, syncLogs] = await Promise.all([
      this.prisma.order.findMany({
        where: { supplier: { not: null } },
        select: {
          supplier: true,
          totalAmount: true,
          shippedAt: true,
          deliveredAt: true,
          createdAt: true,
          status: true,
        },
      }),
      prismaAny.supplierSyncLog
        ? (prismaAny.supplierSyncLog.findMany({
            select: { supplier: true, status: true },
            orderBy: { syncedAt: 'desc' },
            take: 500,
          }) as Promise<{ supplier: string; status: string }[]>)
        : Promise.resolve([] as { supplier: string; status: string }[]),
    ]);

    const supplierMap = new Map<
      string,
      {
        orderCount: number;
        revenue: number;
        deliveryDaysTotal: number;
        deliveredCount: number;
        onTimeCount: number;
        syncTotal: number;
        syncErrors: number;
      }
    >();

    for (const o of orders) {
      const key = o.supplier as string;
      const entry = supplierMap.get(key) ?? {
        orderCount: 0,
        revenue: 0,
        deliveryDaysTotal: 0,
        deliveredCount: 0,
        onTimeCount: 0,
        syncTotal: 0,
        syncErrors: 0,
      };
      entry.orderCount += 1;
      entry.revenue += o.totalAmount ?? 0;

      if (o.shippedAt && o.deliveredAt) {
        const days =
          (o.deliveredAt.getTime() - o.shippedAt.getTime()) / (1000 * 60 * 60 * 24);
        entry.deliveryDaysTotal += days;
        entry.deliveredCount += 1;
        if (days <= 7) entry.onTimeCount += 1;
      }

      supplierMap.set(key, entry);
    }

    // Add sync log data
    for (const log of syncLogs) {
      const key = log.supplier;
      const entry = supplierMap.get(key);
      if (!entry) continue;
      entry.syncTotal += 1;
      if (log.status === 'error') entry.syncErrors += 1;
    }

    return [...supplierMap.entries()].map(([supplier, v]) => {
      const avgDelivery =
        v.deliveredCount > 0
          ? Math.round((v.deliveryDaysTotal / v.deliveredCount) * 10) / 10
          : 0;
      const reliability =
        v.deliveredCount > 0
          ? Math.round((v.onTimeCount / v.deliveredCount) * 1000) / 10
          : 100;
      const issueRate =
        v.syncTotal > 0
          ? Math.round((v.syncErrors / v.syncTotal) * 1000) / 10
          : 0;

      // Score formula: reliability weight 50% + delivery speed 30% + sync health 20%
      const deliveryScore = avgDelivery > 0 ? Math.max(0, 100 - avgDelivery * 5) : 80;
      const syncScore = 100 - issueRate;
      const score = Math.round(
        reliability * 0.5 + deliveryScore * 0.3 + syncScore * 0.2,
      );

      return { supplier, score: Math.min(100, score), reliability, avgDelivery, issueRate };
    });
  }
}
