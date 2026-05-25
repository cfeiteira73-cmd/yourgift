import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityCertificationService } from './security-certification.service';
import { SecurityCertificationController } from './security-certification.controller';
import { EvidenceExportService } from './evidence-export.service';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  providers: [SecurityCertificationService, EvidenceExportService],
  controllers: [SecurityCertificationController],
  exports: [SecurityCertificationService, EvidenceExportService],
})
export class SecurityCertificationModule {}
