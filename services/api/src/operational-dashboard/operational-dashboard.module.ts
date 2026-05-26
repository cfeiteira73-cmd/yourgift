import { Module } from '@nestjs/common';
import { OperationalDashboardService } from './operational-dashboard.service';
import { OperationalDashboardController } from './operational-dashboard.controller';

@Module({
  controllers: [OperationalDashboardController],
  providers: [OperationalDashboardService],
  exports: [OperationalDashboardService],
})
export class OperationalDashboardModule {}
