import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { LearningLoopService } from './learning-loop.service';
import { WorkflowsController } from './workflows.controller';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowEngineService, LearningLoopService],
  exports: [WorkflowEngineService, LearningLoopService],
})
export class WorkflowsModule {}
