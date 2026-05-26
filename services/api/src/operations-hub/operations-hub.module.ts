import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { OperationsHubService } from './operations-hub.service';
import { OperationsHubController } from './operations-hub.controller';

@Module({
  imports: [EventBusModule],
  providers: [OperationsHubService],
  controllers: [OperationsHubController],
  exports: [OperationsHubService],
})
export class OperationsHubModule {}
