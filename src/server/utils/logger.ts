/* eslint-disable @typescript-eslint/no-explicit-any */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  message: string;
  level?: LogLevel;
  context?: Record<string, any>;
  userId?: number | string;
  requestId?: string;
}

class Logger {
  private formatMessage(payload: LogPayload): string {
    const { message, level = 'info', context, userId, requestId } = payload;
    const timestamp = new Date().toISOString();

    const meta = {
      timestamp,
      level,
      userId,
      requestId,
      ...context,
    };

    // In production, we might want to just JSON.stringify the whole thing for log aggregators
    // But for local/Vercel logs, a hybrid approach is often good.
    // We'll stick to JSON structure for reliable parsing.
    return JSON.stringify({
      msg: message,
      ...meta,
    });
  }

  info(message: string, context?: Record<string, any>, userId?: number | string) {
    console.log(this.formatMessage({ message, level: 'info', context, userId }));
  }

  warn(message: string, context?: Record<string, any>, userId?: number | string) {
    console.warn(this.formatMessage({ message, level: 'warn', context, userId }));
  }

  error(message: string, error?: any, context?: Record<string, any>, userId?: number | string) {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error;

    console.error(
      this.formatMessage({
        message,
        level: 'error',
        context: { ...context, error: errorDetails },
        userId,
      })
    );
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage({ message, level: 'debug', context }));
    }
  }
}

export const logger = new Logger();
