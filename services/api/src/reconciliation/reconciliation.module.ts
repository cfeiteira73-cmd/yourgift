import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationScheduler } from './reconciliation.scheduler';

@Module({
  controllers: [ReconciliationController],
  providers: [ReconciliationService, ReconciliationScheduler, AdminGuard],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
