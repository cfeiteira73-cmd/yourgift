import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { EventBusModule } from '../events/event-bus.module';
import { ChaosEngineService } from './chaos-engine.service';
import { MultiRegionService } from './multi-region.service';
import { FailoverDrillService } from './failover-drill.service';
import { ChaosController } from './chaos.controller';

@Module({
  imports: [PrismaModule, AdminAuthModule, EventBusModule],
  controllers: [ChaosController],
  providers: [ChaosEngineService, MultiRegionService, FailoverDrillService],
  exports: [ChaosEngineService, MultiRegionService, FailoverDrillService],
})
export class ChaosModule {}
