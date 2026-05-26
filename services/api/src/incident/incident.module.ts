import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { IncidentService } from './incident.service';
import { IncidentController } from './incident.controller';

@Module({
  controllers: [IncidentController],
  providers: [IncidentService, AdminGuard],
  exports: [IncidentService],
})
export class IncidentModule {}
