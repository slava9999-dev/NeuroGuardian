// ============================================
// NeuroGUARDIAN — Monitoring Service
// Wrapper for Sentry or other observability tools
// Version: 1.0.1 | Date: December 2024
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from './logger.js';

let Sentry: any = null;

// Try to initialize Sentry if environment variable is present
// We use dynamic import to avoid hard dependency crash if package is missing
if (process.env.SENTRY_DSN) {
  (async () => {
    try {
      // @ts-expect-error: Dynamic import of optional dependency might fail types check
      const SentryModule = await import('@sentry/node');

      let nodeProfilingIntegration = null;
      try {
        // @ts-expect-error: Dynamic import of optional dependency
        const profiling = await import('@sentry/profiling-node');
        nodeProfilingIntegration = profiling.nodeProfilingIntegration;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        // Profiling not available
      }

      Sentry = SentryModule;

      const integrations = [];
      if (nodeProfilingIntegration) {
        integrations.push(nodeProfilingIntegration());
      }

      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        integrations,
        // Performance Monitoring
        tracesSampleRate: 1.0, // Capture 100% of the transactions
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: 1.0,
      });

      logger.info('✅ Sentry initialized successfully');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      logger.debug('ℹ️ Sentry SDK not installed or failed to initialize. Monitoring disabled.');
    }
  })();
}

/**
 * Capture exception to monitoring system
 */
export function captureException(error: unknown, context?: Record<string, any>): void {
  if (Sentry) {
    Sentry.withScope((scope: any) => {
      if (context) {
        scope.setExtras(context);
        if (context.userId) scope.setUser({ id: String(context.userId) });
      }
      Sentry.captureException(error);
    });
  } else {
    // Fallback to console if Sentry not active
    // Logger already does console.error, so we prevent double logging if called from logger
    if (!context?._fromLogger) {
      console.error('Captured Exception (Simulated Sentry):', error);
      if (context) console.error('Context:', context);
    }
  }
}

/**
 * Capture message to monitoring system
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (Sentry) {
    Sentry.withScope((scope: any) => {
      if (context) scope.setExtras(context);
      Sentry.captureMessage(message, level);
    });
  }
}
