import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationModule } from '../automation/automation.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { MarginProtectionModule } from '../margin-protection/margin-protection.module';
import { DecisionEngineController } from './decision-engine.controller';
import { ProcurementSimulatorService } from './procurement-simulator.service';
import { DecisionEngineService } from './decision-engine.service';
import { DecisionCorrectnessService } from './decision-correctness.service';
import { WhatIfEngineService } from './what-if-engine.service';

// EventBusModule is @Global() — EventBusService is available without explicit import

@Module({
  imports: [PrismaModule, AutomationModule, LogisticsModule, MarginProtectionModule],
  controllers: [DecisionEngineController],
  providers: [ProcurementSimulatorService, DecisionEngineService, DecisionCorrectnessService, WhatIfEngineService],
  exports: [ProcurementSimulatorService, DecisionEngineService, DecisionCorrectnessService, WhatIfEngineService],
})
export class DecisionEngineModule {}
