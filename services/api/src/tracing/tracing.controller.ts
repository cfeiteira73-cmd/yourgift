import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TracingService, TraceStats } from './tracing.service';

@ApiTags('tracing')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('tracing')
export class TracingController {
  constructor(private readonly tracingService: TracingService) {}

  /** GET /tracing/spans — paginated span list with optional filters */
  @Get('spans')
  async getSpans(
    @Query('service') service?: string,
    @Query('tenantId') tenantId?: string,
    @Query('traceId') traceId?: string,
    @Query('status') statusRaw?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ): Promise<unknown[]> {
    const status = statusRaw !== undefined ? parseInt(statusRaw, 10) : undefined;
    return this.tracingService.getTraces({ service, tenantId, traceId, status, limit });
  }

  /** GET /tracing/traces/:traceId — all spans for a trace */
  @Get('traces/:traceId')
  async getTrace(
    @Param('traceId') traceId: string,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit = 200,
  ): Promise<unknown[]> {
    return this.tracingService.getTraces({ traceId, limit });
  }

  /** GET /tracing/stats — p50/p95/p99 by service from last 1h */
  @Get('stats')
  async getStats(): Promise<TraceStats[]> {
    return this.tracingService.getStatsLastHour();
  }
}
