import { describe, it, expect, afterAll } from 'vitest';
import { SecurityService } from '../../src/services/security.service';
import { redis } from '../../src/lib/redis';

describe('Security Hardening & Protection Services (Unit Tests)', () => {
  const testIp = '198.51.100.77';

  afterAll(async () => {
    const ipHash = SecurityService.hashIp(testIp);
    await redis.del(`ratelimit:global:${ipHash}`);
  });

  describe('IP Hashing & Privacy', () => {
    it('should create deterministic SHA-256 hash without exposing raw IP address', () => {
      const hash1 = SecurityService.hashIp(testIp);
      const hash2 = SecurityService.hashIp(testIp);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toContain(testIp);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Global Redis Rate Limiter', () => {
    it('should allow requests below threshold and block when exceeded', async () => {
      const limit = 5;
      const windowSeconds = 10;
      const ipHash = SecurityService.hashIp(testIp);
      await redis.del(`ratelimit:global:${ipHash}`);

      // First 5 requests should pass
      for (let i = 1; i <= limit; i++) {
        const res = await SecurityService.checkGlobalRateLimit(testIp, limit, windowSeconds);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(limit - i);
      }

      // 6th request must be blocked
      const blocked = await SecurityService.checkGlobalRateLimit(testIp, limit, windowSeconds);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.reset).toBeGreaterThan(0);

      // Clean up
      await redis.del(`ratelimit:global:${ipHash}`);
    });
  });

  describe('Payload Size Guard', () => {
    it('should approve valid payload sizes under 1MB', () => {
      expect(SecurityService.validatePayloadSize('500')).toBe(true);
      expect(SecurityService.validatePayloadSize('500000')).toBe(true);
      expect(SecurityService.validatePayloadSize(null)).toBe(true);
    });

    it('should reject payload sizes exceeding 1MB', () => {
      const oversized = 1024 * 1024 + 10;
      expect(SecurityService.validatePayloadSize(String(oversized))).toBe(false);
    });
  });

  describe('Central Error Formatter & Stack Trace Isolation', () => {
    it('should sanitize internal server errors and never leak stack traces', () => {
      const internalError = new Error('Database connection string password leaked!');
      internalError.stack = 'Error: Database connection...\n    at SecretFunction (/app/src/db.ts:42:15)';

      const response = SecurityService.formatSafeErrorResponse(
        internalError,
        '/api/projects',
        'POST'
      );

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toContain('application/json');

      // Check response body
      return response.json().then((body) => {
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INTERNAL_ERROR');
        // Critical: User sees generic safe message, not internal secret or stack
        expect(body.error.message).toContain('An internal server error occurred');
        expect(JSON.stringify(body)).not.toContain('SecretFunction');
        expect(JSON.stringify(body)).not.toContain('Database connection string password leaked');
      });
    });

    it('should format client errors (4xx) with user-friendly messages', () => {
      const clientError: any = new Error('Invalid input parameter');
      clientError.statusCode = 400;
      clientError.code = 'INVALID_INPUT';

      const response = SecurityService.formatSafeErrorResponse(
        clientError,
        '/api/contact',
        'POST'
      );

      expect(response.status).toBe(400);
      return response.json().then((body) => {
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INVALID_INPUT');
        expect(body.error.message).toBe('Invalid input parameter');
      });
    });
  });
});
