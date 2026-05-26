import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DecisionEngineService, AlternativeAction } from './decision-engine.service';
import { ProcurementSimulatorService, SimulationInput } from './procurement-simulator.service';
import { DecisionCorrectnessService } from './decision-correctness.service';
import { WhatIfEngineService, WhatIfInput } from './what-if-engine.service';
import { ProcurementDecisionCardService, DecisionCardInput } from './procurement-decision-card.service';

@Controller('decision-engine')
@UseGuards(JwtAuthGuard)
export class DecisionEngineController {
  constructor(
    private readonly engine: DecisionEngineService,
    private readonly simulator: ProcurementSimulatorService,
    private readonly correctnessService: DecisionCorrectnessService,
    private readonly whatIfService: WhatIfEngineService,
    private readonly decisionCard: ProcurementDecisionCardService,
  ) {}

  // ── Procurement Decision Card ─────────────────────────────────────────────

  /**
   * POST /decision-engine/card
   *
   * One-screen, full-context procurement decision card.
   * Aggregates landed cost + supplier trust + budget + delivery + risk
   * into a single card with APPROVE / APPROVE_WITH_CONDITIONS / REJECT action.
   *
   * Frontend makes a single call to this endpoint to render the decision UI.
   * Target: decision in <30 seconds.
   */
  @Post('card')
  generateCard(@Body() body: DecisionCardInput) {
    return this.decisionCard.generate(body);
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  // POST /simulate
  @Post('simulate')
  simulate(@Body() body: SimulationInput) {
    return this.simulator.simulate(body);
  }

  // GET /simulate/history
  @Get('simulate/history')
  getSimulationHistory(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.simulator.getRecentSimulations(limit);
  }

  // GET /decisions
  @Get('decisions')
  getDecisions(
    @Query('status') status?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.engine.getDecisions({ status, riskLevel, limit });
  }

  // GET /decisions/pending
  @Get('decisions/pending')
  getPendingDecisions(@Query('tenantId') tenantId?: string) {
    return this.engine.getPendingDecisions(tenantId);
  }

  // POST /decisions
  @Post('decisions')
  createDecision(
    @Body()
    body: {
      triggerType: string;
      triggerId?: string;
      action: string;
      actionType: string;
      reasoning: string;
      riskScore: number;
      confidenceScore: number;
      marginImpactEur?: number;
      deliveryImpactDays?: number;
      finalMarginPct?: number;
      alternatives?: AlternativeAction[];
      tenantId?: string;
    },
  ) {
    return this.engine.createDecision(body);
  }

  // PATCH /decisions/:id/approve
  @Patch('decisions/:id/approve')
  approveDecision(@Param('id') id: string, @Body() body: { approvedBy: string }) {
    return this.engine.approveDecision(id, body.approvedBy);
  }

  // PATCH /decisions/:id/reject
  @Patch('decisions/:id/reject')
  rejectDecision(@Param('id') id: string, @Body() body: { rejectedBy: string }) {
    return this.engine.rejectDecision(id, body.rejectedBy);
  }

  // GET /state
  @Get('state')
  getLatestState() {
    return this.engine.getLatestState();
  }

  // GET /state/history
  @Get('state/history')
  getStateHistory(
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
  ) {
    return this.engine.getStateHistory(limit);
  }

  // POST /state/snapshot
  @Post('state/snapshot')
  takeSnapshot() {
    return this.engine.takeStateSnapshot();
  }

  // GET /stats
  @Get('stats')
  getStats() {
    return this.engine.getDecisionStats();
  }

  // POST /api/v1/decision-engine/decisions/:id/outcome
  @Post('decisions/:id/outcome')
  async recordOutcome(
    @Param('id') id: string,
    @Body() body: {
      actualSavingsEur?: number;
      actualMarginPct?: number;
      actualDeliveryDays?: number;
      actualCostEur?: number;
      outcomeType?: 'success' | 'partial' | 'failure';
      notes?: string;
      supplierCode?: string;
      category?: string;
      tenantId?: string;
    },
  ) {
    return this.correctnessService.recordOutcome({ decisionCardId: id, ...body });
  }

  // GET /api/v1/decision-engine/correctness
  @Get('correctness')
  async getCorrectnessStats(
    @Query('tenantId') tenantId?: string,
    @Query('period') period?: string,
  ) {
    return this.correctnessService.getCorrectnessStats(tenantId, period ?? '30d');
  }

  // GET /api/v1/decision-engine/decisions/:id/accuracy
  @Get('decisions/:id/accuracy')
  async getDecisionAccuracy(@Param('id') id: string) {
    return this.correctnessService.getDecisionAccuracy(id);
  }

  // POST /api/v1/decision-engine/what-if
  @Post('what-if')
  async runWhatIf(@Body() body: WhatIfInput & { tenantId?: string; decisionCardId?: string }) {
    return this.whatIfService.generateMatrix(body);
  }

  // GET /api/v1/decision-engine/what-if/runs
  @Get('what-if/runs')
  async getWhatIfRuns(@Query('tenantId') tenantId?: string) {
    return this.whatIfService.getRecentRuns(tenantId);
  }

  // GET /api/v1/decision-engine/what-if/runs/:id
  @Get('what-if/runs/:id')
  async getWhatIfRun(@Param('id') id: string) {
    return this.whatIfService.getRun(id);
  }
}
