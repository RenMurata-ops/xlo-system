/**
 * Unified Error Handling for Supabase Edge Functions
 *
 * Provides consistent error handling with:
 * - Type-safe error classes
 * - HTTP status code mapping
 * - Structured error responses
 * - Integration with structured logger
 *
 * Usage:
 *   throw new BadRequestError('Invalid input', { field: 'email' });
 *   throw new UnauthorizedError('Invalid token');
 *
 *   // In catch block:
 *   return handleError(error, logger);
 */

import { type Logger } from './logger.ts';
import { getCorsHeaders } from './cors.ts';

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input
 */
export class BadRequestError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, 'BAD_REQUEST', context);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
    super(message, 401, 'UNAUTHORIZED', context);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', context);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 404, 'NOT_FOUND', context);
  }
}

/**
 * 409 Conflict - Resource conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', context);
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 422, 'VALIDATION_ERROR', context);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', context?: Record<string, unknown>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', context);
  }
}

/**
 * 500 Internal Server Error - Generic server error
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', context?: Record<string, unknown>) {
    super(message, 500, 'INTERNAL_ERROR', context);
  }
}

/**
 * 502 Bad Gateway - External service error
 */
export class ExternalServiceError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', context);
  }
}

/**
 * 503 Service Unavailable - Temporary service issue
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', context?: Record<string, unknown>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', context);
  }
}

/**
 * Error response structure
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Convert error to structured response
 */
function errorToResponse(error: unknown): { response: ErrorResponse; statusCode: number } {
  if (error instanceof AppError) {
    return {
      response: {
        error: {
          code: error.code,
          message: error.message,
          context: error.context,
        },
      },
      statusCode: error.statusCode,
    };
  }

  // Handle standard Error
  if (error instanceof Error) {
    return {
      response: {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
        },
      },
      statusCode: 500,
    };
  }

  // Handle unknown errors
  return {
    response: {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    },
    statusCode: 500,
  };
}

/**
 * Handle error and return HTTP response
 *
 * @param error - Error to handle
 * @param logger - Optional logger for error logging
 * @returns Response object
 *
 * @example
 * try {
 *   // ... operation
 * } catch (error) {
 *   return handleError(error, logger);
 * }
 */
export function handleError(error: unknown, logger?: Logger): Response {
  const { response, statusCode } = errorToResponse(error);

  // Log error if logger provided
  if (logger) {
    const logContext = {
      code: response.error.code,
      message: response.error.message,
      statusCode,
      ...response.error.context,
    };

    if (statusCode >= 500) {
      logger.error('Internal error', logContext);
    } else if (statusCode >= 400) {
      logger.warn('Client error', logContext);
    }
  }

  return new Response(
    JSON.stringify(response),
    {
      status: statusCode,
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Assert condition and throw error if false
 *
 * @param condition - Condition to check
 * @param error - Error to throw if condition is false
 *
 * @example
 * assert(userId, new BadRequestError('User ID is required'));
 * assert(user.isActive, new ForbiddenError('User is not active'));
 */
export function assert(condition: unknown, error: AppError): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Wrap async operation with error handling
 *
 * @param operation - Async operation to execute
 * @param logger - Logger instance
 * @returns Response or error response
 *
 * @example
 * return await withErrorHandling(async () => {
 *   const result = await doSomething();
 *   return new Response(JSON.stringify({ success: true }));
 * }, logger);
 */
export async function withErrorHandling(
  operation: () => Promise<Response>,
  logger?: Logger
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    return handleError(error, logger);
  }
}
