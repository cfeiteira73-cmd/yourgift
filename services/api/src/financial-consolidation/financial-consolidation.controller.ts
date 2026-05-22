import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinancialConsolidationService } from './financial-consolidation.service';
import { BudgetAnomalyService } from './budget-anomaly.service';

@Controller('api/v1/consolidation')
@UseGuards(JwtAuthGuard)
export class FinancialConsolidationController {
  constructor(
    private readonly consolidation: FinancialConsolidationService,
    private readonly anomalies: BudgetAnomalyService,
  ) {}

  // ── Consolidations ────────────────────────────────────────────────────────

  @Post('run')
  runConsolidation(
    @Body()
    body: {
      periodLabel: string;
      periodType: 'monthly' | 'quarterly' | 'ytd' | 'custom';
      periodStart: string;
      periodEnd: string;
      computedBy?: string;
    },
  ) {
    return this.consolidation.consolidate({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  @Post('run/month')
  consolidateMonth() {
    return this.consolidation.consolidateCurrentMonth();
  }

  @Post('run/quarter')
  consolidateQuarter() {
    return this.consolidation.consolidateCurrentQuarter();
  }

  @Get()
  list(@Query('type') type?: string, @Query('limit') limit?: string) {
    return this.consolidation.getConsolidations(type, limit ? Number(limit) : 12);
  }

  @Get('latest')
  latest() {
    return this.consolidation.getLatestConsolidation();
  }

  @Get('trend')
  trend(@Query('months') months?: string) {
    return this.consolidation.getPLTrend(months ? Number(months) : 6);
  }

  // ── Anomalies ─────────────────────────────────────────────────────────────

  @Get('anomalies')
  listAnomalies(
    @Query('tenantId') tenantId?: string,
    @Query('severity') severity?: string,
    @Query('unacknowledged') unacknowledged?: string,
    @Query('limit') limit?: string,
  ) {
    return this.anomalies.getAnomalies({
      tenantId,
      severity,
      acknowledged: unacknowledged === 'true' ? false : undefined,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('anomalies/stats')
  anomalyStats() {
    return this.anomalies.getStats();
  }

  @Patch('anomalies/:id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @Body() body: { acknowledgedBy: string },
  ) {
    return this.anomalies.acknowledge(id, body.acknowledgedBy);
  }
}
