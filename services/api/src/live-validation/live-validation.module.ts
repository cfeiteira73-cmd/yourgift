import { Module } from '@nestjs/common';
import { LiveValidationController } from './live-validation.controller';
import { RealTransactionValidationService } from './live-validation.service';

@Module({
  imports: [],
  controllers: [LiveValidationController],
  providers: [RealTransactionValidationService],
  exports: [RealTransactionValidationService],
})
export class LiveValidationModule {}
