import { Module } from '@nestjs/common';
import { FinancialCausalityController } from './financial-causality.controller';
import { FinancialCausalityService } from './financial-causality.service';

@Module({
  controllers: [FinancialCausalityController],
  providers: [FinancialCausalityService],
  exports: [FinancialCausalityService],
})
export class FinancialCausalityModule {}
