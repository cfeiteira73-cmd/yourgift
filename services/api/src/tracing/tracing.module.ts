import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TracingService } from './tracing.service';
import { TracingController } from './tracing.controller';

@Module({
  controllers: [TracingController],
  providers: [TracingService, AdminGuard],
  exports: [TracingService],
})
export class TracingModule {}
