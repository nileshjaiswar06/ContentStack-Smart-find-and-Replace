import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Custom error class for application-specific errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string | undefined;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string | undefined) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types specific to our find-and-replace application
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  CONTENTSTACK_API = 'CONTENTSTACK_API_ERROR',
  REPLACEMENT_RULE = 'REPLACEMENT_RULE_ERROR',
  BULK_OPERATION = 'BULK_OPERATION_ERROR',
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND_ERROR',
  INTERNAL = 'INTERNAL_ERROR'
}

// Enhanced error response interface
interface ErrorResponse {
  ok: false;
  error: string;
  type: string;
  code?: string | undefined;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  path: string;
  method: string;
  details?: any;
}

// Main error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorType = ErrorType.INTERNAL;
  let code: string | undefined;
  let details: any = {};

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    errorType = getErrorTypeFromStatusCode(statusCode);
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorType = ErrorType.VALIDATION;
    details = { validationErrors: error.message };
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    errorType = ErrorType.VALIDATION;
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    statusCode = 400;
    message = 'Invalid JSON format';
    errorType = ErrorType.VALIDATION;
  } else if (error.message.includes('Contentstack')) {
    statusCode = 502;
    message = 'Contentstack service unavailable';
    errorType = ErrorType.CONTENTSTACK_API;
  } else if (error.message.includes('not found') || error.message.includes('404')) {
    statusCode = 404;
    message = 'Resource not found';
    errorType = ErrorType.ENTRY_NOT_FOUND;
  }

  // Don't leak error details in production for non-operational errors
  if (process.env.NODE_ENV === 'production' && !(error instanceof AppError)) {
    message = 'Something went wrong';
    details = {};
  }

  const requestId = (req as any).requestId;

  // Prepare error response
  const errorResponse: ErrorResponse = {
    ok: false,
    error: message,
    type: errorType,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
    path: req.originalUrl,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { details })
  };
  // Log concise message and include requestId for traceability
  logger.error(`[ErrorHandler] ${message}`, requestId, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    statusCode,
    errorType,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, true, 'ROUTE_NOT_FOUND');
  next(error);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper function to determine error type from status code
const getErrorTypeFromStatusCode = (statusCode: number): ErrorType => {
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      return ErrorType.VALIDATION;
    }
    if (statusCode === 404) return ErrorType.ENTRY_NOT_FOUND;
    return ErrorType.VALIDATION;
  }
  return ErrorType.INTERNAL;
};

// Specific error handlers for Contentstack operations
export const contentstackErrorHandler = (error: any) => {
  // Try to extract axios response data for richer errors (e.g., 422 validation details)
  const axiosData = error?.response?.data;
  const statusCode = error?.response?.status ?? error?.statusCode ?? 500;
  const message = axiosData?.error || axiosData?.message || error?.message || 'Unknown error';
  const details = axiosData ?? undefined;

  if (statusCode === 401) {
    throw new AppError('Invalid Contentstack credentials', 401, true, 'INVALID_CREDENTIALS');
  } else if (statusCode === 404) {
    throw new AppError('Contentstack resource not found', 404, true, 'RESOURCE_NOT_FOUND');
  } else {
    const appErr = new AppError(
      `Contentstack API error: ${message}`,
      statusCode,
      true,
      'CONTENTSTACK_API_ERROR'
    );
    // attach axios response details in development for debugging
    (appErr as any).details = details;
    throw appErr;
  }
};

// Validation error handler for replacement rules
export const replacementRuleErrorHandler = (rule: any) => {
  if (!rule.find) {
    throw new AppError('Replacement rule must have a "find" pattern', 400, true, 'INVALID_RULE');
  }
  
  if (typeof rule.replace === 'undefined') {
    throw new AppError('Replacement rule must have a "replace" value', 400, true, 'INVALID_RULE');
  }

};

// Bulk operation error handler
export const bulkOperationErrorHandler = (entryUids: string[], maxEntries: number = 50) => {
  if (!entryUids || !Array.isArray(entryUids)) {
    throw new AppError('Entry UIDs must be an array', 400, true, 'INVALID_ENTRY_UIDS');
  }

  if (entryUids.length === 0) {
    throw new AppError('No entry UIDs provided', 400, true, 'NO_ENTRY_UIDS');
  }

  if (entryUids.length > maxEntries) {
    throw new AppError(
      `Maximum ${maxEntries} entries can be processed at once`,
      400,
      true,
      'MAX_ENTRIES_EXCEEDED'
    );
  }
};

// Global error handlers for unhandled rejections and exceptions
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
};

export const handleUncaughtException = (error: Error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

// Set up global error handlers in development only
if (process.env.NODE_ENV === 'development') {
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
}
