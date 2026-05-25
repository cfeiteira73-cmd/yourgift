import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { FinancialTraceService } from './financial-trace.service';

@ApiTags('financial-trace')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/financial-trace')
export class FinancialTraceController {
  constructor(private readonly service: FinancialTraceService) {}

  /** Full causal explanation: why did this order make/lose money? */
  @Get('orders/:orderId')
  async explainOrder(@Param('orderId') orderId: string) {
    return this.service.explainOrder(orderId);
  }

  /** Tenant profitability graph — last 30 days aggregated */
  @Get('tenants/:tenantId/profitability')
  async tenantProfitability(@Param('tenantId') tenantId: string) {
    return this.service.tenantProfitabilityGraph(tenantId);
  }
}
