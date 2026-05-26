import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorePortalService } from './store-portal.service';
import { StorePortalController } from './store-portal.controller';
import { StoreEmployeeGuard } from './store-employee.guard';
import { AllowanceLedgerService } from './allowance-ledger.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [StorePortalService, StoreEmployeeGuard, AllowanceLedgerService],
  controllers: [StorePortalController],
})
export class StorePortalModule {}
