import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { ShipmentTrackingController } from './shipment-tracking.controller';

@Module({
  imports: [EventBusModule],
  providers: [ShipmentTrackingService],
  controllers: [ShipmentTrackingController],
  exports: [ShipmentTrackingService],
})
export class ShipmentTrackingModule {}
