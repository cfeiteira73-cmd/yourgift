import { Module } from '@nestjs/common';
import { TracingService } from './tracing.service';
import { TracingController } from './tracing.controller';

@Module({
  controllers: [TracingController],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}
