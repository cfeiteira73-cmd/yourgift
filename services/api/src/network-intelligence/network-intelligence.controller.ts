import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NetworkLearningService, LearningEventParams } from './network-learning.service';
import { GlobalIntelligenceService } from './global-intelligence.service';

@Controller('network-intelligence')
@UseGuards(JwtAuthGuard)
export class NetworkIntelligenceController {
  constructor(
    private readonly learningService: NetworkLearningService,
    private readonly globalIntelligence: GlobalIntelligenceService,
  ) {}

  @Get('stats')
  getStats() {
    return this.learningService.getNetworkStats();
  }

  @Get('suppliers')
  getSupplierScores() {
    return this.globalIntelligence.getSupplierScores();
  }

  @Get('routes')
  getRouteIntelligence() {
    return this.globalIntelligence.getRouteIntelligence();
  }

  @Get('categories')
  getCategoryIntelligence() {
    return this.globalIntelligence.getCategoryIntelligence();
  }

  @Get('benchmarks')
  getBenchmarks() {
    return this.globalIntelligence.getNetworkBenchmarks();
  }

  @Get('benchmark-compare')
  async compareBenchmark(
    @Query('type') type: string,
    @Query('value') value: string,
    @Query('region') region?: string,
    @Query('category') category?: string,
  ) {
    return this.globalIntelligence.getBenchmarkComparison(
      type,
      Number(value),
      { region, category },
    );
  }

  @Get('events')
  getRecentEvents(@Query('limit') limit?: string) {
    return this.globalIntelligence.getRecentLearningEvents(limit ? Number(limit) : 30);
  }

  @Post('learn')
  async recordEvent(@Body() params: LearningEventParams) {
    await this.learningService.recordLearningEvent(params);
    return { success: true };
  }
}
