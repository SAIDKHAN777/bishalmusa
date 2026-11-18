import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { db } from '../../src/lib/db';
import { redis } from '../../src/lib/redis';
import { ContactService } from '../../src/services/contact.service';
import { contactFormSchema } from '../../src/lib/validators/contact';
import { processContactJob } from '../../src/jobs/worker';
import type { Job } from 'bullmq';

describe('Contact Form & Background Notification Jobs (Unit Tests)', () => {
  const testIp = '192.168.100.42';

  beforeEach(async () => {
    // Reset rate limiter for test IP
    const ipHash = ContactService.hashIp(testIp);
    await redis.del(`ratelimit:contact:${ipHash}`);
  });

  afterAll(async () => {
    // Clean up test contact messages
    await db.contactMessage.deleteMany({
      where: { email: { contains: 'test-unit' } },
    });
    const ipHash = ContactService.hashIp(testIp);
    await redis.del(`ratelimit:contact:${ipHash}`);
    await db.$disconnect();
  });

  describe('Zod Validation for Contact Form', () => {
    it('should validate complete and correct form data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        subject: 'Contract Collaboration Inquiry',
        message: 'Hello Said, I would love to discuss a high-performance backend architecture project.',
        website_url_check: '',
      };

      const result = contactFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john.doe@example.com');
      }
    });

    it('should fail when name is too short', () => {
      const invalidData = {
        name: 'A',
        email: 'test@example.com',
        subject: 'Hello',
        message: 'Message with sufficient length here.',
      };

      const result = contactFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail when email is invalid', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'not-an-email',
        subject: 'Valid Subject',
        message: 'Message with sufficient length here.',
      };

      const result = contactFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail when message is under 10 characters', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Valid Subject',
        message: 'Too short',
      };

      const result = contactFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Spam Protection: Honeypot & IP Rate Limiting', () => {
    it('should flag honeypot submissions as spam without triggering background worker', async () => {
      const spamPayload = {
        name: 'Spam Bot',
        email: 'spam-bot-test-unit@spam.com',
        subject: 'Cheap SEO backlinks',
        message: 'Click this link to boost rankings immediately!',
        website_url_check: 'https://spam-link.biz', // BOT FILLED THIS
      };

      const result = await ContactService.submitMessage(spamPayload, testIp);
      expect(result.message).toBe('Message sent successfully');

      // Verify in DB that it is marked as isSpam: true
      const stored = await db.contactMessage.findUnique({
        where: { id: result.id },
      });
      expect(stored).not.toBeNull();
      expect(stored?.isSpam).toBe(true);
    });

    it('should enforce rate limit of 3 submissions per hour per IP', async () => {
      const rateLimitIp = '10.0.0.99';
      const ipHash = ContactService.hashIp(rateLimitIp);
      await redis.del(`ratelimit:contact:${ipHash}`);

      // First 3 submissions should succeed
      for (let i = 1; i <= 3; i++) {
        const allowed = await ContactService.checkRateLimit(rateLimitIp);
        expect(allowed).toBe(true);
      }

      // 4th submission must be rejected
      const fourthAttempt = await ContactService.checkRateLimit(rateLimitIp);
      expect(fourthAttempt).toBe(false);

      // Clean up
      await redis.del(`ratelimit:contact:${ipHash}`);
    });
  });

  describe('Clean Submission & BullMQ Job Processing', () => {
    it('should save legitimate message and successfully process notification job', async () => {
      const cleanPayload = {
        name: 'Said Partner',
        email: 'partner-test-unit@example.com',
        subject: 'Enterprise System Architecture',
        message: 'We are looking for a senior engineer to lead our microservices transformation.',
        website_url_check: '',
      };

      const submission = await ContactService.submitMessage(cleanPayload, testIp);
      expect(submission.id).toBeDefined();

      const savedMessage = await db.contactMessage.findUnique({
        where: { id: submission.id },
      });
      expect(savedMessage).not.toBeNull();
      expect(savedMessage?.isSpam).toBe(false);
      expect(savedMessage?.isRead).toBe(false);

      // Verify Worker Job processor directly
      const mockJob = {
        id: 'job-unit-test-1',
        attemptsMade: 0,
        data: {
          messageId: savedMessage!.id,
          name: savedMessage!.name,
          email: savedMessage!.email,
          subject: savedMessage!.subject,
          message: savedMessage!.message,
          createdAt: savedMessage!.createdAt.toISOString(),
        },
      } as unknown as Job;

      const jobResult = await processContactJob(mockJob);
      expect(jobResult.success).toBe(true);
      expect(jobResult.messageId).toBe(savedMessage!.id);
    });
  });

  describe('Admin Contact Messages Management', () => {
    it('should list messages, filter unread, update read status, and soft delete', async () => {
      // 1. Create a test message
      const msg = await db.contactMessage.create({
        data: {
          name: 'Admin Test User',
          email: 'admin-msg-test-unit@example.com',
          subject: 'Question regarding services',
          message: 'Can you provide consulting on Kubernetes setup?',
          isRead: false,
          isSpam: false,
        },
      });

      // 2. List messages
      const list = await ContactService.listMessages({ page: 1, limit: 10 });
      expect(list.items.some((item) => item.id === msg.id)).toBe(true);
      expect(list.pagination.total).toBeGreaterThanOrEqual(1);

      // 3. Mark message as read
      const updated = await ContactService.updateMessage(msg.id, { isRead: true });
      expect(updated.isRead).toBe(true);

      // 4. Soft delete message
      const deleteResult = await ContactService.deleteMessage(msg.id);
      expect(deleteResult.message).toContain('deleted successfully');

      // Verify message is no longer in active list
      const activeList = await ContactService.listMessages({ page: 1, limit: 100 });
      expect(activeList.items.some((item) => item.id === msg.id)).toBe(false);
    });
  });
});
