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
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ModelRegistryService, CreateModelVersionDto } from './model-registry.service';
import { DriftDetectionService } from './drift-detection.service';
import { OverrideIntelligenceService, RecordOverrideDto } from './override-intelligence.service';
import { ShadowDeploymentService } from './shadow-deployment.service';

@Controller('model-ops')
@UseGuards(AdminAuthGuard)
export class ModelOpsController {
  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly driftDetection: DriftDetectionService,
    private readonly overrideIntelligence: OverrideIntelligenceService,
    private readonly shadowDeployment: ShadowDeploymentService,
  ) {}

  // ── Model Registry ──────────────────────────────────────────────────────────

  @Get('versions')
  listVersions(@Query('purpose') purpose?: string) {
    return this.modelRegistry.listVersions(purpose);
  }

  @Get('versions/active/:purpose')
  getActive(@Param('purpose') purpose: string) {
    return this.modelRegistry.getActive(purpose);
  }

  @Post('versions')
  @HttpCode(HttpStatus.CREATED)
  createVersion(@Body() body: CreateModelVersionDto) {
    return this.modelRegistry.createVersion(body);
  }

  @Post('versions/:id/promote')
  @HttpCode(HttpStatus.OK)
  promoteVersion(
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.modelRegistry.promote(id, body.notes);
  }

  @Post('versions/:id/retire')
  @HttpCode(HttpStatus.OK)
  retireVersion(@Param('id') id: string) {
    return this.modelRegistry.retire(id);
  }

  @Post('versions/:id/rollback')
  @HttpCode(HttpStatus.OK)
  rollbackVersion(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.modelRegistry.rollback(id, body.reason);
  }

  @Get('stats')
  getStats() {
    return this.modelRegistry.getStats();
  }

  // ── Drift Detection ─────────────────────────────────────────────────────────

  @Get('drift/alerts/recent')
  getRecentAlerts(@Query('limit') limit?: string) {
    return this.driftDetection.getRecentAlerts(limit ? parseInt(limit, 10) : 50);
  }

  @Get('drift/:modelVersionId')
  getDriftSummary(
    @Param('modelVersionId') modelVersionId: string,
    @Query('days') days?: string,
  ) {
    return this.driftDetection.getDriftSummary(
      modelVersionId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Post('drift')
  @HttpCode(HttpStatus.CREATED)
  recordDriftObservation(
    @Body()
    body: {
      modelVersionId: string;
      metric: string;
      expected: number;
      observed: number;
      windowStart: string;
      windowEnd: string;
      sampleCount: number;
      tenantId?: string;
    },
  ) {
    return this.driftDetection.recordObservation(
      body.modelVersionId,
      body.metric,
      body.expected,
      body.observed,
      new Date(body.windowStart),
      new Date(body.windowEnd),
      body.sampleCount,
      body.tenantId,
    );
  }

  // ── Override Intelligence ────────────────────────────────────────────────────

  @Post('overrides')
  @HttpCode(HttpStatus.CREATED)
  recordOverride(@Body() body: RecordOverrideDto) {
    return this.overrideIntelligence.recordOverride(body);
  }

  @Post('overrides/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolveOutcome(
    @Param('id') id: string,
    @Body()
    body: {
      outcome: 'correct' | 'incorrect';
      notes?: string;
      financialImpact?: number;
    },
  ) {
    return this.overrideIntelligence.resolveOutcome(
      id,
      body.outcome,
      body.notes,
      body.financialImpact,
    );
  }

  @Get('overrides/:modelVersionId/rate')
  getOverrideRate(
    @Param('modelVersionId') modelVersionId: string,
    @Query('days') days?: string,
  ) {
    return this.overrideIntelligence.getOverrideRate(
      modelVersionId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('overrides/:modelVersionId/patterns')
  getDisagreementPatterns(@Param('modelVersionId') modelVersionId: string) {
    return this.overrideIntelligence.getDisagreementPatterns(modelVersionId);
  }

  @Get('overrides/:modelVersionId/signals')
  getLearningSignals(@Param('modelVersionId') modelVersionId: string) {
    return this.overrideIntelligence.getLearningSignals(modelVersionId);
  }

  // ── Shadow Deployments ───────────────────────────────────────────────────────

  @Get('shadow')
  getActiveShadows() {
    return this.shadowDeployment.getActive();
  }

  @Post('shadow')
  @HttpCode(HttpStatus.CREATED)
  startShadow(
    @Body()
    body: {
      activeVersionId: string;
      shadowVersionId: string;
      purpose: string;
      tenantId?: string;
    },
  ) {
    return this.shadowDeployment.startShadow(
      body.activeVersionId,
      body.shadowVersionId,
      body.purpose,
      body.tenantId,
    );
  }

  @Post('shadow/:id/complete')
  @HttpCode(HttpStatus.OK)
  completeShadow(@Param('id') id: string) {
    return this.shadowDeployment.completeShadow(id);
  }

  @Post('shadow/:id/promote')
  @HttpCode(HttpStatus.OK)
  promoteShadow(
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    return this.shadowDeployment.promote(id, body.notes ?? '');
  }

  @Post('shadow/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectShadow(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.shadowDeployment.reject(id, body.reason ?? '');
  }
}
