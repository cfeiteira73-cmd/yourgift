export const ORDER_STATUSES = [
  'created',
  'paid',
  'approved',
  'producing',
  'shipped',
  'delivered',
  'cancelled',
  'payment_expired',  // Stripe checkout session expired before payment
  'payment_failed',   // Payment intent failed (card declined etc.)
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['paid', 'cancelled', 'payment_expired', 'payment_failed'],
  paid: ['approved', 'cancelled'],
  approved: ['producing', 'cancelled'],
  producing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  payment_expired: ['created'],   // Allow re-creating checkout after expiry
  payment_failed: ['created'],    // Allow retry after failure
};

/**
 * Returns true if transitioning from `from` to `to` is a valid move.
 */
export function validateTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Returns the next logical status in the happy-path flow, or null if terminal.
 */
export function getNextStatus(current: OrderStatus): OrderStatus | null {
  const transitions = VALID_TRANSITIONS[current].filter((s) => s !== 'cancelled');
  return transitions.length > 0 ? transitions[0] : null;
}

/**
 * Returns true if no further transitions are possible (delivered or cancelled).
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
