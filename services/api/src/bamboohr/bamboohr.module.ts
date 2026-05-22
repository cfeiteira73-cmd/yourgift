import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { BambooHRService } from './bamboohr.service';
import { BambooHRController } from './bamboohr.controller';

@Module({
  imports: [PrismaModule, EventBusModule],
  providers: [BambooHRService],
  controllers: [BambooHRController],
  exports: [BambooHRService],
})
export class BambooHRModule {}
