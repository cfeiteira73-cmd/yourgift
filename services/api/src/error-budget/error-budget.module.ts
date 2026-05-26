import { Module } from '@nestjs/common';
import { ErrorBudgetService } from './error-budget.service';
import { ErrorBudgetController } from './error-budget.controller';

@Module({
  controllers: [ErrorBudgetController],
  providers: [ErrorBudgetService],
  exports: [ErrorBudgetService],
})
export class ErrorBudgetModule {}
