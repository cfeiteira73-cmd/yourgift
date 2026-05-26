import { Module } from '@nestjs/common';
import { AccrualService } from './accrual.service';
import { CostAllocationService } from './cost-allocation.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { FinancialIntelligenceController } from './financial-intelligence.controller';

@Module({
  controllers: [FinancialIntelligenceController],
  providers: [AccrualService, CostAllocationService, FinancialIntelligenceService],
  exports: [AccrualService, CostAllocationService, FinancialIntelligenceService],
})
export class FinancialIntelligenceModule {}
