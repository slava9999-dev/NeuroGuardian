// ============================================
// NeuroGUARDIAN — Structured Logger
// Centralized logging with PII redaction
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
  userId?: number;
  correlationId?: string;
}

/**
 * Sensitive field patterns to redact
 */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /client[_-]?id/i,
];

/**
 * Redact sensitive values from objects
 */
function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

    if (isSensitive && typeof value === 'string') {
      // Redact but show first 4 chars for debugging
      redacted[key] = value.length > 4 ? `${value.substring(0, 4)}***[REDACTED]` : '***[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  return process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Format log message with context
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  const timestamp = new Date().toISOString();
  const redactedContext = context ? redactSensitiveData(context) : undefined;

  if (isProduction) {
    // 2026 Standard: Pure JSON for structured logging
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(typeof redactedContext === 'object' ? redactedContext : {}),
    });
  }

  // Development: Human-readable format
  const levelUpper = level.toUpperCase().padEnd(5);
  let logLine = `[${timestamp}] ${levelUpper} ${message}`;

  if (redactedContext && Object.keys(redactedContext).length > 0) {
    logLine += ` ${JSON.stringify(redactedContext)}`;
  }

  return logLine;
}

/**
 * Structured logger with automatic PII redaction
 */
export const logger = {
  /**
   * Debug level - only in development or when DEBUG=true
   */
  debug(message: string, context?: LogContext): void {
    if (isDebugEnabled()) {
      console.log(formatLog('debug', message, context));
    }
  },

  /**
   * Info level - general operational messages
   */
  info(message: string, context?: LogContext): void {
    console.log(formatLog('info', message, context));
  },

  /**
   * Warning level - potentially harmful situations
   */
  warn(message: string, context?: LogContext): void {
    console.warn(formatLog('warn', message, context));
  },

  /**
   * Error level - error events that might still allow the app to continue
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: isDebugEnabled() ? error.stack : undefined,
              name: error.name,
            }
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error)
            : String(error),
    };

    console.error(formatLog('error', message, errorContext));
  },
};

/**
 * Create a child logger with persistent context
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (msg: string, ctx?: LogContext) => logger.debug(msg, { ...defaultContext, ...ctx }),
    info: (msg: string, ctx?: LogContext) => logger.info(msg, { ...defaultContext, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { ...defaultContext, ...ctx }),
    error: (msg: string, err?: Error | unknown, ctx?: LogContext) =>
      logger.error(msg, err, { ...defaultContext, ...ctx }),
  };
}
