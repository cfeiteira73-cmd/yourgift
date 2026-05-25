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

@Module({
  controllers: [GovernanceController, RiskController, GdprController],
  providers: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService, GdprService, AdminGuard],
  exports: [GovernanceService, TrustEngineService, DecisionTraceService, UnifiedRiskService, GdprService],
})
export class GovernanceModule {}
