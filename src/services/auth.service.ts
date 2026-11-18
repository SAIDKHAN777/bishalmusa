import { db } from '../lib/db';
import { redis } from '../lib/redis';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  SESSION_DURATION_SECONDS,
} from '../lib/auth';
import { logger } from '../lib/logger';
import { Role } from '@prisma/client';

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResult {
  user: AdminUserDto;
  token: string;
  expiresAt: Date;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

export class AuthService {
  private static getRateLimitKey(ip: string): string {
    return `auth:ratelimit:ip:${ip}`;
  }

  static async isRateLimited(ip: string): Promise<boolean> {
    try {
      const key = this.getRateLimitKey(ip);
      const attempts = await redis.get(key);
      return attempts !== null && parseInt(attempts, 10) >= MAX_FAILED_ATTEMPTS;
    } catch (err) {
      logger.warn({ err }, 'Redis rate limit check failed; permitting request');
      return false;
    }
  }

  static async recordFailedAttempt(ip: string): Promise<number> {
    try {
      const key = this.getRateLimitKey(ip);
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, LOCKOUT_SECONDS);
      }
      return current;
    } catch (err) {
      logger.warn({ err }, 'Redis rate limit record failed');
      return 1;
    }
  }

  static async resetRateLimit(ip: string): Promise<void> {
    try {
      const key = this.getRateLimitKey(ip);
      await redis.del(key);
    } catch (err) {
      logger.warn({ err }, 'Redis rate limit reset failed');
    }
  }

  static async login(
    email: string,
    plainPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const ip = ipAddress || '127.0.0.1';

    // 1. Check rate limit
    if (await this.isRateLimited(ip)) {
      logger.warn({ email, ip }, 'Login attempt blocked by rate limit');
      throw new Error('TOO_MANY_REQUESTS: Account temporarily locked. Please try again in 15 minutes.');
    }

    // 2. Fetch admin user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== Role.ADMIN) {
      await this.recordFailedAttempt(ip);
      logger.warn({ email, ip }, 'Login failed: user not found or unauthorized');
      throw new Error('INVALID_CREDENTIALS: Invalid email or password.');
    }

    // 3. Verify password
    const isValid = await verifyPassword(user.passwordHash, plainPassword);
    if (!isValid) {
      await this.recordFailedAttempt(ip);
      logger.warn({ email, ip }, 'Login failed: incorrect password');
      throw new Error('INVALID_CREDENTIALS: Invalid email or password.');
    }

    // 4. Successful login: reset failed counter
    await this.resetRateLimit(ip);

    // 5. Create server-side session in database
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

    await db.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: ip,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    logger.info({ userId: user.id, email: user.email, ip }, 'Admin user logged in successfully');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
      expiresAt,
    };
  }

  static async validateSession(token: string): Promise<AdminUserDto | null> {
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      // Session expired, delete it
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    if (session.user.role !== Role.ADMIN) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  }

  static async loginByPassword(
    plainPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const ip = ipAddress || '127.0.0.1';

    if (await this.isRateLimited(ip)) {
      logger.warn({ ip }, 'Password-only login attempt blocked by rate limit');
      throw new Error('TOO_MANY_REQUESTS: Account temporarily locked. Please try again in 15 minutes.');
    }

    const admins = await db.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    let matchedUser: (typeof admins)[number] | null = null;
    for (const candidate of admins) {
      if (await verifyPassword(candidate.passwordHash, plainPassword)) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      await this.recordFailedAttempt(ip);
      logger.warn({ ip }, 'Password-only admin login failed: incorrect password');
      throw new Error('INVALID_CREDENTIALS: Incorrect password. Please try again.');
    }

    await this.resetRateLimit(ip);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

    await db.session.create({
      data: {
        userId: matchedUser.id,
        tokenHash,
        ipAddress: ip,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    await db.user.update({
      where: { id: matchedUser.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: matchedUser.id, email: matchedUser.email, ip }, 'Admin user logged in');

    return {
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
      },
      token,
      expiresAt,
    };
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ADMIN) {
      throw new Error('UNAUTHORIZED: Admin user not found.');
    }

    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS: Current password is incorrect.');
    }

    const nextHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
    });
    logger.info({ userId: user.id }, 'Admin password updated in PostgreSQL');
  }

  static async logout(token: string): Promise<void> {
    if (!token) return;
    const tokenHash = hashSessionToken(token);
    await db.session.deleteMany({
      where: { tokenHash },
    });
    logger.info('Admin user session invalidated');
  }
}
