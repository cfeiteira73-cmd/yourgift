import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { FilePipelineController } from './file-pipeline.controller';
import { FilePipelineService } from './file-pipeline.service';

@Module({
  imports: [EventBusModule],
  controllers: [FilePipelineController],
  providers: [FilePipelineService],
  exports: [FilePipelineService],
})
export class FilePipelineModule {}
