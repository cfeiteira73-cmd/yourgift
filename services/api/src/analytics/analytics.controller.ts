import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('revenue')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getRevenueDashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    return this.analytics.getRevenueDashboard(fromDate, toDate);
  }

  @Get('margin')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getMarginAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    return this.analytics.getMarginAnalytics(fromDate, toDate);
  }

  @Get('suppliers')
  getSupplierPerformance() {
    return this.analytics.getSupplierPerformance();
  }

  @Get('funnel')
  getOrderFunnel() {
    return this.analytics.getOrderFunnel();
  }

  @Get('products')
  @ApiQuery({ name: 'limit', required: false })
  getTopProducts(@Query('limit') limit?: string) {
    return this.analytics.getTopProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('clients')
  @ApiQuery({ name: 'companyId', required: false })
  getClientAnalytics(@Query('companyId') companyId?: string) {
    return this.analytics.getClientAnalytics(companyId);
  }

  @Get('dashboard')
  @ApiQuery({ name: 'range', required: false, enum: ['7d', '30d', '90d', '12m'] })
  getDashboard(@Query('range') range?: '7d' | '30d' | '90d' | '12m') {
    return this.analytics.getDashboard(range ?? '30d');
  }
}
