import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FailsafeService } from './failsafe.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Controller('failsafe')
@UseGuards(JwtAuthGuard)
export class FailsafeController {
  constructor(
    private readonly failsafe: FailsafeService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      system: this.failsafe.getModeInfo(),
      circuitBreaker: this.circuitBreaker.getStats(),
    };
  }

  @Post('recover')
  recover() {
    this.failsafe.recover();
    this.circuitBreaker.forceClose();
    return {
      success: true,
      system: this.failsafe.getModeInfo(),
      circuitBreaker: this.circuitBreaker.getStats(),
    };
  }
}
