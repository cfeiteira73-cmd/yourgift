import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { LandedCostService } from './landed-cost.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LogisticsController],
  providers: [LogisticsService, LandedCostService],
  exports: [LogisticsService, LandedCostService],
})
export class LogisticsModule {}
