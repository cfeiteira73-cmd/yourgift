import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  controllers: [ReconciliationController],
  providers: [ReconciliationService, AdminGuard],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
