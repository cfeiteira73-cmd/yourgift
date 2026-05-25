import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { DataLakeService } from './data-lake.service';
import { OlapQueryService, OlapQuery } from './olap-query.service';

// ─── DTO ─────────────────────────────────────────────────────────────────────

class RunOlapQueryDto implements OlapQuery {
  measures!: string[];
  dimensions!: string[];
  filters?: Record<string, string>;
  from!: Date;
  to!: Date;
  limit?: number;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('data-platform')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/data-platform')
export class DataPlatformController {
  constructor(
    private readonly dataLake: DataLakeService,
    private readonly olapQuery: OlapQueryService,
  ) {}

  // ── GET /data-platform/procurement/timeseries ──────────────────────────────

  @Get('procurement/timeseries')
  @ApiQuery({ name: 'granularity', required: false, enum: ['hour', 'day', 'week', 'month'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getProcurementTimeSeries(
    @Query('granularity') granularity = 'day',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const validGranularities = ['hour', 'day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      throw new BadRequestException(`granularity must be one of: ${validGranularities.join(', ')}`);
    }

    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 90 * 86_400_000);
    const toDate = to ? new Date(to) : now;

    return this.dataLake.getProcurementTimeSeries({
      tenantId,
      granularity: granularity as 'hour' | 'day' | 'week' | 'month',
      from: fromDate,
      to: toDate,
    });
  }

  // ── GET /data-platform/suppliers/trends ───────────────────────────────────

  @Get('suppliers/trends')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  getSupplierTrends(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 90 * 86_400_000);
    const toDate = to ? new Date(to) : now;

    return this.dataLake.getSupplierTrends({ supplierId, from: fromDate, to: toDate });
  }

  // ── GET /data-platform/categories/benchmarks ──────────────────────────────

  @Get('categories/benchmarks')
  @ApiQuery({ name: 'tenantId', required: false })
  getCategoryBenchmarks(@Query('tenantId') tenantId?: string) {
    return this.dataLake.getCategoryBenchmarks(tenantId);
  }

  // ── GET /data-platform/sla/performance ────────────────────────────────────

  @Get('sla/performance')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getSlaPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 90 * 86_400_000);
    const toDate = to ? new Date(to) : now;
    return this.dataLake.getSlaPerformance(fromDate, toDate);
  }

  // ── GET /data-platform/forecast ───────────────────────────────────────────

  @Get('forecast')
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'horizonDays', required: false })
  getForecast(
    @Query('tenantId') tenantId?: string,
    @Query('horizonDays') horizonDays?: string,
  ) {
    const horizon = horizonDays ? parseInt(horizonDays, 10) : 30;
    return this.dataLake.getProcurementForecast(tenantId, horizon);
  }

  // ── GET /data-platform/export/clickhouse ──────────────────────────────────

  @Get('export/clickhouse')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  exportClickHouse(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 86_400_000);
    const toDate = to ? new Date(to) : now;
    return this.dataLake.exportForClickHouse(fromDate, toDate);
  }

  // ── POST /data-platform/olap/query ────────────────────────────────────────

  @Post('olap/query')
  runOlapQuery(@Body() body: RunOlapQueryDto) {
    if (!Array.isArray(body.measures) || !Array.isArray(body.dimensions)) {
      throw new BadRequestException('measures and dimensions must be arrays');
    }
    return this.olapQuery.runQuery({
      measures: body.measures,
      dimensions: body.dimensions,
      filters: body.filters,
      from: new Date(body.from),
      to: new Date(body.to),
      limit: body.limit,
    });
  }

  // ── GET /data-platform/olap/queries ───────────────────────────────────────

  @Get('olap/queries')
  getSavedQueries() {
    return this.olapQuery.getSavedQueries();
  }
}
