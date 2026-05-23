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

@Controller('api/v1/decision-engine')
@UseGuards(JwtAuthGuard)
export class DecisionEngineController {
  constructor(
    private readonly engine: DecisionEngineService,
    private readonly simulator: ProcurementSimulatorService,
  ) {}

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
}
