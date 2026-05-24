import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import { AIInsightsService } from './ai-insights.service';

@Controller('observability')
@UseGuards(JwtAuthGuard)
export class ObservabilityController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly aiInsights: AIInsightsService,
  ) {}

  @Get('snapshots')
  async getSnapshots(
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
  ) {
    return this.metrics.getSnapshots(limit);
  }

  @Post('snapshots/take')
  @HttpCode(HttpStatus.OK)
  async takeSnapshot() {
    return this.metrics.takeSnapshot();
  }

  @Get('latency')
  async getLatency(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return this.metrics.getLatencyStats(hours);
  }

  @Get('event-metrics')
  async getEventMetrics(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number,
  ) {
    return this.metrics.getEventProcessingStats(hours);
  }

  @Get('alerts')
  async getAlerts() {
    return this.metrics.getOpenAlerts();
  }

  @Post('alerts/detect')
  @HttpCode(HttpStatus.OK)
  async detectAlerts() {
    await this.metrics.runAlertDetection();
    return { ok: true };
  }

  @Post('alerts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('id') id: string) {
    await this.metrics.resolveAlert(id);
    return { ok: true };
  }

  @Get('ai-insights')
  getAIInsights() {
    return this.aiInsights.generateInsights();
  }
}
