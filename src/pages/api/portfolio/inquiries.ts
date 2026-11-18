import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { z } from 'zod';
import { PortfolioService } from '../../../services/portfolio.service';
import { redis } from '../../../lib/redis';
import { env } from '../../../lib/env';
import { logger } from '../../../lib/logger';
import { getErrorInfo } from '../../../lib/error-utils';

export const prerender = false;

const portfolioInquirySchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(160),
  service: z.string().trim().min(1, 'Please select a service.').max(120),
  budget: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(3, 'Please describe your project requirements.').max(5000),
  website_url_check: z.string().optional().default(''),
});

async function checkInquiryRateLimit(ip: string): Promise<boolean> {
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip.includes('localhost');
  const maxPerHour = isLoopback ? 30 : 5;
  try {
    const ipHash = crypto.createHash('sha256').update(`${ip}:${env.ANALYTICS_SALT}`).digest('hex');
    const key = `ratelimit:portfolio_inquiry:${ipHash}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600);
    }
    return count <= maxPerHour;
  } catch {
    return true;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = portfolioInquirySchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid inquiry input',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Silent honeypot protection against automated spam bots
    if (parsed.data.website_url_check && parsed.data.website_url_check.trim().length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'accepted',
            name: parsed.data.name,
            email: parsed.data.email,
            service: parsed.data.service,
            message: parsed.data.message,
            status: 'new',
            createdAt: new Date().toISOString(),
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      clientAddress ||
      '127.0.0.1';

    const allowed = await checkInquiryRateLimit(clientIp);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many submissions from your IP. Please try again later.',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const inquiry = await PortfolioService.createInquiry(
      parsed.data,
      clientIp,
      request.headers.get('user-agent') || undefined
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: inquiry,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const info = getErrorInfo(err, 'Failed to save inquiry');
    logger.error({ err }, 'Failed to submit portfolio contact inquiry');
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: info.message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
