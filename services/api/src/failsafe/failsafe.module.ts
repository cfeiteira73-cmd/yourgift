import { Module } from '@nestjs/common';
import { FailsafeService } from './failsafe.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FailsafeController } from './failsafe.controller';

@Module({
  controllers: [FailsafeController],
  providers: [FailsafeService, CircuitBreakerService],
  exports: [FailsafeService, CircuitBreakerService],
})
export class FailsafeModule {}
