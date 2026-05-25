import { Module } from '@nestjs/common';
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
