import { Module } from '@nestjs/common';
import { NetworkLearningService } from './network-learning.service';
import { GlobalIntelligenceService } from './global-intelligence.service';
import { NetworkIntelligenceController } from './network-intelligence.controller';
import { AnonymizationService } from './anonymization.service';

@Module({
  controllers: [NetworkIntelligenceController],
  providers: [NetworkLearningService, GlobalIntelligenceService, AnonymizationService],
  exports: [NetworkLearningService, GlobalIntelligenceService, AnonymizationService],
})
export class NetworkIntelligenceModule {}
