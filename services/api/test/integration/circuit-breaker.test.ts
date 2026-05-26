/**
 * Integration tests — CircuitBreakerService
 *
 * Tests the state-machine logic of the circuit breaker:
 *   CLOSED → OPEN (after threshold failures)
 *   OPEN   → HALF_OPEN (after reset timeout elapses)
 *   HALF_OPEN → CLOSED (on successful probe)
 *   HALF_OPEN → OPEN (on failure during probe)
 */

import { CircuitBreakerService } from '../../src/failsafe/circuit-breaker.service';

// The circuit breaker constants from the service
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;

describe('CircuitBreakerService', () => {
  let svc: CircuitBreakerService;

  beforeEach(() => {
    svc = new CircuitBreakerService();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it('starts in CLOSED state', () => {
    expect(svc.getState()).toBe('CLOSED');
  });

  it('initial stats reflect zero failures', () => {
    const stats = svc.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureAt).toBeNull();
    expect(stats.openedAt).toBeNull();
  });

  // ── CLOSED → OPEN (threshold) ────────────────────────────────────────────

  it('stays CLOSED below failure threshold', () => {
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
      svc.recordFailure();
    }
    expect(svc.getState()).toBe('CLOSED');
  });

  it('opens circuit after reaching failure threshold', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    expect(svc.getState()).toBe('OPEN');
  });

  it('tracks failure count and timestamps after tripping', () => {
    const before = Date.now();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    const stats = svc.getStats();
    expect(stats.failureCount).toBe(FAILURE_THRESHOLD);
    expect(stats.lastFailureAt).not.toBeNull();
    expect(stats.openedAt).not.toBeNull();
    expect(stats.openedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  // ── OPEN → HALF_OPEN (timeout) ───────────────────────────────────────────

  it('transitions to HALF_OPEN after reset timeout', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    expect(svc.getState()).toBe('OPEN');

    // Backdating openedAt to simulate timeout elapsed
    const stats = svc.getStats();
    (svc as unknown as { openedAt: Date }).openedAt = new Date(
      Date.now() - RESET_TIMEOUT_MS - 1,
    );

    expect(svc.getState()).toBe('HALF_OPEN');
  });

  // ── HALF_OPEN → CLOSED (success probe) ──────────────────────────────────

  it('closes circuit on success in HALF_OPEN state', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    // Force to HALF_OPEN
    (svc as unknown as { openedAt: Date }).openedAt = new Date(
      Date.now() - RESET_TIMEOUT_MS - 1,
    );
    expect(svc.getState()).toBe('HALF_OPEN');

    svc.recordSuccess();
    expect(svc.getState()).toBe('CLOSED');
  });

  it('resets failure count and timestamps after closing from HALF_OPEN', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    (svc as unknown as { openedAt: Date }).openedAt = new Date(
      Date.now() - RESET_TIMEOUT_MS - 1,
    );
    svc.getState(); // trigger HALF_OPEN transition
    svc.recordSuccess();

    const stats = svc.getStats();
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureAt).toBeNull();
    expect(stats.openedAt).toBeNull();
  });

  // ── HALF_OPEN → OPEN (failure during probe) ──────────────────────────────

  it('re-opens circuit on failure in HALF_OPEN state', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    (svc as unknown as { openedAt: Date }).openedAt = new Date(
      Date.now() - RESET_TIMEOUT_MS - 1,
    );
    expect(svc.getState()).toBe('HALF_OPEN');

    svc.recordFailure();
    expect(svc.getState()).toBe('OPEN');
  });

  // ── recordSuccess no-op when CLOSED ─────────────────────────────────────

  it('recordSuccess is a no-op when state is CLOSED', () => {
    svc.recordSuccess(); // should not throw or change anything
    expect(svc.getState()).toBe('CLOSED');
    expect(svc.getStats().failureCount).toBe(0);
  });

  // ── Force operations ─────────────────────────────────────────────────────

  it('forceOpen trips the circuit immediately', () => {
    svc.forceOpen();
    expect(svc.getState()).toBe('OPEN');
    expect(svc.getStats().openedAt).not.toBeNull();
  });

  it('forceClose resets from OPEN state', () => {
    svc.forceOpen();
    expect(svc.getState()).toBe('OPEN');

    svc.forceClose();
    expect(svc.getState()).toBe('CLOSED');
    expect(svc.getStats().failureCount).toBe(0);
  });

  it('forceOpen followed by forceClose clears all state', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    svc.forceClose();
    const stats = svc.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureAt).toBeNull();
    expect(stats.openedAt).toBeNull();
  });

  // ── Exponential backoff simulation ───────────────────────────────────────

  it('reset timeout controls HALF_OPEN window — early check stays OPEN', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    // Only 1 second has elapsed — not yet RESET_TIMEOUT_MS
    (svc as unknown as { openedAt: Date }).openedAt = new Date(
      Date.now() - 1_000,
    );
    expect(svc.getState()).toBe('OPEN');
  });

  // ── Idempotency: extra failures in OPEN don't change state ───────────────

  it('additional failures in OPEN state keep circuit OPEN', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      svc.recordFailure();
    }
    expect(svc.getState()).toBe('OPEN');

    // Record more failures — should not change to HALF_OPEN or any other state
    svc.recordFailure();
    svc.recordFailure();

    // Without timeout elapsed, state must remain OPEN
    (svc as unknown as { openedAt: Date }).openedAt = new Date(); // reset time
    expect(svc.getState()).toBe('OPEN');
  });
});
