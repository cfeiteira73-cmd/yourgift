import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccrualService } from './accrual.service';
import { CostAllocationService } from './cost-allocation.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';

@Controller('financial-intelligence')
@UseGuards(JwtAuthGuard)
export class FinancialIntelligenceController {
  constructor(
    private readonly accrual: AccrualService,
    private readonly costAlloc: CostAllocationService,
    private readonly intelligence: FinancialIntelligenceService,
  ) {}

  @Get('deferred-revenue')
  deferredRevenue(@Query('tenantId') tenantId?: string) {
    return this.accrual.getDeferredRevenueSummary(tenantId);
  }

  @Get('accrued-expenses')
  accruedExpenses(@Query('tenantId') tenantId?: string) {
    return this.accrual.getAccruedExpensesSummary(tenantId);
  }

  @Get('recognition-schedule')
  recognitionSchedule(@Query('from') from: string, @Query('to') to: string) {
    return this.accrual.getRevenueRecognitionSchedule(new Date(from), new Date(to));
  }

  @Get('client/:id/margin')
  clientMargin(@Param('id') id: string) {
    return this.intelligence.getClientMargin(id);
  }

  @Get('tenant/:id/ltv')
  ltv(@Param('id') id: string) {
    return this.intelligence.computeLTV(id);
  }

  @Get('tenant/:id/cac-payback')
  cacPayback(@Param('id') id: string, @Query('acquisitionCost') cost?: string) {
    return this.intelligence.computeCACPayback(id, cost ? Number(cost) : undefined);
  }

  @Get('tenant/:id/cost-to-serve')
  costToServe(@Param('id') id: string) {
    return this.intelligence.costToServe(id);
  }

  @Get('tenant/:id/pl')
  pl(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.intelligence.getPLSummary(id, from ? new Date(from) : monthStart, to ? new Date(to) : now);
  }

  @Get('platform/margin-ranking')
  marginRanking(@Query('limit') limit?: string) {
    return this.intelligence.getPlatformMarginRanking(limit ? Number(limit) : 10);
  }

  @Get('platform/cost-overhead')
  overhead(@Query('months') months?: string) {
    return this.costAlloc.getPlatformCostOverhead(months ? Number(months) : 3);
  }

  @Get('department-costs')
  departmentCosts(@Query('from') from: string, @Query('to') to: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.costAlloc.getDepartmentCostSummary(from ? new Date(from) : monthStart, to ? new Date(to) : now);
  }
}
