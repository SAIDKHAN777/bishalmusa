import * as Sentry from '@sentry/node';
import { env } from './env';
import { logger } from './logger';

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    logger.info({ environment: env.SENTRY_ENVIRONMENT }, 'Sentry initialized for error tracking');
  } else {
    logger.debug('Sentry DSN not provided; error tracking initialized locally');
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
  logger.error({ err: error, context }, 'Exception captured');
  if (env.SENTRY_DSN) {
    return Sentry.captureException(error, { extra: context });
  }
  return undefined;
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>): string | undefined {
  if (level === 'warning' || level === 'error') {
    logger.warn({ message, context }, 'Sentry alert recorded');
  }
  if (env.SENTRY_DSN) {
    return Sentry.captureMessage(message, { level, extra: context });
  }
  return undefined;
}

initSentry();

export { Sentry };
