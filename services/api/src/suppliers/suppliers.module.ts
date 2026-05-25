import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SlaPredictionService } from './sla-prediction.service';

@Module({
  providers: [SuppliersService, SlaPredictionService],
  controllers: [SuppliersController],
  exports: [SuppliersService, SlaPredictionService],
})
export class SuppliersModule {}
