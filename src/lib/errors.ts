import { Prisma } from '@prisma/client';
import { logger } from './logger';
import { captureException } from './sentry';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists with unique constraint') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Wraps Prisma database errors and converts them to standard AppError domain errors:
 * - P2002: Unique constraint violation -> ConflictError (409)
 * - P2025: Record not found -> NotFoundError (404)
 * - P2003: Foreign key violation -> AppError (400)
 * - Unexpected errors -> AppError (500) logged with Pino and sent to Sentry
 */
export function handleDatabaseError(error: unknown, entityName = 'Resource'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') || 'field';
        logger.warn({ target, entity: entityName }, `Duplicate unique field: ${target}`);
        throw new ConflictError(`${entityName} with this unique ${target} already exists.`);
      }
      case 'P2025': {
        logger.warn({ entity: entityName }, `${entityName} not found`);
        throw new NotFoundError(`${entityName} was not found.`);
      }
      case 'P2003': {
        logger.warn({ entity: entityName, meta: error.meta }, `Foreign key constraint failed on ${entityName}`);
        throw new AppError(`Related record does not exist for ${entityName}.`, 400, 'FOREIGN_KEY_VIOLATION');
      }
      default: {
        logger.error({ code: error.code, meta: error.meta, entity: entityName }, `Prisma database error: ${error.message}`);
        captureException(error, { entity: entityName, code: error.code });
        throw new AppError('A database error occurred while processing the request.', 500, 'DATABASE_ERROR');
      }
    }
  }

  if (error instanceof AppError) {
    throw error;
  }

  logger.error({ err: error, entity: entityName }, `Unexpected database error on ${entityName}`);
  captureException(error, { entity: entityName });
  throw new AppError('An unexpected internal server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
}
