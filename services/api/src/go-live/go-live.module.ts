import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { GoLiveController } from './go-live.controller';
import { LiveMoneyGateService } from './go-live.service';

@Module({
  imports: [EventBusModule],
  controllers: [GoLiveController],
  providers: [LiveMoneyGateService],
  exports: [LiveMoneyGateService],
})
export class GoLiveModule {}
