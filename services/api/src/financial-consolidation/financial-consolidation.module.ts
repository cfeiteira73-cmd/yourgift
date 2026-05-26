import { Module } from '@nestjs/common';
import { FinancialConsolidationService } from './financial-consolidation.service';
import { BudgetAnomalyService } from './budget-anomaly.service';
import { FinancialConsolidationController } from './financial-consolidation.controller';

@Module({
  controllers: [FinancialConsolidationController],
  providers: [FinancialConsolidationService, BudgetAnomalyService],
  exports: [FinancialConsolidationService, BudgetAnomalyService],
})
export class FinancialConsolidationModule {}
