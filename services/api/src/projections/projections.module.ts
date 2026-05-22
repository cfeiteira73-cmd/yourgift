import { Module } from '@nestjs/common';
import { ProjectionsService } from './projections.service';
import { ProjectionsController } from './projections.controller';

@Module({
  controllers: [ProjectionsController],
  providers: [ProjectionsService],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
