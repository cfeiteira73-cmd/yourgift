import { Module } from '@nestjs/common';
import { OperationsCenterController } from './operations-center.controller';
import { ProductionOperationsCenterService } from './operations-center.service';

@Module({
  providers: [ProductionOperationsCenterService],
  controllers: [OperationsCenterController],
  exports: [ProductionOperationsCenterService],
})
export class OperationsCenterModule {}
