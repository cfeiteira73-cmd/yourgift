import { Module } from '@nestjs/common';
import { CustomerOpsService } from './customer-ops.service';
import { CustomerOpsController } from './customer-ops.controller';

@Module({
  controllers: [CustomerOpsController],
  providers: [CustomerOpsService],
  exports: [CustomerOpsService],
})
export class CustomerOpsModule {}
