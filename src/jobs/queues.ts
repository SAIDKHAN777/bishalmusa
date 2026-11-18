import { Queue, type JobsOptions } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export interface ContactJobPayload {
  messageId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export const CONTACT_QUEUE_NAME = 'contact-queue';
export const ANALYTICS_QUEUE_NAME = 'analytics-queue';

declare global {
  var __contactQueue: Queue<ContactJobPayload> | undefined;
  var __analyticsQueue: Queue | undefined;
}

export const contactQueue =
  globalThis.__contactQueue ??
  new Queue<ContactJobPayload>(CONTACT_QUEUE_NAME, {
    connection: redis.duplicate(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

export const analyticsQueue =
  globalThis.__analyticsQueue ??
  new Queue(ANALYTICS_QUEUE_NAME, {
    connection: redis.duplicate(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__contactQueue = contactQueue;
  globalThis.__analyticsQueue = analyticsQueue;
}

/**
 * Enqueue contact form notification job (processed asynchronously in background)
 */
export async function enqueueContactJob(data: ContactJobPayload, options?: JobsOptions) {
  try {
    const job = await contactQueue.add('send-contact-notifications', data, options);
    logger.info({ jobId: job.id, messageId: data.messageId }, 'Enqueued contact notification job in BullMQ');
    return job;
  } catch (error) {
    logger.error({ err: error, messageId: data.messageId }, 'Failed to enqueue contact job in BullMQ');
    throw error;
  }
}

/**
 * Enqueue analytics aggregation & 90-day pruning job
 */
export async function enqueueAnalyticsCleanupJob(options?: JobsOptions) {
  try {
    const job = await analyticsQueue.add('aggregate-and-prune-analytics', {}, options);
    logger.info({ jobId: job.id }, 'Enqueued analytics aggregation and pruning job in BullMQ');
    return job;
  } catch (error) {
    logger.error({ err: error }, 'Failed to enqueue analytics cleanup job in BullMQ');
    throw error;
  }
}
