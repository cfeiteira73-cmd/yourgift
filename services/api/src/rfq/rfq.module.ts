import { Module } from '@nestjs/common';
import { RfqService } from './rfq.service';
import { RfqController } from './rfq.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, EventBusModule, QueueModule],
  providers: [RfqService],
  controllers: [RfqController],
  exports: [RfqService],
})
export class RfqModule {}
