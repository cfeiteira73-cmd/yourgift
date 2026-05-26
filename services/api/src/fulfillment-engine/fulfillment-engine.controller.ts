import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { FulfillmentEngineService } from './fulfillment-engine.service';

class DispatchOrderDto {
  orderId: string;
  providerName?: string;
}

@ApiTags('fulfillment-engine')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/fulfillment')
export class FulfillmentEngineController {
  constructor(private readonly service: FulfillmentEngineService) {}

  @Post('dispatch')
  @ApiOperation({ summary: 'Dispatch an order to an external fulfillment provider' })
  dispatch(@Body() body: DispatchOrderDto) {
    return this.service.dispatchOrder(body.orderId, body.providerName);
  }

  @Get('sla')
  @ApiOperation({ summary: 'Get SLA status report for all active production jobs' })
  getSLAStatus() {
    return this.service.getSLAStatus();
  }

  @Get('batch')
  @ApiOperation({ summary: 'Get batch summary of orders and production jobs across all statuses' })
  getBatchSummary() {
    return this.service.getBatchSummary();
  }

  @Get('providers')
  @ApiOperation({ summary: 'List all registered fulfillment provider names' })
  listProviders() {
    return this.service.listProviderNames();
  }
}
