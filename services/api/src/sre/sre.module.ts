import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { QueueModule } from '../queue/queue.module';
import { AutoRemediationService } from './auto-remediation.service';
import { RollbackOrchestratorService } from './rollback-orchestrator.service';
import { SreController } from './sre.controller';

@Module({
  imports: [
    AdminAuthModule,
    ObservabilityModule,
    QueueModule,
  ],
  controllers: [SreController],
  providers: [AutoRemediationService, RollbackOrchestratorService],
  exports: [AutoRemediationService, RollbackOrchestratorService],
})
export class SreModule {}
