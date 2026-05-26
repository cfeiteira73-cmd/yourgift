import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  CostIntelligenceService,
  CostAnomaly,
  TenantCostSummary,
} from './cost-intelligence.service';
import { AiEconomicsService, AiEconomicsSummary } from './ai-economics.service';
import { InfraCostOptimizerService, WasteReport } from './infra-cost-optimizer.service';

@Controller('admin/cost-intelligence')
@UseGuards(AdminAuthGuard)
export class CostIntelligenceController {
  constructor(
    private readonly costIntelligence: CostIntelligenceService,
    private readonly aiEconomics: AiEconomicsService,
    private readonly infraOptimizer: InfraCostOptimizerService,
  ) {}

  // ── Legacy dashboard ──────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(): {
    totalWorkflows: number;
    totalCostEur: number;
    totalRevenueEur: number;
    avgMarginPct: number;
    topCostTenants: Array<{ tenantId: string; costEur: number }>;
    anomalyCount: number;
  } {
    return this.costIntelligence.getGlobalCostDashboard();
  }

  // ── Global real-time dashboard (FINANCIAL_COST_REALITY_REPORT §6) ─────────

  @Get('global-dashboard')
  async getGlobalDashboard(): Promise<{
    generatedAt: string;
    totalInfraCostEur: number;
    totalRevenueTodayEur: number;
    marginPct: number;
    topCostTenants: Array<{ tenantId: string; avgCostPerRequest: number; requestCount: number }>;
    anomalies: CostAnomaly[];
    aiCostTodayEur: number;
    queueCostTodayEur: number;
  }> {
    const [noisyTenants, anomalies, aiDashboard] = await Promise.all([
      this.infraOptimizer.detectNoisyTenants(24),
      Promise.resolve(this.costIntelligence.detectAnomalies()),
      this.aiEconomics.getGlobalAiCostDashboard(
        new Date(Date.now() - 86_400_000),
        new Date(),
      ),
    ]);
    const base = this.costIntelligence.getGlobalCostDashboard();
    return {
      generatedAt: new Date().toISOString(),
      totalInfraCostEur: 45.0, // amortised daily infra cost
      totalRevenueTodayEur: base.totalRevenueEur,
      marginPct: base.avgMarginPct,
      topCostTenants: noisyTenants.map((t) => ({
        tenantId: t.tenantId,
        avgCostPerRequest: t.avgCostPerRequest,
        requestCount: t.requestCount,
      })),
      anomalies,
      aiCostTodayEur: aiDashboard.totalCostEur,
      queueCostTodayEur: 0, // populated from EventLog queue.* events post-traffic
    };
  }

  // ── AI Economics ──────────────────────────────────────────────────────────

  @Get('ai-economics/summary')
  async getAiEconomicsSummary(
    @Query('tenantId') tenantId: string,
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
  ): Promise<AiEconomicsSummary> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86_400_000);
    const to = toStr ? new Date(toStr) : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be valid ISO date strings');
    }
    return this.aiEconomics.getEconomicsSummary(tenantId, from, to);
  }

  @Get('ai-economics/global')
  async getAiEconomicsGlobal(
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
  ): Promise<{ totalCostEur: number; totalDecisions: number; avgRoiMultiplier: number }> {
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86_400_000);
    const to = toStr ? new Date(toStr) : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be valid ISO date strings');
    }
    return this.aiEconomics.getGlobalAiCostDashboard(from, to);
  }

  // ── Noisy tenants ─────────────────────────────────────────────────────────

  @Get('noisy-tenants')
  async getNoisyTenants(
    @Query('windowHours') windowHoursStr?: string,
  ): Promise<WasteReport['noisyTenants']> {
    const windowHours = windowHoursStr ? parseInt(windowHoursStr, 10) : 24;
    if (isNaN(windowHours) || windowHours < 1) {
      throw new BadRequestException('windowHours must be a positive integer');
    }
    return this.infraOptimizer.detectNoisyTenants(windowHours);
  }

  // ── Tenant cost summary ───────────────────────────────────────────────────

  @Get('tenant/:tenantId')
  async getTenantSummary(
    @Param('tenantId') tenantId: string,
    @Query('fromDate') fromDateStr: string,
    @Query('toDate') toDateStr: string,
  ): Promise<TenantCostSummary> {
    if (!fromDateStr || !toDateStr) {
      throw new BadRequestException('fromDate and toDate query params are required');
    }
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('fromDate and toDate must be valid ISO date strings');
    }
    return this.costIntelligence.getTenantCostSummary(tenantId, fromDate, toDate);
  }

  @Get('anomalies')
  getAnomalies(@Query('limit') limitStr?: string): CostAnomaly[] {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    if (isNaN(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.costIntelligence.getRecentAnomalies(limit);
  }

  @Post('detect')
  detectAnomalies(): CostAnomaly[] {
    return this.costIntelligence.detectAnomalies();
  }
}
