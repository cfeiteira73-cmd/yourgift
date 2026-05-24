import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';
import { AIInsightsService } from './ai-insights.service';
import { SentryInterceptor } from './sentry.interceptor';
import { BetterStackService } from './betterstack.service';

@Module({
  imports: [ConfigModule],
  controllers: [ObservabilityController],
  providers: [
    MetricsService,
    AIInsightsService,
    BetterStackService,
    SentryInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
  exports: [MetricsService, AIInsightsService, BetterStackService, SentryInterceptor],
})
export class ObservabilityModule {}
