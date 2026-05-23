import { Module } from '@nestjs/common';
import { NetworkLearningService } from './network-learning.service';
import { GlobalIntelligenceService } from './global-intelligence.service';
import { NetworkIntelligenceController } from './network-intelligence.controller';

@Module({
  controllers: [NetworkIntelligenceController],
  providers: [NetworkLearningService, GlobalIntelligenceService],
  exports: [NetworkLearningService, GlobalIntelligenceService],
})
export class NetworkIntelligenceModule {}
