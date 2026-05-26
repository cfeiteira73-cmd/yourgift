import { Module } from '@nestjs/common';
import { EventSourcingService } from './event-sourcing.service';
import { EventSourcingController } from './event-sourcing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';

@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [EventSourcingController],
  providers: [EventSourcingService],
  exports: [EventSourcingService],
})
export class EventSourcingModule {}
