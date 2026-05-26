import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  HistoryEntry,
  LiveValidationReport,
  RealTransactionValidationService,
} from './live-validation.service';

@ApiTags('live-validation')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/live-validation')
export class LiveValidationController {
  constructor(
    private readonly realTransactionValidationService: RealTransactionValidationService,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current live transaction validation report',
    description:
      'Runs 10 parallel validations against the database and Stripe API covering: successful charges, card failures, duplicate webhooks, out-of-order events, delayed settlements, refunds, partial refunds, disputes, expired sessions, and abandoned carts.',
  })
  @ApiResponse({ status: 200, description: 'Validation report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentValidation(): Promise<LiveValidationReport> {
    return this.realTransactionValidationService.getCurrentValidation();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get transaction event history grouped by day',
    description:
      'Returns per-day counts of payments, refunds, disputes, and failures for the specified number of past days. All days in the range are returned, including zero-count days for chart continuity.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of past days to include (default: 7)',
  })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(@Query('days') days?: string): Promise<HistoryEntry[]> {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const safeDays = isNaN(parsedDays) || parsedDays < 1 ? 7 : Math.min(parsedDays, 90);
    return this.realTransactionValidationService.getHistory(safeDays);
  }
}
