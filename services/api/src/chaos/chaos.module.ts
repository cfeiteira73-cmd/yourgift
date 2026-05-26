import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { EventBusModule } from '../events/event-bus.module';
import { ChaosEngineService } from './chaos-engine.service';
import { MultiRegionService } from './multi-region.service';
import { FailoverDrillService } from './failover-drill.service';
import { ChaosController } from './chaos.controller';
import { FinancialChaosService } from './financial-chaos.service';

@Module({
  imports: [PrismaModule, AdminAuthModule, EventBusModule],
  controllers: [ChaosController],
  providers: [ChaosEngineService, MultiRegionService, FailoverDrillService, FinancialChaosService],
  exports: [ChaosEngineService, MultiRegionService, FailoverDrillService, FinancialChaosService],
})
export class ChaosModule {}
