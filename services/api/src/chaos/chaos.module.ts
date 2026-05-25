import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ChaosEngineService } from './chaos-engine.service';
import { MultiRegionService } from './multi-region.service';
import { ChaosController } from './chaos.controller';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [ChaosController],
  providers: [ChaosEngineService, MultiRegionService],
  exports: [ChaosEngineService, MultiRegionService],
})
export class ChaosModule {}
