import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { CustomerLifecycleService } from './customer-lifecycle.service';

@ApiTags('lifecycle')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/lifecycle')
export class LifecycleController {
  constructor(private readonly service: CustomerLifecycleService) {}

  /** Evaluate a single client's lifecycle state */
  @Get('clients/:clientId')
  async evaluateClient(@Param('clientId') clientId: string) {
    return this.service.evaluateClient(clientId);
  }

  /** Evaluate all clients and return their lifecycle states */
  @Get('clients')
  async evaluateAll(@Query('tenantId') tenantId?: string) {
    return this.service.evaluateAllClients(tenantId);
  }

  /** Churn report — aggregated state distribution and revenue at risk */
  @Get('churn-report')
  async churnReport(@Query('tenantId') tenantId?: string) {
    return this.service.getChurnReport(tenantId);
  }

  /** Trigger weekly evaluation manually */
  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  async triggerEvaluation() {
    await this.service.scheduleWeeklyEvaluation();
    return { triggered: true, timestamp: new Date().toISOString() };
  }
}
