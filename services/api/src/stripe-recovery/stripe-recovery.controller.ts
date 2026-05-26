import {
  Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { StripeRecoveryService } from './stripe-recovery.service';

@ApiTags('stripe-recovery')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/stripe-recovery')
export class StripeRecoveryController {
  constructor(private readonly service: StripeRecoveryService) {}

  /** Replay a specific Stripe event by ID */
  @Post('events/:eventId/replay')
  @HttpCode(HttpStatus.OK)
  async replayEvent(@Param('eventId') eventId: string) {
    return this.service.replayEvent(eventId);
  }

  /** Recover order state from Stripe source of truth */
  @Post('orders/:orderId/recover')
  @HttpCode(HttpStatus.OK)
  async recoverOrderState(@Param('orderId') orderId: string) {
    return this.service.recoverOrderState(orderId);
  }

  /** Scan date range for stuck orders with succeeded Stripe PIs */
  @Post('settlements/recover')
  @HttpCode(HttpStatus.OK)
  async recoverMissingSettlement(
    @Body() body: { fromDate?: string; toDate?: string },
  ) {
    const from = body.fromDate ? new Date(body.fromDate) : new Date(Date.now() - 7 * 86_400_000);
    const to = body.toDate ? new Date(body.toDate) : new Date();
    return this.service.recoverMissingSettlement(from, to);
  }

  /** Full financial timeline for an order */
  @Get('orders/:orderId/timeline')
  async rebuildTimeline(@Param('orderId') orderId: string) {
    return this.service.rebuildFinancialTimeline(orderId);
  }

  /** Verify ledger consistency for a tenant */
  @Get('tenants/:tenantId/ledger-consistency')
  async verifyLedger(@Param('tenantId') tenantId: string) {
    return this.service.verifyLedgerConsistency(tenantId);
  }

  /** Repair payment drift for a specific order */
  @Post('orders/:orderId/repair-drift')
  @HttpCode(HttpStatus.OK)
  async repairDrift(@Param('orderId') orderId: string) {
    return this.service.repairPaymentDrift(orderId);
  }
}
