// ============================================
// NeuroGUARDIAN — Monitoring Service
// Sentry Integration for Error Tracking & Performance
// Version: 2.0.0 (Stable) | Date: December 2024
// ============================================

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './logger.js';

// Initialize Sentry only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Profiling
    profilesSampleRate: 1.0, // Capture 100% of the profiles
  });
  logger.info('✅ Sentry initialized successfully');
} else {
  logger.debug('ℹ️ Sentry DSN not found. Monitoring is disabled.');
}

/**
 * Capture exception to monitoring system
 */
export function captureException(error: unknown, context?: Record<string, any>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope(scope => {
      if (context) {
        scope.setExtras(context);
        if (context.userId) scope.setUser({ id: String(context.userId) });
      }
      Sentry.captureException(error);
    });
  } else {
    // Fallback: log to console if not already logged by logger
    if (!context?._fromLogger) {
      console.error('Captured Exception (Local):', error);
      if (context && Object.keys(context).length > 0) {
        console.debug('Context:', context);
      }
    }
  }
}

/**
 * Capture message to monitoring system
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' | 'debug' | 'fatal' = 'info',
  context?: Record<string, any>
): void {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context);
      Sentry.captureMessage(message, level);
    });
  }
}
