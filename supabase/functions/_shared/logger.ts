/**
 * Structured Logger for Supabase Edge Functions
 *
 * Provides consistent, structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Automatic timestamp
 * - Correlation IDs for request tracing
 * - Structured context data
 *
 * Usage:
 *   const logger = createLogger('function-name');
 *   logger.info('Processing request', { userId: '123' });
 *   logger.error('Failed to process', { error: err.message });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  withContext(context: LogContext): Logger;
}

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  function: string;
  message: string;
  context?: LogContext;
  correlationId?: string;
}

// Environment-based log level configuration
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLogLevel(): LogLevel {
  const envLevel = Deno.env.get('LOG_LEVEL')?.toLowerCase() as LogLevel;
  return envLevel && envLevel in LOG_LEVEL_PRIORITY ? envLevel : 'info';
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

class LoggerImpl implements Logger {
  constructor(
    private functionName: string,
    private baseContext: LogContext = {},
    private correlationId?: string
  ) {}

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      function: this.functionName,
      message,
      context: { ...this.baseContext, ...context },
    };

    if (this.correlationId) {
      entry.correlationId = this.correlationId;
    }

    // Output as JSON for structured logging
    console.log(JSON.stringify(entry));
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  withContext(context: LogContext): Logger {
    return new LoggerImpl(
      this.functionName,
      { ...this.baseContext, ...context },
      this.correlationId
    );
  }
}

/**
 * Create a logger instance for an Edge Function
 *
 * @param functionName - Name of the Edge Function
 * @param correlationId - Optional correlation ID for request tracing
 * @returns Logger instance
 *
 * @example
 * const logger = createLogger('refresh-tokens', req.headers.get('x-correlation-id'));
 * logger.info('Starting token refresh', { count: tokens.length });
 */
export function createLogger(
  functionName: string,
  correlationId?: string
): Logger {
  return new LoggerImpl(functionName, {}, correlationId);
}

/**
 * Extract correlation ID from request headers
 *
 * @param req - Request object
 * @returns Correlation ID or generated UUID
 */
export function getCorrelationId(req: Request): string {
  return (
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID()
  );
}
