import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { FulfillmentEngineService } from './fulfillment-engine.service';
import { FulfillmentEngineController } from './fulfillment-engine.controller';

@Module({
  imports: [EventBusModule],
  providers: [FulfillmentEngineService],
  controllers: [FulfillmentEngineController],
  exports: [FulfillmentEngineService],
})
export class FulfillmentEngineModule {}
