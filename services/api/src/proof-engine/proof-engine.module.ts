import { Module } from '@nestjs/common';
import { ProofEngineService } from './proof-engine.service';
import { OnboardingService } from './onboarding.service';
import { AdoptionModeService } from './adoption-mode.service';
import { ProofEngineController } from './proof-engine.controller';

@Module({
  controllers: [ProofEngineController],
  providers: [ProofEngineService, OnboardingService, AdoptionModeService],
  exports: [ProofEngineService, OnboardingService, AdoptionModeService],
})
export class ProofEngineModule {}
