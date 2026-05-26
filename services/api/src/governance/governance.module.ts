import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GovernanceService } from './governance.service';
import { TrustEngineService } from './trust-engine.service';
import { DecisionTraceService } from './decision-trace.service';
import { GovernanceController } from './governance.controller';
import { UnifiedRiskService } from './risk/unified-risk.service';
import { RiskController } from './risk/risk.controller';
import { GdprService } from './gdpr/gdpr.service';
import { GdprController } from './gdpr/gdpr.controller';
import { StabilityService } from './stability.service';
import { StabilityController } from './stability.controller';

@Module({
  controllers: [GovernanceController, RiskController, GdprController, StabilityController],
  providers: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService, GdprService, AdminGuard, StabilityService],
  exports: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService, GdprService, StabilityService],
})
export class GovernanceModule {}
