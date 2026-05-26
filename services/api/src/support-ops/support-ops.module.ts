import { Module } from '@nestjs/common';
import { SupportOpsController } from './support-ops.controller';
import { SupportOperationsService } from './support-ops.service';

@Module({
  controllers: [SupportOpsController],
  providers: [SupportOperationsService],
  exports: [SupportOperationsService],
})
export class SupportOpsModule {}
