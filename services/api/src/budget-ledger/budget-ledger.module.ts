import { Module } from '@nestjs/common';
import { BudgetLedgerService } from './budget-ledger.service';
import { BudgetLedgerController } from './budget-ledger.controller';

@Module({
  providers: [BudgetLedgerService],
  controllers: [BudgetLedgerController],
  exports: [BudgetLedgerService],
})
export class BudgetLedgerModule {}
