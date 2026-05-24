import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntelligenceService } from './intelligence.service';

@Controller('intelligence')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('signals')
  getSignals(@Query('entityType') entityType?: string) {
    return this.intelligence.getSignals(entityType);
  }

  @Get('supplier-scores')
  getSupplierScores() {
    return this.intelligence.getSupplierScores();
  }

  @Get('health')
  getSystemHealth() {
    return this.intelligence.getSystemHealth();
  }

  @Post('recompute')
  recompute() {
    return this.intelligence.recomputeIntelligence();
  }
}
