import { Module } from '@nestjs/common';
import { ProcurementWorkflowService } from './procurement-workflow.service';
import { ProcurementWorkflowController } from './procurement-workflow.controller';
import { PolicyExecutionModule } from '../policy-execution/policy-execution.module';
import { BudgetLedgerModule } from '../budget-ledger/budget-ledger.module';

@Module({
  imports: [PolicyExecutionModule, BudgetLedgerModule],
  providers: [ProcurementWorkflowService],
  controllers: [ProcurementWorkflowController],
  exports: [ProcurementWorkflowService],
})
export class ProcurementWorkflowModule {}
