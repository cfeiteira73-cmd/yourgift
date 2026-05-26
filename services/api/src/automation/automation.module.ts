import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationService } from './automation.service';
import { RoutingService } from './routing.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AutomationController],
  providers: [AutomationService, RoutingService],
  exports: [AutomationService, RoutingService],
})
export class AutomationModule {}
