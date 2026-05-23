import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { BriefParserService } from './brief-parser.service';
import { ProcurementAgentService } from './procurement-agent.service';
import { ProcurementAgentController } from './procurement-agent.controller';

@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [ProcurementAgentController],
  providers: [BriefParserService, ProcurementAgentService],
  exports: [BriefParserService, ProcurementAgentService],
})
export class ProcurementAgentModule {}
