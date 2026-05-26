import { Module } from '@nestjs/common';
import { ProductionActivationService } from './production-activation.service';
import { ProductionActivationController } from './production-activation.controller';

@Module({
  controllers: [ProductionActivationController],
  providers: [ProductionActivationService],
  exports: [ProductionActivationService],
})
export class ProductionActivationModule {}
