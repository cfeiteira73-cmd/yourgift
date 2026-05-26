import { Module } from '@nestjs/common';
import { ProductionSimulationService } from './production-simulation.service';
import { ProductionSimulationController } from './production-simulation.controller';
import { EventBusModule } from '../events/event-bus.module';

@Module({
  imports: [EventBusModule],
  controllers: [ProductionSimulationController],
  providers: [ProductionSimulationService],
  exports: [ProductionSimulationService],
})
export class ProductionSimulationModule {}
