import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Sentry Initialization
 *
 * Called ONCE at the very start of main.ts — before anything else.
 * DSN is read from SENTRY_DSN env var. No-op if not set (dev / CI).
 *
 * Required env vars:
 *   SENTRY_DSN=https://xxxx@oXXX.ingest.sentry.io/NNNN
 *   SENTRY_ENVIRONMENT=production|staging|development (defaults to NODE_ENV)
 *   SENTRY_TRACES_SAMPLE_RATE=0.1 (default)
 *   SENTRY_PROFILES_SAMPLE_RATE=0.1 (default)
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Not configured — skip silently. Sentry calls are no-ops.
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION ?? 'unknown',

    // Performance monitoring
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

    // Profiling (requires @sentry/profiling-node)
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),

    integrations: [
      nodeProfilingIntegration(),
    ],

    // Scrub sensitive data from breadcrumbs / extra
    beforeSend(event) {
      // Strip auth headers from request data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },

    // Attach request data (url, method, headers sans auth, ip)
    sendDefaultPii: false,

    // Ignore common noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
}

/**
 * Capture an exception manually (outside of the global filter).
 * Safe to call even if Sentry is not configured.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

/**
 * Set user context on the current Sentry scope.
 * Call this after JWT authentication so errors are attributed to users.
 */
export function setSentryUser(user: { id: string; email?: string; tenantId?: string }): void {
  Sentry.setUser({ id: user.id, email: user.email, segment: user.tenantId });
}

/**
 * Add a breadcrumb for business-logic events (not errors).
 * Examples: 'order.created', 'payment.captured', 'procurement.approved'
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.addBreadcrumb({ message, data, level, timestamp: Date.now() / 1000 });
}
