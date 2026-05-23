import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';
import { AIInsightsService } from './ai-insights.service';

@Module({
  controllers: [ObservabilityController],
  providers: [MetricsService, AIInsightsService],
  exports: [MetricsService, AIInsightsService],
})
export class ObservabilityModule {}
