import { Module } from '@nestjs/common';
import { StripeRecoveryService } from './stripe-recovery.service';
import { StripeRecoveryController } from './stripe-recovery.controller';

@Module({
  controllers: [StripeRecoveryController],
  providers: [StripeRecoveryService],
  exports: [StripeRecoveryService],
})
export class StripeRecoveryModule {}
