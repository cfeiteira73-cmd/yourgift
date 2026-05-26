import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  FinancialCausalityService,
  MarginExplainerReport,
  WhyLossReport,
} from './financial-causality.service';

@ApiTags('financial-causality')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/financial')
export class FinancialCausalityController {
  constructor(
    private readonly financialCausalityService: FinancialCausalityService,
  ) {}

  @Get('why-loss/:orderId')
  @ApiOperation({ summary: 'Get P&L causal analysis for an order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  getWhyLoss(@Param('orderId') orderId: string): Promise<WhyLossReport> {
    return this.financialCausalityService.getWhyLoss(orderId);
  }

  @Get('margin-explainer/:orderId')
  @ApiOperation({ summary: 'Get full per-item margin breakdown for an order' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  getMarginExplainer(
    @Param('orderId') orderId: string,
  ): Promise<MarginExplainerReport> {
    return this.financialCausalityService.getMarginExplainer(orderId);
  }
}
