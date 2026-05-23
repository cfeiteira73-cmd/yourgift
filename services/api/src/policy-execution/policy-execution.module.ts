import { Module } from '@nestjs/common';
import { PolicyExecutionService } from './policy-execution.service';
import { PolicyExecutionController } from './policy-execution.controller';
import { GovernanceModule } from '../governance/governance.module';
import { BudgetLedgerModule } from '../budget-ledger/budget-ledger.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [GovernanceModule, BudgetLedgerModule, AuthModule],
  providers: [PolicyExecutionService],
  controllers: [PolicyExecutionController],
  exports: [PolicyExecutionService],
})
export class PolicyExecutionModule {}
