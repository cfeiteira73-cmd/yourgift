import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { StripeReconciliationService } from './stripe-reconciliation.service';

@ApiTags('reconciliation')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/reconciliation/stripe')
export class StripeReconciliationController {
  constructor(private readonly service: StripeReconciliationService) {}

  /** Cross-check our DB against Stripe's actual payment records */
  @Get('cross-check')
  async crossCheck(
    @Query('tenantId') tenantId: string = 'default',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();
    return this.service.crossCheckWithStripe(tenantId, from, to);
  }

  /** Get repair events for discrepancies (read-only, no mutations) */
  @Post('repair-events')
  @HttpCode(HttpStatus.OK)
  async repairEvents(
    @Query('tenantId') tenantId: string = 'default',
  ) {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const report = await this.service.crossCheckWithStripe(tenantId, from, new Date());
    return {
      report,
      repairEvents: this.service.generateRepairEvents(report),
    };
  }

  /** Trigger scheduled Stripe reconciliation (last 24h, all tenants) */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runReconciliation() {
    await this.service.scheduleStripeReconciliation();
    return { triggered: true, timestamp: new Date().toISOString() };
  }
}
