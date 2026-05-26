import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { FailureLabController } from './failure-lab.controller';
import { ProductionFailureLabService } from './failure-lab.service';

@Module({
  imports: [EventBusModule],
  controllers: [FailureLabController],
  providers: [ProductionFailureLabService],
  exports: [ProductionFailureLabService],
})
export class FailureLabModule {}
