import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsageMeteringService } from './usage-metering.service';
import { TenantQuotaService } from './tenant-quota.service';
import { TenantEconomicsController } from './tenant-economics.controller';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [TenantEconomicsController],
  providers: [UsageMeteringService, TenantQuotaService],
  exports: [UsageMeteringService, TenantQuotaService],
})
export class TenantEconomicsModule {}
