import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProofEngineService, ProofRecordParams } from './proof-engine.service';
import { OnboardingService, OnboardingDataInput } from './onboarding.service';
import { AdoptionModeService, AdoptionMode } from './adoption-mode.service';

@Controller('proof-engine')
@UseGuards(JwtAuthGuard)
export class ProofEngineController {
  constructor(
    private readonly proofEngine: ProofEngineService,
    private readonly onboarding: OnboardingService,
    private readonly adoptionMode: AdoptionModeService,
  ) {}

  // ── Financial Proof ──
  @Get('summary')
  getValueSummary() {
    return this.proofEngine.getValueSummary();
  }

  @Get('cfo-report')
  getCFOReport(@Query('period') period?: string) {
    return this.proofEngine.getCFOReport(period);
  }

  @Get('recent')
  getRecentRecords(@Query('limit') limit?: string) {
    return this.proofEngine.getRecentProofRecords(limit ? Number(limit) : 20);
  }

  @Post('record')
  recordProof(@Body() params: ProofRecordParams) {
    return this.proofEngine.recordProof(params);
  }

  // ── Onboarding ──
  @Post('onboarding/start')
  startOnboarding(@Body() body: { tenantId: string }) {
    return this.onboarding.createSession(body.tenantId);
  }

  @Post('onboarding/:sessionId/analyze')
  analyzeData(@Param('sessionId') sessionId: string, @Body() input: OnboardingDataInput) {
    return this.onboarding.analyzeData(sessionId, input);
  }

  @Get('onboarding/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.onboarding.getSession(sessionId);
  }

  @Get('onboarding')
  listSessions(@Query('tenantId') tenantId?: string) {
    return this.onboarding.listSessions(tenantId);
  }

  // ── Adoption Mode ──
  @Get('adoption/:tenantId')
  getAdoptionMode(@Param('tenantId') tenantId: string) {
    return this.adoptionMode.getMode(tenantId);
  }

  @Post('adoption/:tenantId/set')
  setAdoptionMode(@Param('tenantId') tenantId: string, @Body() body: { mode: AdoptionMode }) {
    return this.adoptionMode.setMode(tenantId, body.mode);
  }

  @Get('adoption')
  getAllModes() {
    return this.adoptionMode.getAllModes();
  }
}
