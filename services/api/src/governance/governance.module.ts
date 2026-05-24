import { Module } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { TrustEngineService } from './trust-engine.service';
import { DecisionTraceService } from './decision-trace.service';
import { GovernanceController } from './governance.controller';
import { UnifiedRiskService } from './risk/unified-risk.service';
import { RiskController } from './risk/risk.controller';

@Module({
  controllers: [GovernanceController, RiskController],
  providers: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService],
  exports: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService],
})
export class GovernanceModule {}
