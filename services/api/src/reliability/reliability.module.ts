import { Module } from '@nestjs/common';
import { ReliabilityService } from './reliability.service';
import { ReliabilityController } from './reliability.controller';

@Module({
  controllers: [ReliabilityController],
  providers: [ReliabilityService],
  exports: [ReliabilityService],
})
export class ReliabilityModule {}
