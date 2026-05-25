import { Module } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import { DriftDetectionService } from './drift-detection.service';
import { OverrideIntelligenceService } from './override-intelligence.service';
import { ShadowDeploymentService } from './shadow-deployment.service';
import { ModelOpsController } from './model-ops.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  providers: [
    ModelRegistryService,
    DriftDetectionService,
    OverrideIntelligenceService,
    ShadowDeploymentService,
  ],
  controllers: [ModelOpsController],
  exports: [
    ModelRegistryService,
    DriftDetectionService,
    OverrideIntelligenceService,
    ShadowDeploymentService,
  ],
})
export class ModelOpsModule {}
