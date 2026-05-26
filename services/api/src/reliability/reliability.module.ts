import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReliabilityService } from './reliability.service';
import { ReliabilityController } from './reliability.controller';

@Module({
  controllers: [ReliabilityController],
  providers: [ReliabilityService, AdminGuard],
  exports: [ReliabilityService],
})
export class ReliabilityModule {}
