import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ProductionLearningLoopService } from './production-learning-loop.service';
import { LearningLoopController } from './learning-loop.controller';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  providers: [ProductionLearningLoopService],
  controllers: [LearningLoopController],
  exports: [ProductionLearningLoopService],
})
export class LearningLoopModule {}
