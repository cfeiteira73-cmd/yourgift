/**
 * YourGift OS — Queue Names
 *
 * Each queue has isolated workers and retry strategies.
 * All queues are backed by Redis (Upstash in production).
 */
export const QUEUE_NAMES = {
  // ── Communication ──────────────────────────────────────────────────────────
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',

  // ── AI ─────────────────────────────────────────────────────────────────────
  AI_GENERATION: 'ai-generation',
  AI_BENCHMARK: 'ai-benchmark',
  AI_BRIEF_PARSE: 'ai-brief-parse',

  // ── Procurement ─────────────────────────────────────────────────────────────
  PROCUREMENT_WORKFLOW: 'procurement-workflow',
  PROCUREMENT_DECISION: 'procurement-decision',

  // ── Supplier & Inventory ────────────────────────────────────────────────────
  SUPPLIER_SYNC: 'supplier-sync',
  INVENTORY_SYNC: 'inventory-sync',
  SHIPPING_SYNC: 'shipping-sync',

  // ── Financial ──────────────────────────────────────────────────────────────
  FINANCIAL_AGGREGATION: 'financial-aggregation',
  INVOICE_LIFECYCLE: 'invoice-lifecycle',

  // ── Reports & Exports ──────────────────────────────────────────────────────
  PDF_GENERATION: 'pdf-generation',
  REPORT_GENERATION: 'report-generation',
  BENCHMARK_GENERATION: 'benchmark-generation',

  // ── Onboarding ─────────────────────────────────────────────────────────────
  ONBOARDING_ANALYSIS: 'onboarding-analysis',

  // ── Dead Letter Queue ──────────────────────────────────────────────────────
  DLQ: 'dead-letter-queue',
  DLQ_REPLAY: 'dlq-replay',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default retry strategy per queue category.
 * All queues use exponential backoff.
 */
export const QUEUE_RETRY_CONFIG = {
  email: { attempts: 5, backoff: { type: 'exponential' as const, delay: 2000 } },
  ai: { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } },
  procurement: { attempts: 4, backoff: { type: 'exponential' as const, delay: 3000 } },
  sync: { attempts: 6, backoff: { type: 'exponential' as const, delay: 10000 } },
  financial: { attempts: 5, backoff: { type: 'exponential' as const, delay: 5000 } },
  report: { attempts: 3, backoff: { type: 'exponential' as const, delay: 8000 } },
  default: { attempts: 3, backoff: { type: 'exponential' as const, delay: 3000 } },
} as const;
