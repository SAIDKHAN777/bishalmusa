import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { AuthService } from '../../src/services/auth.service';
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken } from '../../src/lib/auth';
import { db } from '../../src/lib/db';
import { redis } from '../../src/lib/redis';

describe('Admin Authentication & Session Logic', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@saidkhan.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperSecretAdminPassword123!';
  const testIp = '192.168.1.100';

  beforeEach(async () => {
    await AuthService.resetRateLimit(testIp);
  });

  afterAll(async () => {
    await AuthService.resetRateLimit(testIp);
    await db.session.deleteMany({ where: { ipAddress: testIp } });
    await db.$disconnect();
    await redis.quit();
  });

  it('should hash and verify passwords using Argon2id', async () => {
    const raw = 'MyStrongAdminPass!99';
    const hash = await hashPassword(raw);

    expect(hash).toContain('$argon2id$');
    const isMatch = await verifyPassword(hash, raw);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword(hash, 'DifferentPassword');
    expect(isWrongMatch).toBe(false);
  });

  it('should generate high-entropy tokens and sha256 hashes', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes hex

    const hash1 = hashSessionToken(token1);
    expect(hash1.length).toBe(64); // sha256 hex
  });

  it('should reject login with wrong password and throw INVALID_CREDENTIALS', async () => {
    await expect(
      AuthService.login(adminEmail, 'WrongPasswordHere!', testIp)
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('should successfully log in with correct credentials and create session in DB', async () => {
    const result = await AuthService.login(adminEmail, adminPassword, testIp, 'Vitest-Agent');

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(adminEmail);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify session exists in DB
    const validatedUser = await AuthService.validateSession(result.token);
    expect(validatedUser).toBeDefined();
    expect(validatedUser?.id).toBe(result.user.id);
    expect(validatedUser?.email).toBe(adminEmail);

    // Clean up session via logout
    await AuthService.logout(result.token);

    // Verify session is revoked
    const afterLogout = await AuthService.validateSession(result.token);
    expect(afterLogout).toBeNull();
  });

  it('should lock out IP after 5 consecutive failed login attempts', async () => {
    const lockoutIp = '192.168.1.105';
    await AuthService.resetRateLimit(lockoutIp);

    for (let i = 0; i < 5; i++) {
      await expect(
        AuthService.login(adminEmail, 'BadPassword' + i, lockoutIp)
      ).rejects.toThrow('INVALID_CREDENTIALS');
    }

    // 6th attempt must trigger rate limit
    await expect(
      AuthService.login(adminEmail, adminPassword, lockoutIp)
    ).rejects.toThrow('TOO_MANY_REQUESTS');

    await AuthService.resetRateLimit(lockoutIp);
  });
});
