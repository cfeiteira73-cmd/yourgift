import { Module } from '@nestjs/common';
import { EventBusModule } from '../events/event-bus.module';
import { ProductionPipelineService } from './production-pipeline.service';
import { ProductionPipelineController } from './production-pipeline.controller';

@Module({
  imports: [EventBusModule],
  providers: [ProductionPipelineService],
  controllers: [ProductionPipelineController],
  exports: [ProductionPipelineService],
})
export class ProductionPipelineModule {}
