import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { AutoRemediationService, RemediationAction, SystemHealthSnapshot } from './auto-remediation.service';
import { RollbackOrchestratorService, RollbackPlan } from './rollback-orchestrator.service';

interface ActivateDegradedBody {
  queueName: string;
}

interface CreateRollbackBody {
  reason: string;
  targetVersion: string;
}

@ApiTags('sre')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/sre')
export class SreController {
  constructor(
    private readonly autoRemediation: AutoRemediationService,
    private readonly rollback: RollbackOrchestratorService,
  ) {}

  // ── Health snapshot ───────────────────────────────────────────────────────

  @Get('health')
  getHealthSnapshot(): SystemHealthSnapshot {
    return this.autoRemediation.getHealthSnapshot();
  }

  // ── Remediation history ───────────────────────────────────────────────────

  @Get('remediations')
  getRemediationHistory(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): RemediationAction[] {
    return this.autoRemediation.getRemediationHistory(limit);
  }

  // ── Throttle management ───────────────────────────────────────────────────

  @Post('throttle/:endpoint')
  activateThrottle(@Param('endpoint') endpoint: string): { endpoint: string; throttled: boolean } {
    this.autoRemediation.activateThrottle(endpoint);
    return { endpoint, throttled: true };
  }

  @Delete('throttle/:endpoint')
  deactivateThrottle(@Param('endpoint') endpoint: string): { endpoint: string; throttled: boolean } {
    this.autoRemediation.deactivateThrottle(endpoint);
    return { endpoint, throttled: false };
  }

  // ── Degraded mode management ──────────────────────────────────────────────

  @Post('degraded-mode')
  activateDegradedIngestion(
    @Body() body: ActivateDegradedBody,
  ): { degradedMode: boolean; queueName: string } {
    this.autoRemediation.activateDegradedIngestion(body.queueName);
    return { degradedMode: true, queueName: body.queueName };
  }

  @Delete('degraded-mode')
  deactivateDegradedIngestion(): { degradedMode: boolean } {
    this.autoRemediation.deactivateDegradedIngestion();
    return { degradedMode: false };
  }

  // ── Rollback orchestration ────────────────────────────────────────────────

  @Post('rollback')
  createRollbackPlan(@Body() body: CreateRollbackBody): RollbackPlan {
    return this.rollback.createRollbackPlan(body.reason, body.targetVersion);
  }

  @Post('rollback/:rollbackId/execute')
  async executeRollback(@Param('rollbackId') rollbackId: string): Promise<RollbackPlan> {
    return this.rollback.executeRollback(rollbackId);
  }

  @Get('rollback/health-check')
  async validateDeployHealth(): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
    failedChecks: string[];
  }> {
    return this.rollback.validateDeployHealth();
  }

  @Get('rollback/active')
  getActivePlans(): RollbackPlan[] {
    return this.rollback.getActivePlans();
  }
}
