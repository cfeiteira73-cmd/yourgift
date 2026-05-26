import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { QueueModule } from '../queue/queue.module';
import { SreModule } from '../sre/sre.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { ControlPlaneService } from './control-plane.service';
import { ControlPlaneController } from './control-plane.controller';

@Module({
  imports: [
    PrismaModule,
    EventBusModule,
    AdminAuthModule,
    ObservabilityModule,
    QueueModule,
    SreModule,
    ReconciliationModule,
  ],
  controllers: [ControlPlaneController],
  providers: [ControlPlaneService],
  exports: [ControlPlaneService],
})
export class ControlPlaneModule {}
