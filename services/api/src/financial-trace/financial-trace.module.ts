import { Module } from '@nestjs/common';
import { FinancialTraceService } from './financial-trace.service';
import { FinancialTraceController } from './financial-trace.controller';

@Module({
  controllers: [FinancialTraceController],
  providers: [FinancialTraceService],
  exports: [FinancialTraceService],
})
export class FinancialTraceModule {}
