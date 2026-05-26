import { Module } from '@nestjs/common';
import { DLQService } from './dlq.service';
import { EventReplayService } from './event-replay.service';
import { EventConsumerService } from './event-consumer.service';
import { EventPlatformController } from './event-platform.controller';

@Module({
  controllers: [EventPlatformController],
  providers: [DLQService, EventReplayService, EventConsumerService],
  exports: [DLQService, EventReplayService, EventConsumerService],
})
export class EventPlatformModule {}
