import { Module } from '@nestjs/common';
import { SupplierIntelligenceService } from './supplier-intelligence.service';
import { SupplierIntelligenceController } from './supplier-intelligence.controller';
import { EventBusModule } from '../events/event-bus.module';

@Module({
  imports: [EventBusModule],
  controllers: [SupplierIntelligenceController],
  providers: [SupplierIntelligenceService],
  exports: [SupplierIntelligenceService],
})
export class SupplierIntelligenceModule {}
