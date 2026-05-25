import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UsageMeteringService } from './usage-metering.service';
import { TenantQuotaService } from './tenant-quota.service';
import { TenantEconomicsController } from './tenant-economics.controller';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [TenantEconomicsController],
  providers: [UsageMeteringService, TenantQuotaService],
  exports: [UsageMeteringService, TenantQuotaService],
})
export class TenantEconomicsModule {}
