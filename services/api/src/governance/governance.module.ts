import { Module } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { TrustEngineService } from './trust-engine.service';
import { DecisionTraceService } from './decision-trace.service';
import { GovernanceController } from './governance.controller';

@Module({
  controllers: [GovernanceController],
  providers: [GovernanceService, TrustEngineService, DecisionTraceService],
  exports: [GovernanceService, TrustEngineService, DecisionTraceService],
})
export class GovernanceModule {}
