import { Module } from '@nestjs/common';
import { CustomerLifecycleService } from './customer-lifecycle.service';
import { LifecycleController } from './lifecycle.controller';

@Module({
  controllers: [LifecycleController],
  providers: [CustomerLifecycleService],
  exports: [CustomerLifecycleService],
})
export class LifecycleModule {}
