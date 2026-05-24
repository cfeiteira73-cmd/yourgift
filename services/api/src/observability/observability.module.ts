import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';
import { AIInsightsService } from './ai-insights.service';
import { SentryInterceptor } from './sentry.interceptor';

@Module({
  controllers: [ObservabilityController],
  providers: [
    MetricsService,
    AIInsightsService,
    SentryInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
  exports: [MetricsService, AIInsightsService, SentryInterceptor],
})
export class ObservabilityModule {}
