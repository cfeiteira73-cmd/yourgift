import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { UsageMeteringService } from './usage-metering.service';
import { TenantQuotaService } from './tenant-quota.service';

@Controller('api/v1/tenant-economics')
@UseGuards(AdminAuthGuard)
export class TenantEconomicsController {
  constructor(
    private readonly meteringService: UsageMeteringService,
    private readonly quotaService: TenantQuotaService,
  ) {}

  @Get('usage/:tenantId')
  async getCurrentUsage(@Param('tenantId') tenantId: string) {
    const usage = await this.meteringService.getCurrentPeriodUsage(tenantId);
    return {
      ...usage,
      aiTokensUsed: usage.aiTokensUsed.toString(),
    };
  }

  @Get('usage/:tenantId/trend')
  getTrend(
    @Param('tenantId') tenantId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.meteringService.getTrend(tenantId, days);
  }

  @Get('top-consumers')
  async getTopConsumers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.meteringService.getTopConsumers(limit, days);
  }

  @Get('quota/:tenantId')
  async getQuota(@Param('tenantId') tenantId: string) {
    const quota = await this.quotaService.getQuota(tenantId);
    return {
      ...quota,
      maxAiTokensPerDay: quota.maxAiTokensPerDay.toString(),
    };
  }

  @Put('quota/:tenantId')
  async updateQuota(
    @Param('tenantId') tenantId: string,
    @Body() updates: Record<string, unknown>,
  ) {
    const quota = await this.quotaService.updateQuota(tenantId, updates);
    const tokensPerDay = quota['maxAiTokensPerDay'];
    return {
      ...quota,
      maxAiTokensPerDay:
        typeof tokensPerDay === 'bigint'
          ? tokensPerDay.toString()
          : String(tokensPerDay ?? '0'),
    };
  }

  @Get('quota/:tenantId/status')
  getQuotaStatus(@Param('tenantId') tenantId: string) {
    return this.quotaService.getQuotaStatus(tenantId);
  }

  @Get('noisy-neighbors')
  detectNoisyNeighbors() {
    return this.quotaService.detectNoisyNeighbor();
  }

  @Post('aggregate')
  @HttpCode(HttpStatus.OK)
  async triggerAggregation(
    @Body()
    body: {
      tenantId: string;
      periodType: 'hourly' | 'daily' | 'monthly';
    },
  ) {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (body.periodType) {
      case 'hourly': {
        periodStart = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
          ),
        );
        periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000);
        break;
      }
      case 'monthly': {
        periodStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );
        periodEnd = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        );
        break;
      }
      default: {
        // daily
        periodStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
        periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    await this.meteringService.aggregatePeriod(
      body.tenantId,
      periodStart,
      periodEnd,
      body.periodType,
    );

    return { ok: true, tenantId: body.tenantId, periodType: body.periodType };
  }
}
