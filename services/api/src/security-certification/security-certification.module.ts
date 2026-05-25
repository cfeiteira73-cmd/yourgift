import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityCertificationService } from './security-certification.service';
import { SecurityCertificationController } from './security-certification.controller';

@Module({
  imports: [PrismaModule, EventBusModule, AdminAuthModule],
  providers: [SecurityCertificationService],
  controllers: [SecurityCertificationController],
  exports: [SecurityCertificationService],
})
export class SecurityCertificationModule {}
