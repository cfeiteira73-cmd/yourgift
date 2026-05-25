import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CostIntelligenceService } from './cost-intelligence.service';
import { CostIntelligenceController } from './cost-intelligence.controller';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  providers: [CostIntelligenceService],
  controllers: [CostIntelligenceController],
  exports: [CostIntelligenceService],
})
export class CostIntelligenceModule {}
