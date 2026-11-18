import crypto from 'crypto';
import { redis } from '../lib/redis';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { captureException } from '../lib/sentry';
import { getErrorInfo } from '../lib/error-utils';

export const GLOBAL_RATE_LIMIT_WINDOW = 60; // 60 seconds window
export const GLOBAL_RATE_LIMIT_MAX = 600; // 600 requests per minute per IP
export const MAX_JSON_PAYLOAD_SIZE = 1024 * 1024; // 1 MB limit for standard JSON payloads

export class SecurityService {
  static readonly GLOBAL_RATE_LIMIT_MAX = GLOBAL_RATE_LIMIT_MAX;
  static readonly GLOBAL_RATE_LIMIT_WINDOW = GLOBAL_RATE_LIMIT_WINDOW;
  /**
   * Hashes IP address with secret ANALYTICS_SALT for rate limit keys & privacy
   */
  static hashIp(ip: string): string {
    return crypto
      .createHash('sha256')
      .update((ip || '127.0.0.1') + env.ANALYTICS_SALT)
      .digest('hex');
  }

  /**
   * Redis sliding-window global rate limiter
   */
  static async checkGlobalRateLimit(
    ip: string,
    limit: number = GLOBAL_RATE_LIMIT_MAX,
    windowSeconds: number = GLOBAL_RATE_LIMIT_WINDOW
  ): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
    const ipHash = this.hashIp(ip);
    const key = `ratelimit:global:${ipHash}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, limit - current);
      const reset = Math.max(1, ttl);

      if (current > limit) {
        logger.warn({ ipHash, current, limit }, 'Global rate limit exceeded');
        return {
          allowed: false,
          limit,
          remaining: 0,
          reset,
        };
      }

      return {
        allowed: true,
        limit,
        remaining,
        reset,
      };
    } catch (err) {
      // In case of Redis glitch, fail-open to not block legitimate users, but log error
      logger.error({ err }, 'Redis error during global rate limiting');
      return {
        allowed: true,
        limit,
        remaining: 1,
        reset: windowSeconds,
      };
    }
  }

  /**
   * Validates Content-Length to prevent memory exhaustion / DoS attacks via oversized payloads
   */
  static validatePayloadSize(contentLengthHeader: string | null, maxSize: number = MAX_JSON_PAYLOAD_SIZE): boolean {
    if (!contentLengthHeader) return true;
    const length = parseInt(contentLengthHeader, 10);
    if (isNaN(length)) return true;
    return length <= maxSize;
  }

  /**
   * Centralized safe error formatter: Logs full trace to Pino & Sentry, never leaks internal stack to user
   */
  static formatSafeErrorResponse(err: unknown, pathname: string, method: string): Response {
    const info = getErrorInfo(err, 'Bad Request');
    logger.error(
      {
        err,
        pathname,
        method,
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Unhandled exception in request handler'
    );

    captureException(err, { pathname, method });

    const statusCode = info.statusCode || 500;
    const errorCode = info.code || 'INTERNAL_ERROR';
    const message =
      statusCode < 500
        ? info.message
        : 'An internal server error occurred. Our engineering team has been notified.';

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: errorCode,
          message,
        },
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}
