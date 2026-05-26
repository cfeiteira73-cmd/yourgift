import {
  Controller,
  Get,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  CommerceIntelligenceService,
  ClientLifetimeMetrics,
  ConversionFunnelMetrics,
  ProductRecommendation,
  ReorderAlert,
} from './commerce-intelligence.service';

@Controller('admin/commerce-intelligence')
@UseGuards(AdminAuthGuard)
export class CommerceIntelligenceController {
  constructor(
    private readonly commerceIntelligence: CommerceIntelligenceService,
  ) {}

  @Get('recommendations/:clientId')
  async getProductRecommendations(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
  ): Promise<ProductRecommendation[]> {
    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : undefined;
    return this.commerceIntelligence.getProductRecommendations(
      clientId,
      parsedLimit,
    );
  }

  @Get('reorder-alerts/:tenantId')
  async getReorderAlerts(
    @Param('tenantId') tenantId: string,
    @Query('windowDays') windowDays?: string,
  ): Promise<ReorderAlert[]> {
    const parsedWindow =
      windowDays !== undefined ? parseInt(windowDays, 10) : undefined;
    return this.commerceIntelligence.getReorderAlerts(tenantId, parsedWindow);
  }

  @Get('client-ltv/:clientId')
  async getClientLifetimeMetrics(
    @Param('clientId') clientId: string,
  ): Promise<ClientLifetimeMetrics> {
    return this.commerceIntelligence.getClientLifetimeMetrics(clientId);
  }

  @Get('funnel/:tenantId')
  async getConversionFunnelMetrics(
    @Param('tenantId') tenantId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ): Promise<ConversionFunnelMetrics> {
    return this.commerceIntelligence.getConversionFunnelMetrics(
      tenantId,
      new Date(fromDate),
      new Date(toDate),
    );
  }

  @Get('churn-risk/:tenantId')
  async getChurnRiskClients(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ): Promise<ClientLifetimeMetrics[]> {
    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : undefined;
    return this.commerceIntelligence.getChurnRiskClients(tenantId, parsedLimit);
  }
}
