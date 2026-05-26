import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ProductionActivationService } from './production-activation.service';

@ApiTags('production-activation')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/production')
export class ProductionActivationController {
  constructor(private readonly service: ProductionActivationService) {}

  /**
   * GET /api/v1/admin/production/live-money-status
   * Returns go-live readiness: Stripe live mode, webhook health, payout status, disputes.
   * goLiveVerdict: READY | READY_TEST_MODE | NOT_READY
   */
  @Get('live-money-status')
  async getLiveMoneyStatus() {
    return this.service.getLiveMoneyStatus();
  }
}
