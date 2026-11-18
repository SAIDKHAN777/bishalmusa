import { Worker, type Job } from 'bullmq';
import { Resend } from 'resend';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { Sentry } from '../lib/sentry';
import { redis } from '../lib/redis';
import { db } from '../lib/db';
import {
  CONTACT_QUEUE_NAME,
  ANALYTICS_QUEUE_NAME,
  type ContactJobPayload,
} from './queues';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function processContactJob(job: Job<ContactJobPayload>) {
  logger.info(
    { jobId: job.id, attempt: job.attemptsMade + 1, messageId: job.data.messageId },
    'Processing contact job'
  );

  const { name, email, subject, message, createdAt, messageId } = job.data;

  // 1. Send Email via Resend
  if (env.RESEND_API_KEY) {
    const isMockKey =
      env.NODE_ENV === 'test' ||
      env.RESEND_API_KEY.includes('123456789') ||
      env.RESEND_API_KEY === 'mock_resend_key';

    if (isMockKey) {
      logger.info(
        { messageId, recipient: env.CONTACT_RECEIVER_EMAIL },
        '[MOCK/DEV] Resend email simulated successfully'
      );
    } else {
      try {
        const resend = new Resend(env.RESEND_API_KEY);
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: 'Portfolio Contact <onboarding@resend.dev>',
          to: [env.CONTACT_RECEIVER_EMAIL],
          replyTo: email,
          subject: `[Portfolio Contact] ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">New Contact Submission</h2>
              <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
              <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
              <p><strong>Received At:</strong> ${new Date(createdAt).toLocaleString()}</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-top: 15px; border-left: 4px solid #2563eb;">
                <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(message)}</p>
              </div>
              <p style="margin-top: 20px; font-size: 12px; color: #64748b;">Delivered via Portfolio BullMQ Background Worker</p>
            </div>
          `,
        });

        if (resendError) {
          logger.error({ resendError, messageId }, 'Resend API returned an error');
          throw new Error(`Resend email delivery failed: ${resendError.message}`);
        }

        logger.info({ messageId, emailId: resendData?.id }, 'Resend email delivered successfully');
      } catch (err) {
        logger.error({ err, messageId }, 'Failed to send email via Resend');
        throw err;
      }
    }
  }

  // 2. Send Telegram Alert (Optional)
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const isMockTelegram =
      env.NODE_ENV === 'test' || env.TELEGRAM_BOT_TOKEN === 'mock_telegram_token';

    if (isMockTelegram) {
      logger.info({ messageId }, '[MOCK/DEV] Telegram notification simulated successfully');
    } else {
      try {
        const text = `📬 <b>New Contact Submission</b>\n\n<b>From:</b> ${escapeHtml(name)} (${escapeHtml(email)})\n<b>Subject:</b> ${escapeHtml(subject)}\n\n<b>Message:</b>\n${escapeHtml(message)}`;
        const tgRes = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text,
              parse_mode: 'HTML',
            }),
          }
        );

        if (!tgRes.ok) {
          const errorBody = await tgRes.text();
          logger.warn({ status: tgRes.status, errorBody, messageId }, 'Telegram alert failed');
        } else {
          logger.info({ messageId }, 'Telegram alert sent successfully');
        }
      } catch (tgErr) {
        logger.warn({ tgErr, messageId }, 'Error sending Telegram alert');
      }
    }
  }

  return { success: true, messageId };
}

/**
 * Analytics 90-day pruning processor
 */
export async function processAnalyticsCleanupJob() {
  logger.info('Running analytics 90-day retention pruning job');
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [prunedPageViews, prunedClicks, prunedDownloads] = await Promise.all([
    db.pageView.deleteMany({
      where: { timestamp: { lt: ninetyDaysAgo } },
    }),
    db.projectClick.deleteMany({
      where: { timestamp: { lt: ninetyDaysAgo } },
    }),
    db.resumeDownload.deleteMany({
      where: { timestamp: { lt: ninetyDaysAgo } },
    }),
  ]);

  const summary = {
    prunedPageViews: prunedPageViews.count,
    prunedClicks: prunedClicks.count,
    prunedDownloads: prunedDownloads.count,
  };

  logger.info(summary, 'Completed analytics pruning job');
  return summary;
}

export function createContactWorker() {
  const worker = new Worker<ContactJobPayload>(
    CONTACT_QUEUE_NAME,
    async (job) => {
      return await processContactJob(job);
    },
    {
      connection: redis.duplicate(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, messageId: job.data.messageId },
      'Contact worker completed job successfully'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        err,
        data: job?.data,
      },
      'Contact worker job failed'
    );
    Sentry.captureException(err, {
      extra: {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        data: job?.data,
      },
    });
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'BullMQ Worker internal error');
  });

  return worker;
}

export function createAnalyticsWorker() {
  const worker = new Worker(
    ANALYTICS_QUEUE_NAME,
    async () => {
      return await processAnalyticsCleanupJob();
    },
    {
      connection: redis.duplicate(),
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Analytics worker completed aggregation and pruning');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Analytics worker job failed');
    Sentry.captureException(err);
  });

  return worker;
}

declare global {
  var __contactWorker: Worker<ContactJobPayload> | undefined;
  var __analyticsWorker: Worker | undefined;
}

export const contactWorker = globalThis.__contactWorker ?? createContactWorker();
export const analyticsWorker = globalThis.__analyticsWorker ?? createAnalyticsWorker();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__contactWorker = contactWorker;
  globalThis.__analyticsWorker = analyticsWorker;
}
