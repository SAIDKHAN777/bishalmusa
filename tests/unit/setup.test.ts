import { describe, it, expect } from 'vitest';
import { env } from '../../src/lib/env';
import { logger } from '../../src/lib/logger';
import { captureException } from '../../src/lib/sentry';

describe('Project Setup & Core Infrastructure', () => {
  it('should successfully validate environment variables with Zod', () => {
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBe(4322);
    expect(env.ADMIN_EMAIL).toBe('admin@saidkhan.dev');
  });

  it('should have an initialized Pino logger with redact config', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should capture exceptions cleanly via Sentry utility', () => {
    const testError = new Error('Verification test error for Sentry');
    expect(() => captureException(testError, { testRun: true })).not.toThrow();
  });
});
