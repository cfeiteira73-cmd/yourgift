import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationScheduler } from './reconciliation.scheduler';
import { StripeReconciliationService } from './stripe-reconciliation.service';
import { StripeReconciliationController } from './stripe-reconciliation.controller';

@Module({
  controllers: [ReconciliationController, StripeReconciliationController],
  providers: [ReconciliationService, ReconciliationScheduler, StripeReconciliationService, AdminGuard],
  exports: [ReconciliationService, StripeReconciliationService],
})
export class ReconciliationModule {}
