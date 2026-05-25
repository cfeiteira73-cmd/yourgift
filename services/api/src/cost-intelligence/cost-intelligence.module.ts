import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CostIntelligenceService } from './cost-intelligence.service';
import { CostIntelligenceController } from './cost-intelligence.controller';
import { CostPerRequestInterceptor } from './cost-per-request.interceptor';
import { AiEconomicsService } from './ai-economics.service';
import { InfraCostOptimizerService } from './infra-cost-optimizer.service';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  providers: [
    CostIntelligenceService,
    CostPerRequestInterceptor,
    AiEconomicsService,
    InfraCostOptimizerService,
    // Register as global interceptor — runs on EVERY HTTP request
    {
      provide: APP_INTERCEPTOR,
      useClass: CostPerRequestInterceptor,
    },
  ],
  controllers: [CostIntelligenceController],
  exports: [
    CostIntelligenceService,
    CostPerRequestInterceptor,
    AiEconomicsService,
    InfraCostOptimizerService,
  ],
})
export class CostIntelligenceModule {}
