import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController } from './support-tickets.controller';

@Module({
  imports: [EventBusModule],
  providers: [SupportTicketsService],
  controllers: [SupportTicketsController],
  exports: [SupportTicketsService],
})
export class SupportTicketsModule {}
