import { Module } from '@nestjs/common';
import { SupplierRoutingService } from './supplier-routing.service';
import { SupplierRoutingController } from './supplier-routing.controller';
import { EventBusModule } from '../events/event-bus.module';

@Module({
  imports: [EventBusModule],
  controllers: [SupplierRoutingController],
  providers: [SupplierRoutingService],
  exports: [SupplierRoutingService],
})
export class SupplierRoutingModule {}
