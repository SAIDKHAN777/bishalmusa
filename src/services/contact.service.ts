import crypto from 'crypto';
import { db } from '../lib/db';
import { type Prisma } from '@prisma/client';
import { AppError } from '../lib/error-utils';
import { redis } from '../lib/redis';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { enqueueContactJob } from '../jobs/queues';
import type {
  ContactFormInput,
  MessageQueryInput,
  MessageUpdateInput,
} from '../lib/validators/contact';

export class ContactService {
  /**
   * Hashes IP address with a salt for privacy-preserving rate limiting & audit logs
   */
  static hashIp(ip: string): string {
    return crypto
      .createHash('sha256')
      .update((ip || '127.0.0.1') + env.ANALYTICS_SALT)
      .digest('hex');
  }

  /**
   * Rate limiting: Max 3 contact form submissions per hour per IP
   */
  static async checkRateLimit(ip: string): Promise<boolean> {
    const ipHash = this.hashIp(ip);
    const key = `ratelimit:contact:${ipHash}`;

    const count = await redis.incr(key);
    if (count === 1) {
      // 1 hour expiration (3600 seconds)
      await redis.expire(key, 3600);
    }

    if (count > 3) {
      logger.warn({ ipHash, count }, 'Contact form rate limit exceeded');
      return false;
    }

    return true;
  }

  /**
   * Cloudflare Turnstile token verification
   */
  static async verifyTurnstile(token?: string, ip?: string): Promise<boolean> {
    // If no secret key is set or in test mode, allow verification
    if (
      !env.TURNSTILE_SECRET_KEY ||
      env.NODE_ENV === 'test' ||
      env.TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA'
    ) {
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });

      const outcome = (await response.json()) as { success: boolean; 'error-codes'?: string[] };
      return outcome.success === true;
    } catch (err) {
      logger.error({ err }, 'Turnstile verification error');
      return false;
    }
  }

  /**
   * Process public contact form submission:
   * 1. Honeypot spam check
   * 2. IP Rate limit (3 per hour)
   * 3. Turnstile bot protection
   * 4. Save to database
   * 5. Dispatch async BullMQ notification job
   */
  static async submitMessage(input: ContactFormInput, clientIp: string) {
    const ipHash = this.hashIp(clientIp);

    // 1. Honeypot check: Bots fill in website_url_check
    const isHoneypotTriggered = Boolean(
      input.website_url_check && input.website_url_check.trim().length > 0
    );

    if (isHoneypotTriggered) {
      logger.info({ ipHash, name: input.name }, 'Honeypot triggered, saving message as spam');
      const spamRecord = await db.contactMessage.create({
        data: {
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
          ipHash,
          isSpam: true,
          isRead: false,
        },
      });

      // Silently return success to the bot, without queueing notifications
      return {
        id: spamRecord.id,
        message: 'Message sent successfully',
      };
    }

    // 2. IP Rate Limit check
    const isAllowed = await this.checkRateLimit(clientIp);
    if (!isAllowed) {
      throw new AppError(
        'Too many contact submissions from your IP. Please try again in an hour.',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // 3. Turnstile verification
    const isTurnstileValid = await this.verifyTurnstile(input.turnstileToken, clientIp);
    if (!isTurnstileValid) {
      throw new AppError(
        'Bot verification failed. Please refresh and try again.',
        'CAPTCHA_VERIFICATION_FAILED',
        400
      );
    }

    // 4. Save clean message to database
    const messageRecord = await db.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ipHash,
        isSpam: false,
        isRead: false,
      },
    });

    // 5. Enqueue background job to send email and telegram notification
    try {
      await enqueueContactJob({
        messageId: messageRecord.id,
        name: messageRecord.name,
        email: messageRecord.email,
        subject: messageRecord.subject,
        message: messageRecord.message,
        createdAt: messageRecord.createdAt.toISOString(),
      });
    } catch (queueError) {
      // Background enqueue error must not fail visitor response, logged to Pino
      logger.error(
        { err: queueError, messageId: messageRecord.id },
        'Contact message saved, but failed to enqueue background notification job'
      );
    }

    return {
      id: messageRecord.id,
      message: 'Thank you for reaching out! Your message has been received.',
    };
  }

  /**
   * Admin: List messages with pagination and filtering
   */
  static async listMessages(query: MessageQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactMessageWhereInput = {
      deletedAt: null,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.isSpam !== undefined) {
      where.isSpam = query.isSpam;
    }

    const [total, items] = await Promise.all([
      db.contactMessage.count({ where }),
      db.contactMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Get a single message by ID
   */
  static async getMessageById(id: string) {
    const message = await db.contactMessage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!message) {
      throw new AppError('Contact message not found', 'NOT_FOUND', 404);
    }

    return message;
  }

  /**
   * Admin: Update message (mark read/unread, mark spam)
   */
  static async updateMessage(id: string, input: MessageUpdateInput) {
    await this.getMessageById(id);

    const updated = await db.contactMessage.update({
      where: { id },
      data: {
        ...(input.isRead !== undefined ? { isRead: input.isRead } : {}),
        ...(input.isSpam !== undefined ? { isSpam: input.isSpam } : {}),
      },
    });

    return updated;
  }

  /**
   * Admin: Soft delete a message
   */
  static async deleteMessage(id: string) {
    await this.getMessageById(id);

    await db.contactMessage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Contact message deleted successfully' };
  }
}
