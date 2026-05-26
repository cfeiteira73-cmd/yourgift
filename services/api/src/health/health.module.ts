import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';

// QueueModule is @Global() — QueueService available without explicit import

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
