import { Module } from '@nestjs/common';
import { DeploymentSafetyService } from './deployment-safety.service';
import { DeploymentSafetyController } from './deployment-safety.controller';
import { ErrorBudgetModule } from '../error-budget/error-budget.module';

@Module({
  imports: [ErrorBudgetModule],
  controllers: [DeploymentSafetyController],
  providers: [DeploymentSafetyService],
  exports: [DeploymentSafetyService],
})
export class DeploymentSafetyModule {}
