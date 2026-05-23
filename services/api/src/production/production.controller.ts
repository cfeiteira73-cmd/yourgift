import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductionService } from './production.service';

@Controller('api/v1/production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('stats')
  stats() { return this.production.getControlTowerStats(); }

  @Get('bottlenecks')
  bottlenecks() { return this.production.getBottlenecks(); }

  @Get('sla-definitions')
  slaDefinitions() { return this.production.getSLADefinitions(); }

  @Get('at-risk')
  atRisk() { return this.production.getOrdersAtRisk(); }

  @Get('order/:orderId')
  orderPipeline(@Param('orderId') orderId: string) {
    return this.production.getPipelineForOrder(orderId);
  }

  @Post('order/:orderId/initialize')
  initialize(@Param('orderId') orderId: string, @Body() body: { tenantId?: string }) {
    return this.production.initializePipeline(orderId, body.tenantId ?? 'default');
  }

  @Patch('order/:orderId/stage/:stage')
  advanceStage(
    @Param('orderId') orderId: string,
    @Param('stage') stage: string,
    @Body() body: { status: string },
  ) {
    return this.production.advanceStage(orderId, stage, body.status);
  }

  @Post('order/:orderId/sla-check')
  slaCheck(@Param('orderId') orderId: string) {
    return this.production.computeSLAStatus(orderId);
  }
}
