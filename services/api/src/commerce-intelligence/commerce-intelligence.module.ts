import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CommerceIntelligenceService } from './commerce-intelligence.service';
import { CommerceIntelligenceController } from './commerce-intelligence.controller';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  controllers: [CommerceIntelligenceController],
  providers: [CommerceIntelligenceService],
  exports: [CommerceIntelligenceService],
})
export class CommerceIntelligenceModule {}
