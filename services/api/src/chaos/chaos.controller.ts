import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ChaosEngineService } from './chaos-engine.service';
import { MultiRegionService } from './multi-region.service';
import { FailoverDrillService } from './failover-drill.service';

interface ScheduleDrillDto {
  drillType: string;
  targetService: string;
  config?: Record<string, unknown>;
  scheduledAt: string;
  triggeredBy: string;
  tenantId?: string;
}

interface CompleteDrillDto {
  findings?: string;
  mttrMinutes?: number;
  rtoMet?: boolean;
  rpoMet?: boolean;
}

interface AbortDrillDto {
  reason: string;
}

interface SimulateDto {
  drillType: string;
  targetService: string;
}

interface InitiateFailoverDto {
  fromRegion: string;
  toRegion: string;
  trigger: 'manual' | 'auto_circuit_breaker' | 'chaos_drill';
  initiatedBy: string;
  notes?: string;
}

interface CompleteFailoverDto {
  rtoMinutes: number;
  rpoMinutes: number;
}

@ApiTags('chaos')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('chaos')
export class ChaosController {
  constructor(
    private readonly chaosEngine: ChaosEngineService,
    private readonly multiRegion: MultiRegionService,
    private readonly failoverDrill: FailoverDrillService,
  ) {}

  // ── Chaos Drills ──────────────────────────────────────────────────────────

  @Get('drills/stats')
  async getDrillStats(): Promise<unknown> {
    return this.chaosEngine.getDrillStats();
  }

  @Get('drills')
  async listDrills(@Query('status') status?: string) {
    return this.chaosEngine.listDrills(status);
  }

  @Post('drills')
  @HttpCode(HttpStatus.CREATED)
  async scheduleDrill(@Body() body: ScheduleDrillDto) {
    return this.chaosEngine.scheduleDrill({
      drillType: body.drillType,
      targetService: body.targetService,
      config: body.config ?? {},
      scheduledAt: new Date(body.scheduledAt),
      triggeredBy: body.triggeredBy,
      tenantId: body.tenantId,
    });
  }

  @Post('drills/:id/start')
  @HttpCode(HttpStatus.OK)
  async startDrill(@Param('id') id: string) {
    return this.chaosEngine.startDrill(id);
  }

  @Post('drills/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeDrill(@Param('id') id: string, @Body() body: CompleteDrillDto) {
    return this.chaosEngine.completeDrill(id, {
      findings: body.findings,
      mttrMinutes: body.mttrMinutes,
      rtoMet: body.rtoMet,
      rpoMet: body.rpoMet,
    });
  }

  @Post('drills/:id/abort')
  @HttpCode(HttpStatus.OK)
  async abortDrill(@Param('id') id: string, @Body() body: AbortDrillDto) {
    return this.chaosEngine.abortDrill(id, body.reason ?? 'No reason provided');
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  async simulateDrill(@Body() body: SimulateDto): Promise<unknown> {
    return this.chaosEngine.simulateDrill(body.drillType, body.targetService);
  }

  // ── Multi-region ──────────────────────────────────────────────────────────

  @Get('regions')
  async getRegionStatus() {
    return this.multiRegion.getRegionStatus();
  }

  @Post('regions/check')
  @HttpCode(HttpStatus.OK)
  async triggerHealthCheck() {
    return this.multiRegion.checkRegionHealth();
  }

  @Get('failover/history')
  async getFailoverHistory(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.multiRegion.getFailoverHistory(isNaN(parsedLimit) ? 50 : parsedLimit);
  }

  @Post('failover')
  @HttpCode(HttpStatus.CREATED)
  async initiateFailover(@Body() body: InitiateFailoverDto) {
    return this.multiRegion.initiateFailover({
      fromRegion: body.fromRegion,
      toRegion: body.toRegion,
      trigger: body.trigger,
      initiatedBy: body.initiatedBy,
      notes: body.notes,
    });
  }

  @Post('failover/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeFailover(@Param('id') id: string, @Body() body: CompleteFailoverDto) {
    return this.multiRegion.completeFailover(id, body.rtoMinutes, body.rpoMinutes);
  }

  @Get('resilience')
  async getResilientStatus(): Promise<unknown> {
    return this.multiRegion.getResilientStatus();
  }

  // ── Failover Drills (RTO/RPO measurement) ────────────────────────────────
  // Called by scripts/failover-drill.ts and chaos-drill.yml CI workflow

  @Post('failover-drill/:type')
  @HttpCode(HttpStatus.CREATED)
  async startFailoverDrill(@Param('type') drillType: string) {
    const validTypes = ['db_primary_failover', 'redis_primary_failover', 'full_region_isolation'];
    if (!validTypes.includes(drillType)) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException(
        `Invalid drill type. Must be one of: ${validTypes.join(', ')}`,
      );
    }
    switch (drillType) {
      case 'db_primary_failover':
        return this.failoverDrill.runDbFailoverDrill();
      case 'redis_primary_failover':
        return this.failoverDrill.runRedisFailoverDrill();
      case 'full_region_isolation':
        return this.failoverDrill.runRegionIsolationDrill();
    }
  }

  @Get('failover-drill/:id/status')
  async getFailoverDrillStatus(@Param('id') id: string) {
    return this.failoverDrill.getDrillStatus(id);
  }

  @Get('failover-drill/history')
  async getFailoverDrillHistory(@Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    return this.failoverDrill.getLastDrillResults(isNaN(limit) ? 20 : limit);
  }
}
