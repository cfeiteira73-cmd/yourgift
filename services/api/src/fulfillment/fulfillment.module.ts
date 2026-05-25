import { Module } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service';
import { FulfillmentController } from './fulfillment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';

@Module({
  imports: [PrismaModule, EventBusModule],
  providers: [FulfillmentService],
  controllers: [FulfillmentController],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
