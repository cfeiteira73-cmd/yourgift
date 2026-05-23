import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GovernanceService, DecisionContext } from './governance.service';
import { TrustEngineService } from './trust-engine.service';
import { DecisionTraceService } from './decision-trace.service';

@Controller('api/v1/governance')
@UseGuards(JwtAuthGuard)
export class GovernanceController {
  constructor(
    private readonly governance: GovernanceService,
    private readonly trustEngine: TrustEngineService,
    private readonly traceService: DecisionTraceService,
  ) {}

  // ── Governance Policies ──
  @Get('policies')
  getPolicies(@Query('tenantId') tenantId?: string) {
    return this.governance.getPolicies(tenantId);
  }

  @Post('check')
  checkDecision(@Body() ctx: DecisionContext) {
    return this.governance.checkDecision(ctx);
  }

  @Patch('policies/:id/config')
  updatePolicy(@Param('id') id: string, @Body() body: { config: Record<string, unknown> }) {
    return this.governance.updatePolicyConfig(id, body.config);
  }

  @Patch('policies/:id/toggle')
  togglePolicy(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.governance.togglePolicy(id, body.isActive);
  }

  @Get('violations')
  getViolations(@Query('limit') limit?: string) {
    return this.governance.getViolations(limit ? Number(limit) : 50);
  }

  @Get('stats')
  getGovernanceStats() {
    return this.governance.getGovernanceStats();
  }

  // ── Trust Engine ──
  @Get('trust')
  getAllTrustScores() {
    return this.trustEngine.getAllTrustScores();
  }

  @Get('trust/:context/:value')
  getTrustBreakdown(@Param('context') context: string, @Param('value') value: string) {
    return this.trustEngine.getTrustBreakdown(context, value);
  }

  @Get('trust/stats')
  getTrustStats() {
    return this.trustEngine.getNetworkTrustStats();
  }

  @Post('trust/outcome')
  recordOutcome(@Body() body: {
    context: string;
    contextValue: string;
    wasCorrect: boolean;
    wasOverridden: boolean;
    hadViolation: boolean;
    benchmarkDeltaPct?: number;
  }) {
    return this.trustEngine.recordOutcome(body);
  }

  // ── Decision Traces ──
  @Get('traces')
  listTraces(@Query('limit') limit?: string) {
    return this.traceService.listTraces(limit ? Number(limit) : 50);
  }

  @Get('traces/stats')
  getTraceStats() {
    return this.traceService.getTraceStats();
  }

  @Get('traces/:id')
  getTrace(@Param('id') id: string) {
    return this.traceService.getTrace(id);
  }

  @Post('traces')
  createTrace(@Body() body: {
    decisionCardId?: string;
    traceType?: string;
    inputSnapshot: object;
    selectedAction?: string;
    autonomyLevel?: number;
  }) {
    return this.traceService.createTrace(body);
  }

  @Patch('traces/:id/outcome')
  recordTraceOutcome(
    @Param('id') id: string,
    @Body() body: { outcomeData: object; trustScore?: number },
  ) {
    return this.traceService.recordOutcome(id, body.outcomeData, body.trustScore);
  }
}
