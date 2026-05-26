import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { FinancialTruthController } from './financial-truth.controller';
import { FinancialTruthService } from './financial-truth.service';

@Module({
  imports: [EventBusModule],
  providers: [FinancialTruthService],
  controllers: [FinancialTruthController],
  exports: [FinancialTruthService],
})
export class FinancialTruthModule {}
