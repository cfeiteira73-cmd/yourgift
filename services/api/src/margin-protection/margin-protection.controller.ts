import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  MarginProtectionService,
  PLSimulation,
} from './margin-protection.service';

@Controller('margin-protection')
@UseGuards(JwtAuthGuard)
export class MarginProtectionController {
  constructor(private readonly marginService: MarginProtectionService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkMargin(
    @Body()
    body: {
      referenceId: string;
      referenceType: string;
      salePrice: number;
      totalCost: number;
      supplierName?: string;
      category?: string;
      tenantId?: string;
    },
  ) {
    return this.marginService.checkMargin(body);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  simulate(
    @Body()
    body: {
      salePrice: number;
      productCost: number;
      shippingCost?: number;
      printCost?: number;
      platformFeePct?: number;
      fulfillmentPct?: number;
      quantity?: number;
    },
  ): PLSimulation {
    return this.marginService.simulatePL(body);
  }

  @Post('simulate/save')
  async saveSimulation(
    @Body()
    body: {
      name?: string;
      tenantId?: string;
      salePrice: number;
      productCost: number;
      shippingCost: number;
      printCost: number;
      platformFeePct: number;
      fulfillmentPct: number;
      quantity: number;
      currency?: string;
    } & PLSimulation,
  ) {
    return this.marginService.saveSimulation(body);
  }

  @Get('alerts')
  getActiveAlerts(@Query('tenantId') tenantId?: string) {
    return this.marginService.getActiveAlerts(tenantId);
  }

  @Patch('alerts/:id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resolveAlert(
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    await this.marginService.resolveAlert(id, body.note);
  }

  @Get('rules')
  getRules() {
    return this.marginService.getRules();
  }

  @Post('rules')
  upsertRule(
    @Body()
    body: {
      id?: string;
      name: string;
      scope: string;
      scopeValue?: string;
      minMarginPct: number;
      warningThresholdPct: number;
      action: string;
      tenantId?: string;
    },
  ) {
    return this.marginService.upsertRule(body);
  }

  @Get('cost-history')
  getCostHistory(
    @Query('supplier') supplier?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marginService.getCostHistory(supplier, limit ? Number(limit) : 50);
  }

  @Post('cost-snapshots')
  recordCostSnapshot(
    @Body()
    body: {
      supplierName: string;
      category: string;
      productRef?: string;
      unitCost: number;
      currency?: string;
      source?: string;
      notes?: string;
    },
  ) {
    return this.marginService.recordCostSnapshot(body);
  }

  @Get('drift/:supplier')
  detectCostDrift(@Param('supplier') supplier: string) {
    return this.marginService.detectCostDrift(supplier);
  }

  @Get('health')
  getHealthSummary() {
    return this.marginService.getHealthSummary();
  }
}
