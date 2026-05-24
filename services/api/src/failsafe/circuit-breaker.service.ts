import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureAt: Date | null = null;
  private openedAt: Date | null = null;

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= RESET_TIMEOUT_MS) {
        this.state = 'HALF_OPEN';
        this.logger.log('Circuit breaker transitioned to HALF_OPEN');
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.reset();
      this.logger.log('Circuit breaker closed after successful probe');
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = new Date();

    if (this.state === 'HALF_OPEN') {
      this.trip();
      return;
    }

    if (this.state === 'CLOSED' && this.failureCount >= FAILURE_THRESHOLD) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.openedAt = new Date();
    this.logger.warn(
      `Circuit breaker OPEN after ${this.failureCount} failures`,
    );
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
  }

  forceOpen(): void {
    this.trip();
  }

  forceClose(): void {
    this.reset();
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    lastFailureAt: Date | null;
    openedAt: Date | null;
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      openedAt: this.openedAt,
    };
  }
}
