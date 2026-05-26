import { Module } from '@nestjs/common';
import { SystemStateController } from './system-state.controller';
import { SystemStateService } from './system-state.service';

@Module({
  controllers: [SystemStateController],
  providers: [SystemStateService],
  exports: [SystemStateService],
})
export class SystemStateModule {}
