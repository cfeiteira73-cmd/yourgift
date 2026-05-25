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
  WorkflowCost,
} from './cost-intelligence.service';

@Controller('admin/cost-intelligence')
@UseGuards(AdminAuthGuard)
export class CostIntelligenceController {
  constructor(private readonly costIntelligence: CostIntelligenceService) {}

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
